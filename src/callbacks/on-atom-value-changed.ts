import { INTERNAL_isPromiseLike, INTERNAL_registerAbortHandler } from 'jotai/vanilla/internals';

import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import { addEventToTransaction } from '../transactions/add-event-to-transaction.js';
import { endTransaction } from '../transactions/end-transaction.js';
import { startTransaction } from '../transactions/start-transaction.js';
import {
  AtomsLoggerEventTypes,
  AtomsLoggerTransactionTypes,
  type AnyAtom,
  type StoreWithAtomsLogger,
} from '../types/atoms-logger.js';

export function onAtomValueChanged(
  store: StoreWithAtomsLogger,
  atom: AnyAtom,
  args: { isInitialValue?: boolean; oldValue?: unknown; newValue: unknown },
) {
  const { newValue: newValueOrPromise } = args;
  let { isInitialValue = false } = args;
  let { oldValue } = args;

  if (!INTERNAL_isPromiseLike(newValueOrPromise)) {
    const newValue = newValueOrPromise;
    if (isInitialValue) {
      addEventToTransaction(store, {
        type: AtomsLoggerEventTypes.initialized,
        atom,
        value: newValue,
      });
    } else if (oldValue !== newValueOrPromise) {
      addEventToTransaction(store, {
        type: AtomsLoggerEventTypes.changed,
        atom,
        oldValue,
        newValue,
      });
    }
    return;
  }

  const newPromise = newValueOrPromise;

  if (!isInitialValue) {
    if (INTERNAL_isPromiseLike(oldValue)) {
      if (store[ATOMS_LOGGER_SYMBOL].promisesResultsMap.has(oldValue)) {
        // uses the result of the previous promise instead of the promise itself
        oldValue = store[ATOMS_LOGGER_SYMBOL].promisesResultsMap.get(oldValue);
      } else {
        // Edge case to know if the current promise is still the initial promise after the previous (initial) promise was aborted :
        // if we don't have the result of the previous promise it means that is
        // was aborted and since we haven't set the oldValue of the previous
        // promise in the results map just bellow it means that this promise is
        // the initial promise.
        isInitialValue = true;
      }
    }

    // Edge case to retrieve the oldValue of an aborted promise :
    // - Store the oldValue of the current promise in the results map before it is settled.
    // - If this promise is aborted, the oldValue will be retrieved from the results map in the above code.
    //   This also prevent the new promise to think it was an initial promise is the above edge case.
    // - Else, it will be replaced by the new value or error of the resolved/rejected promise.
    store[ATOMS_LOGGER_SYMBOL].promisesResultsMap.set(newPromise, oldValue);
  }

  let isAborted = false;

  if (isInitialValue) {
    addEventToTransaction(store, {
      type: AtomsLoggerEventTypes.initialPromisePending,
      atom,
    });
  } else {
    addEventToTransaction(store, {
      type: AtomsLoggerEventTypes.changedPromisePending,
      atom,
      oldValue,
    });
  }

  INTERNAL_registerAbortHandler(newPromise, () => {
    isAborted = true;
    if (isInitialValue) {
      addEventToTransaction(store, {
        type: AtomsLoggerEventTypes.initialPromiseAborted,
        atom,
      });
    } else {
      addEventToTransaction(store, {
        type: AtomsLoggerEventTypes.changedPromiseAborted,
        atom,
        oldValue,
      });
    }
  });

  const transactionWhenPending = store[ATOMS_LOGGER_SYMBOL].currentTransaction;

  const canStartNewTransaction = () => {
    const currentTransaction = store[ATOMS_LOGGER_SYMBOL].currentTransaction;

    // No transaction started : start a new one
    if (currentTransaction === undefined) {
      return true;
    }

    // Current transaction is the same as the one when the promise was created :
    // keep the current transaction
    if (transactionWhenPending === currentTransaction) {
      return false;
    }

    // Current transaction is a promise resolved or rejected : This can means
    // that these promises were waiting for the previous pending transaction to
    // be settled so merge them into the current transaction.
    if (
      currentTransaction.type === AtomsLoggerTransactionTypes.promiseResolved ||
      currentTransaction.type === AtomsLoggerTransactionTypes.promiseRejected
    ) {
      return false;
    }

    // Else, we can start a new transaction
    return true;
  };

  newPromise.then(
    (newValue: unknown) => {
      if (!isAborted) {
        store[ATOMS_LOGGER_SYMBOL].promisesResultsMap.set(newPromise, newValue);

        const doStartTransaction = canStartNewTransaction();

        if (doStartTransaction) {
          startTransaction(store, {
            type: AtomsLoggerTransactionTypes.promiseResolved,
            atom,
          });
        }

        if (isInitialValue) {
          addEventToTransaction(store, {
            type: AtomsLoggerEventTypes.initialPromiseResolved,
            atom,
            value: newValue,
          });
        } else {
          addEventToTransaction(store, {
            type: AtomsLoggerEventTypes.changedPromiseResolved,
            atom,
            oldValue,
            newValue,
          });
        }

        if (doStartTransaction) {
          endTransaction(store);
        }
      }
    },
    (error: unknown) => {
      if (!isAborted) {
        const doStartTransaction = canStartNewTransaction();

        if (doStartTransaction) {
          startTransaction(store, {
            type: AtomsLoggerTransactionTypes.promiseRejected,
            atom,
          });
        }

        store[ATOMS_LOGGER_SYMBOL].promisesResultsMap.set(newPromise, error);

        if (isInitialValue) {
          addEventToTransaction(store, {
            type: AtomsLoggerEventTypes.initialPromiseRejected,
            atom,
            error,
          });
        } else {
          addEventToTransaction(store, {
            type: AtomsLoggerEventTypes.changedPromiseRejected,
            atom,
            oldValue,
            error,
          });
        }

        if (doStartTransaction) {
          endTransaction(store);
        }
      }
    },
  );
}
