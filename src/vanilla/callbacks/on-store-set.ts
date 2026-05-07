import type { WritableAtom } from 'jotai';
import type { INTERNAL_BuildingBlocks as BuildingBlocks } from 'jotai/vanilla/internals';

import { endTransaction } from '../transactions/end-transaction.js';
import { startTransaction } from '../transactions/start-transaction.js';
import type { AtomLoggerStoreState, Store } from '../types/store.js';
import { AtomTransactionTypes } from '../types/transaction.js';

export function onStoreSet<TValue, TArgs extends unknown[], TResult>(
  parentStoreSet: BuildingBlocks[22],
  store: Store,
  buildingBlocks: Readonly<BuildingBlocks>,
  loggerState: AtomLoggerStoreState,
  atom: WritableAtom<TValue, TArgs, TResult>,
  ...args: TArgs
) {
  const doStartTransaction = !loggerState.isInsideTransaction;
  try {
    const transaction = {
      type: AtomTransactionTypes.storeSet,
      atom,
      args,
      result: undefined as unknown,
    };
    if (doStartTransaction) {
      startTransaction(loggerState, transaction);
    }
    const result = parentStoreSet(buildingBlocks, store, atom, ...args);
    transaction.result = result;
    return result;
  } finally {
    if (doStartTransaction) {
      endTransaction(loggerState);
    }
  }
}
