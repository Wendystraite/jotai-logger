import type { Atom } from 'jotai';
import type { INTERNAL_BuildingBlocks as BuildingBlocks } from 'jotai/vanilla/internals';

import { endTransaction } from '../transactions/end-transaction.js';
import { startTransaction } from '../transactions/start-transaction.js';
import type { AtomLoggerStoreState, Store } from '../types/store.js';
import { AtomTransactionTypes } from '../types/transaction.js';

export function onStoreGet<TValue>(
  store: Store,
  loggerState: AtomLoggerStoreState,
  parentBuildingBlocks: Readonly<BuildingBlocks>,
  buildingBlocks: Readonly<BuildingBlocks>,
  atom: Atom<TValue>,
): TValue {
  const doStartTransaction = !loggerState.isInsideTransaction;
  try {
    if (doStartTransaction) {
      startTransaction(loggerState, { type: AtomTransactionTypes.storeGet, atom });
    }
    const parentStoreGet = parentBuildingBlocks[21];
    return parentStoreGet(buildingBlocks, store, atom);
  } finally {
    if (doStartTransaction) {
      endTransaction(loggerState);
    }
  }
}
