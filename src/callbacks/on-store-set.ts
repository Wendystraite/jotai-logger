import type { WritableAtom } from 'jotai';

import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import { endTransaction } from '../transactions/end-transaction.js';
import { startTransaction } from '../transactions/start-transaction.js';
import type { StoreWithAtomsLogger } from '../types/atoms-logger.js';

export function getOnStoreSet(store: StoreWithAtomsLogger): StoreWithAtomsLogger['set'] {
  return function onStoreSet<TValue, TArgs extends unknown[], TResult>(
    atom: WritableAtom<TValue, TArgs, TResult>,
    ...args: TArgs
  ) {
    try {
      const transaction = { atom, args, result: undefined as unknown };
      startTransaction(store, { storeSet: transaction });
      const result = store[ATOMS_LOGGER_SYMBOL].prevStoreSet(atom, ...args);
      transaction.result = result;
      return result;
    } finally {
      endTransaction(store);
    }
  };
}
