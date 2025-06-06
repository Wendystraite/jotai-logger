import type { Atom } from 'jotai';

import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import { endTransaction } from '../transactions/end-transaction.js';
import { startTransaction } from '../transactions/start-transaction.js';
import { AtomsLoggerTransactionTypes, type StoreWithAtomsLogger } from '../types/atoms-logger.js';

export function getOnStoreGet(store: StoreWithAtomsLogger): StoreWithAtomsLogger['get'] {
  return function onStoreGet<TValue>(atom: Atom<TValue>): TValue {
    const doStartTransaction = !store[ATOMS_LOGGER_SYMBOL].isInsideTransaction;
    try {
      if (doStartTransaction) {
        startTransaction(store, { type: AtomsLoggerTransactionTypes.storeGet, atom });
      }
      return store[ATOMS_LOGGER_SYMBOL].prevStoreGet(atom);
    } finally {
      if (doStartTransaction) {
        endTransaction(store);
      }
    }
  };
}
