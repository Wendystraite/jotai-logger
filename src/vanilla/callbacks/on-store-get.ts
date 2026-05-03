import type { Atom } from 'jotai';

import { atomLoggerStoreSymbol } from '../consts/store-symbol.js';
import { endTransaction } from '../transactions/end-transaction.js';
import { startTransaction } from '../transactions/start-transaction.js';
import type { AtomLoggerStore } from '../types/store.js';
import { AtomTransactionTypes } from '../types/transaction.js';

export function onStoreGet<TValue>(store: AtomLoggerStore, atom: Atom<TValue>): TValue {
  const doStartTransaction = !store[atomLoggerStoreSymbol].isInsideTransaction;
  try {
    if (doStartTransaction) {
      startTransaction(store, { type: AtomTransactionTypes.storeGet, atom });
    }
    return store[atomLoggerStoreSymbol].prevStoreGet(
      store[atomLoggerStoreSymbol].buildingBlocks,
      store,
      atom,
    );
  } finally {
    if (doStartTransaction) {
      endTransaction(store);
    }
  }
}
