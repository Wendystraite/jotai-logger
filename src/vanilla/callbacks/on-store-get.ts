import type { Atom } from 'jotai';
import type { INTERNAL_BuildingBlocks as BuildingBlocks } from 'jotai/vanilla/internals';

import { endTransaction } from '../transactions/end-transaction.js';
import { startTransaction } from '../transactions/start-transaction.js';
import type { AtomLoggerStoreState, Store } from '../types/store.js';
import { AtomTransactionTypes } from '../types/transaction.js';

export function onStoreGet<TValue>(
  parentStoreGet: BuildingBlocks[21],
  store: Store,
  buildingBlocks: Readonly<BuildingBlocks>,
  loggerState: AtomLoggerStoreState,
  atom: Atom<TValue>,
): TValue {
  const doStartTransaction = !loggerState.isInsideTransaction;
  try {
    if (doStartTransaction) {
      startTransaction(loggerState, { type: AtomTransactionTypes.storeGet, atom });
    }
    return parentStoreGet(buildingBlocks, store, atom);
  } finally {
    if (doStartTransaction) {
      endTransaction(loggerState);
    }
  }
}
