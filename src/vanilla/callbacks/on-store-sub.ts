import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import { endTransaction } from '../transactions/end-transaction.js';
import { startTransaction } from '../transactions/start-transaction.js';
import {
  AtomsLoggerTransactionTypes,
  type AnyAtom,
  type StoreWithAtomsLogger,
} from '../types/atoms-logger.js';

export function getOnStoreSub(store: StoreWithAtomsLogger): StoreWithAtomsLogger['sub'] {
  return function onStoreSub(atom: AnyAtom, listener: () => void): () => void {
    const doStartTransaction = !store[ATOMS_LOGGER_SYMBOL].isInsideTransaction;
    try {
      if (doStartTransaction) {
        startTransaction(store, {
          type: AtomsLoggerTransactionTypes.storeSubscribe,
          atom,
          listener,
        });
      }
      const unsubscribe = store[ATOMS_LOGGER_SYMBOL].prevStoreSub(atom, listener);
      return getOnStoreUnsubscribe(store, atom, listener, unsubscribe);
    } finally {
      if (doStartTransaction) {
        endTransaction(store);
      }
    }
  };
}

function getOnStoreUnsubscribe(
  store: StoreWithAtomsLogger,
  atom: AnyAtom,
  listener: () => void,
  unsubscribe: () => void,
): ReturnType<StoreWithAtomsLogger['sub']> {
  return function onStoreUnsubscribe() {
    const doStartTransaction = !store[ATOMS_LOGGER_SYMBOL].isInsideTransaction;
    try {
      if (doStartTransaction) {
        {
          startTransaction(store, {
            type: AtomsLoggerTransactionTypes.storeUnsubscribe,
            atom,
            listener,
          });
        }
      }
      unsubscribe();
    } finally {
      if (doStartTransaction) {
        endTransaction(store);
      }
    }
  };
}
