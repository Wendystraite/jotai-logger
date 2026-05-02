import type { Atom } from 'jotai';

import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import { endTransaction } from '../transactions/end-transaction.js';
import { startTransaction } from '../transactions/start-transaction.js';
import type { StoreWithAtomsLogger } from '../types/atoms-logger.js';
import { AtomTransactionTypes } from '../types/transaction.js';

export function getOnStoreGet(store: StoreWithAtomsLogger): StoreWithAtomsLogger['get'] {
  return function onStoreGet<TValue>(atom: Atom<TValue>): TValue {
    const doStartTransaction = !store[ATOMS_LOGGER_SYMBOL].isInsideTransaction;
    try {
      if (doStartTransaction) {
        startTransaction(store, { type: AtomTransactionTypes.storeGet, atom });
      }
      return store[ATOMS_LOGGER_SYMBOL].prevStoreGet(atom);
    } finally {
      if (doStartTransaction) {
        endTransaction(store);
      }
    }
  };
}
