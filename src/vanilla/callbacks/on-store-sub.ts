import type { INTERNAL_BuildingBlocks as BuildingBlocks } from 'jotai/vanilla/internals';

import { endTransaction } from '../transactions/end-transaction.js';
import { startTransaction } from '../transactions/start-transaction.js';
import type { AnyAtom } from '../types/event.js';
import type { AtomLoggerStoreState, Store } from '../types/store.js';
import { AtomTransactionTypes } from '../types/transaction.js';

export function onStoreSub(
  store: Store,
  loggerState: AtomLoggerStoreState,
  parentBuildingBlocks: Readonly<BuildingBlocks>,
  buildingBlocks: Readonly<BuildingBlocks>,
  atom: AnyAtom,
  listener: () => void,
): () => void {
  const doStartTransaction = !loggerState.isInsideTransaction;
  try {
    if (doStartTransaction) {
      startTransaction(loggerState, {
        type: AtomTransactionTypes.storeSubscribe,
        atom,
        listener,
      });
    }
    const parentStoreSub = parentBuildingBlocks[23];
    const unsubscribe = parentStoreSub(buildingBlocks, store, atom, listener);
    return () => {
      onStoreUnsubscribe(store, loggerState, buildingBlocks, atom, listener, unsubscribe);
    };
  } finally {
    if (doStartTransaction) {
      endTransaction(loggerState);
    }
  }
}

function onStoreUnsubscribe(
  store: Store,
  loggerState: AtomLoggerStoreState,
  buildingBlocks: Readonly<BuildingBlocks>,
  atom: AnyAtom,
  listener: () => void,
  unsubscribe: () => void,
) {
  const doStartTransaction = !loggerState.isInsideTransaction;
  try {
    if (doStartTransaction) {
      {
        startTransaction(loggerState, {
          type: AtomTransactionTypes.storeUnsubscribe,
          atom,
          listener,
        });
      }
    }
    unsubscribe();
  } finally {
    if (doStartTransaction) {
      endTransaction(loggerState);
    }
  }
}
