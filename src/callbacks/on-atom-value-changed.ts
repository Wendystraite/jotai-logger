import type { Atom } from 'jotai';
import {
  INTERNAL_isPromiseLike,
  INTERNAL_promiseStateMap,
  INTERNAL_registerAbortHandler,
} from 'jotai/vanilla/internals';

import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import { addEventToTransaction } from '../transactions/add-event-to-transaction.js';
import { endTransaction } from '../transactions/end-transaction.js';
import { maybeStartTransaction } from '../transactions/maybe-start-transaction.js';
import type { StoreWithAtomsLogger } from '../types/atoms-logger.js';

export function onAtomValueChanged(
  store: StoreWithAtomsLogger,
  atom: Atom<unknown>,
  args: { isInitialValue?: boolean; oldValue?: unknown; newValue: unknown },
) {
  const { newValue } = args;
  let { isInitialValue = false } = args;
  let { oldValue } = args;

  if (!INTERNAL_isPromiseLike(newValue)) {
    if (isInitialValue) {
      addEventToTransaction(store, { initialized: { atom, value: newValue } });
    } else if (oldValue !== newValue) {
      addEventToTransaction(store, { changed: { atom, oldValue, newValue } });
    }
    return;
  }

  if (INTERNAL_isPromiseLike(oldValue)) {
    if (store[ATOMS_LOGGER_SYMBOL].promisesResultsMap.has(oldValue)) {
      // uses the result of the previous promise instead of the promise itself
      oldValue = store[ATOMS_LOGGER_SYMBOL].promisesResultsMap.get(oldValue);
    } else {
      // Edge case: if the oldValue is a promise BUT we don't have her result
      // yet this means that the promise was never resolved or rejected or it
      // was aborted. In this case we consider that there is no old value.
      isInitialValue = true;
      oldValue = undefined;
    }
  }

  let isAborted = false;

  const promiseState = INTERNAL_promiseStateMap.get(newValue);
  const isPendingPromise = !promiseState || promiseState[0];
  if (isPendingPromise) {
    if (isInitialValue) {
      addEventToTransaction(store, { initialPromisePending: { atom } });
    } else {
      addEventToTransaction(store, {
        changedPromisePending: { atom, oldValue },
      });
    }

    INTERNAL_registerAbortHandler(newValue, () => {
      isAborted = true;
      if (isInitialValue) {
        addEventToTransaction(store, { initialPromiseAborted: { atom } });
      } else {
        addEventToTransaction(store, {
          changedPromiseAborted: { atom, oldValue },
        });
      }
    });
  }

  newValue.then(
    (value: unknown) => {
      if (!isAborted) {
        store[ATOMS_LOGGER_SYMBOL].promisesResultsMap.set(newValue, value);
        const startedTransaction = maybeStartTransaction(store, { promiseResolved: { atom } });
        if (isInitialValue) {
          addEventToTransaction(store, { initialPromiseResolved: { atom, value } });
        } else {
          addEventToTransaction(store, {
            changedPromiseResolved: { atom, oldValue, newValue: value },
          });
        }
        if (startedTransaction) endTransaction(store);
      }
    },
    (error: unknown) => {
      if (!isAborted) {
        store[ATOMS_LOGGER_SYMBOL].promisesResultsMap.set(newValue, error);
        const startedTransaction = maybeStartTransaction(store, { promiseRejected: { atom } });
        if (isInitialValue) {
          addEventToTransaction(store, {
            initialPromiseRejected: { atom, error },
          });
        } else {
          addEventToTransaction(store, {
            changedPromiseRejected: { atom, oldValue, error },
          });
        }
        if (startedTransaction) endTransaction(store);
      }
    },
  );
}
