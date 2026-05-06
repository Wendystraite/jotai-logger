import type { WritableAtom } from 'jotai';

import { atomLoggerStoreSymbol } from '../consts/store-symbol.js';
import { endTransaction } from '../transactions/end-transaction.js';
import { startTransaction } from '../transactions/start-transaction.js';
import type { AtomLoggerStore } from '../types/store.js';
import { AtomTransactionTypes } from '../types/transaction.js';

export function onStoreSet<TValue, TArgs extends unknown[], TResult>(
  store: AtomLoggerStore,
  atom: WritableAtom<TValue, TArgs, TResult>,
  ...args: TArgs
) {
  const doStartTransaction = !store[atomLoggerStoreSymbol].isInsideTransaction;
  try {
    const transaction = {
      type: AtomTransactionTypes.storeSet,
      atom,
      args,
      result: undefined as unknown,
    };
    if (doStartTransaction) {
      startTransaction(store, transaction);
    }
    const storeSet = store[atomLoggerStoreSymbol].parentBuildingBlocks[22];
    const result = storeSet(store[atomLoggerStoreSymbol].buildingBlocks, store, atom, ...args);
    transaction.result = result;
    return result;
  } finally {
    if (doStartTransaction) {
      endTransaction(store);
    }
  }
}
