import { INTERNAL_isPromiseLike as isPromiseLike } from 'jotai/vanilla/internals';
import type { INTERNAL_BuildingBlocks as BuildingBlocks } from 'jotai/vanilla/internals';

import { addEventToTransaction } from '../transactions/add-event-to-transaction.js';
import { endTransaction } from '../transactions/end-transaction.js';
import { startTransaction } from '../transactions/start-transaction.js';
import { AtomEventTypes, type AnyAtom } from '../types/event.js';
import type { AtomLoggerStoreState, Store } from '../types/store.js';
import { AtomTransactionTypes } from '../types/transaction.js';

export function onAtomValueChanged(
  store: Store,
  loggerState: AtomLoggerStoreState,
  buildingBlocks: Readonly<BuildingBlocks>,
  atom: AnyAtom,
  args: { isInitialValue?: boolean; oldValue?: unknown; newValue: unknown },
) {
  const { newValue: newValueOrPromise } = args;
  let { isInitialValue = false } = args;
  let { oldValue } = args;

  if (!isPromiseLike(newValueOrPromise)) {
    const newValue = newValueOrPromise;
    if (isInitialValue) {
      addEventToTransaction(loggerState, buildingBlocks, {
        type: AtomEventTypes.initialized,
        atom,
        value: newValue,
      });
    } else {
      addEventToTransaction(loggerState, buildingBlocks, {
        type: AtomEventTypes.changed,
        atom,
        oldValue,
        newValue,
      });
    }
    return;
  }

  const newPromise = newValueOrPromise;

  if (!isInitialValue) {
    if (isPromiseLike(oldValue)) {
      if (loggerState.promisesResultsMap.has(oldValue)) {
        // uses the result of the previous promise instead of the promise itself
        oldValue = loggerState.promisesResultsMap.get(oldValue);
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
    loggerState.promisesResultsMap.set(newPromise, oldValue);
  }

  let isAborted = false;

  if (isInitialValue) {
    addEventToTransaction(loggerState, buildingBlocks, {
      type: AtomEventTypes.initialPromisePending,
      atom,
    });
  } else {
    addEventToTransaction(loggerState, buildingBlocks, {
      type: AtomEventTypes.changedPromisePending,
      atom,
      oldValue,
    });
  }

  const registerAbortHandler = buildingBlocks[26];
  registerAbortHandler(buildingBlocks, store, newPromise, () => {
    isAborted = true;
    if (isInitialValue) {
      addEventToTransaction(loggerState, buildingBlocks, {
        type: AtomEventTypes.initialPromiseAborted,
        atom,
      });
    } else {
      addEventToTransaction(loggerState, buildingBlocks, {
        type: AtomEventTypes.changedPromiseAborted,
        atom,
        oldValue,
      });
    }
  });

  const transactionWhenPending = loggerState.currentTransaction;

  const canStartNewTransaction = () => {
    const currentTransaction = loggerState.currentTransaction;

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
      currentTransaction.type === AtomTransactionTypes.promiseResolved ||
      currentTransaction.type === AtomTransactionTypes.promiseRejected
    ) {
      return false;
    }

    // Else, we can start a new transaction
    return true;
  };

  newPromise.then(
    (newValue: unknown) => {
      if (!isAborted) {
        loggerState.promisesResultsMap.set(newPromise, newValue);

        const doStartTransaction = canStartNewTransaction();

        if (doStartTransaction) {
          startTransaction(loggerState, {
            type: AtomTransactionTypes.promiseResolved,
            atom,
          });
        }

        if (isInitialValue) {
          addEventToTransaction(loggerState, buildingBlocks, {
            type: AtomEventTypes.initialPromiseResolved,
            atom,
            value: newValue,
          });
        } else {
          addEventToTransaction(loggerState, buildingBlocks, {
            type: AtomEventTypes.changedPromiseResolved,
            atom,
            oldValue,
            newValue,
          });
        }

        if (doStartTransaction) {
          endTransaction(loggerState);
        }
      }
    },
    (error: unknown) => {
      if (!isAborted) {
        const doStartTransaction = canStartNewTransaction();

        if (doStartTransaction) {
          startTransaction(loggerState, {
            type: AtomTransactionTypes.promiseRejected,
            atom,
          });
        }

        loggerState.promisesResultsMap.set(newPromise, error);

        if (isInitialValue) {
          addEventToTransaction(loggerState, buildingBlocks, {
            type: AtomEventTypes.initialPromiseRejected,
            atom,
            error,
          });
        } else {
          addEventToTransaction(loggerState, buildingBlocks, {
            type: AtomEventTypes.changedPromiseRejected,
            atom,
            oldValue,
            error,
          });
        }

        if (doStartTransaction) {
          endTransaction(loggerState);
        }
      }
    },
  );
}
