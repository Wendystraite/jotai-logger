import { atomLoggerStoreSymbol } from '../consts/store-symbol.js';
import { endTransaction } from '../transactions/end-transaction.js';
import { startTransaction } from '../transactions/start-transaction.js';
import type { AnyAtom } from '../types/event.js';
import type { AtomLoggerStore } from '../types/store.js';
import { AtomTransactionTypes } from '../types/transaction.js';

export function onStoreSub(
  store: AtomLoggerStore,
  atom: AnyAtom,
  listener: () => void,
): () => void {
  const doStartTransaction = !store[atomLoggerStoreSymbol].isInsideTransaction;
  try {
    if (doStartTransaction) {
      startTransaction(store, {
        type: AtomTransactionTypes.storeSubscribe,
        atom,
        listener,
      });
    }
    const parentStoreSub = store[atomLoggerStoreSymbol].parentBuildingBlocks[23];
    const unsubscribe = parentStoreSub(
      store[atomLoggerStoreSymbol].buildingBlocks,
      store,
      atom,
      listener,
    );
    return () => {
      onStoreUnsubscribe(store, atom, listener, unsubscribe);
    };
  } finally {
    if (doStartTransaction) {
      endTransaction(store);
    }
  }
}

function onStoreUnsubscribe(
  store: AtomLoggerStore,
  atom: AnyAtom,
  listener: () => void,
  unsubscribe: () => void,
) {
  const doStartTransaction = !store[atomLoggerStoreSymbol].isInsideTransaction;
  try {
    if (doStartTransaction) {
      {
        startTransaction(store, {
          type: AtomTransactionTypes.storeUnsubscribe,
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
}
