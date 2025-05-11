import {
  INTERNAL_getBuildingBlocksRev1,
  INTERNAL_initializeStoreHooks,
} from 'jotai/vanilla/internals';

import { getOnAtomGarbageCollected } from './callbacks/on-atom-garbage-collected.js';
import { getOnAtomMounted } from './callbacks/on-atom-mounted.js';
import { getOnAtomStateMapSet as onAtomStateMapSet } from './callbacks/on-atom-state-map-set.js';
import { getOnAtomUnmounted } from './callbacks/on-atom-unmounted.js';
import { getOnStoreGet } from './callbacks/on-store-get.js';
import { getOnStoreSet } from './callbacks/on-store-set.js';
import { getOnStoreSub } from './callbacks/on-store-sub.js';
import { ATOMS_LOGGER_SYMBOL } from './consts/atom-logger-symbol.js';
import type { AtomsLoggerOptions, Store, StoreWithAtomsLogger } from './types/atoms-logger.js';
import { atomsLoggerOptionsToState } from './utils/logger-options-to-state.js';

export function bindAtomsLoggerToStore(
  store: Store,
  options?: AtomsLoggerOptions,
): store is StoreWithAtomsLogger {
  const newStateOptions = atomsLoggerOptionsToState(options);

  const buildingBlocks = INTERNAL_getBuildingBlocksRev1(store) as
    | ReturnType<typeof INTERNAL_getBuildingBlocksRev1>
    | undefined;

  if (!buildingBlocks) {
    // If building blocks are not found, we cannot bind the logger to the store.
    const errorLogs = [
      'Fail to bind atoms logger to',
      store,
      ': internal building blocks not found.',
      'This can happen if the store is not a Jotai store or if it has been modified in some way.',
      'The most common case is that the store was created with a different version of Jotai by another library like jotai-devtools and the symbol used to as key for the internal building blocks is different.',
    ];
    newStateOptions.logger.log(...errorLogs);
    return false;
  }

  const storeWithAtomsLogger = store as StoreWithAtomsLogger;

  if (newStateOptions.enableDebugMode) {
    newStateOptions.logger.log('Atoms logger bound to', store, 'with options', newStateOptions);
  }

  const prevStoreGet = store.get;
  const prevStoreSet = store.set;
  const prevStoreSub = store.sub;

  store.get = getOnStoreGet(storeWithAtomsLogger);
  store.set = getOnStoreSet(storeWithAtomsLogger);
  store.sub = getOnStoreSub(storeWithAtomsLogger);

  const storeHooks = INTERNAL_initializeStoreHooks(buildingBlocks[6]);
  const atomStateMap = buildingBlocks[0];

  const atomsFinalizationRegistry = new FinalizationRegistry<string>(
    getOnAtomGarbageCollected(storeWithAtomsLogger),
  );

  const prevAtomStateMapSet = atomStateMap.set.bind(atomStateMap);
  atomStateMap.set = onAtomStateMapSet(storeWithAtomsLogger);

  storeHooks.m.add(undefined, getOnAtomMounted(storeWithAtomsLogger));
  storeHooks.u.add(undefined, getOnAtomUnmounted(storeWithAtomsLogger));

  storeWithAtomsLogger[ATOMS_LOGGER_SYMBOL] = {
    ...newStateOptions,
    prevStoreGet,
    prevStoreSet,
    prevStoreSub,
    prevAtomStateMapSet,
    transactionNumber: 0,
    currentTransaction: undefined,
    atomsFinalizationRegistry,
    promisesResultsMap: new WeakMap(),
    transactionsDebounceTimeoutId: undefined,
  };

  return true;
}

export function isAtomsLoggerBoundToStore(store: Store): store is StoreWithAtomsLogger {
  return ATOMS_LOGGER_SYMBOL in store;
}
