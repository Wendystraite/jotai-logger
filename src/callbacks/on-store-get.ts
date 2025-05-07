import type { Atom } from 'jotai';

import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import { endTransaction } from '../transactions/end-transaction.js';
import { startTransaction } from '../transactions/start-transaction.js';
import type { StoreWithAtomsLogger } from '../types/atoms-logger.js';

export function getOnStoreGet(store: StoreWithAtomsLogger): StoreWithAtomsLogger['get'] {
  return function onStoreGet<TValue>(atom: Atom<TValue>): TValue {
    try {
      startTransaction(store, { storeGet: { atom } });
      return store[ATOMS_LOGGER_SYMBOL].prevStoreGet(atom);
    } finally {
      endTransaction(store);
    }
  };
}
