import {
  INTERNAL_getBuildingBlocksRev2,
  INTERNAL_initializeStoreHooksRev2,
  type INTERNAL_BuildingBlocks,
} from 'jotai/vanilla/internals';

import { getOnAtomGarbageCollected } from './callbacks/on-atom-garbage-collected.js';
import { getOnAtomMounted } from './callbacks/on-atom-mounted.js';
import { getOnAtomStateMapSet as onAtomStateMapSet } from './callbacks/on-atom-state-map-set.js';
import { getOnAtomUnmounted } from './callbacks/on-atom-unmounted.js';
import { getOnStoreGet } from './callbacks/on-store-get.js';
import { getOnStoreSet } from './callbacks/on-store-set.js';
import { getOnStoreSub } from './callbacks/on-store-sub.js';
import { ATOMS_LOGGER_SYMBOL } from './consts/atom-logger-symbol.js';
import { createLogTransactionsScheduler } from './log-transactions-scheduler.js';
import type { AtomsLoggerOptions, Store, StoreWithAtomsLogger } from './types/atoms-logger.js';
import { atomsLoggerOptionsToState } from './utils/logger-options-to-state.js';

export function bindAtomsLoggerToStore(
  store: Store,
  options?: AtomsLoggerOptions,
): store is StoreWithAtomsLogger {
  const newStateOptions = atomsLoggerOptionsToState(options);

  if (isAtomsLoggerBoundToStore(store)) {
    Object.assign(store[ATOMS_LOGGER_SYMBOL], newStateOptions);
    return true;
  }

  let buildingBlocks: Readonly<INTERNAL_BuildingBlocks>;
  try {
    buildingBlocks = INTERNAL_getBuildingBlocksRev2(store);
  } catch (error) {
    newStateOptions.logger.log('Fail to bind atoms logger to', store, ':', error);
    return false;
  }

  const storeWithAtomsLogger = store as StoreWithAtomsLogger;

  const prevStoreGet = store.get;
  const prevStoreSet = store.set;
  const prevStoreSub = store.sub;

  store.get = getOnStoreGet(storeWithAtomsLogger);
  store.set = getOnStoreSet(storeWithAtomsLogger);
  store.sub = getOnStoreSub(storeWithAtomsLogger);

  const atomsFinalizationRegistry = new FinalizationRegistry<string>(
    getOnAtomGarbageCollected(storeWithAtomsLogger),
  );

  const atomStateMap = buildingBlocks[0];
  const mountedMap = buildingBlocks[1];

  const prevAtomStateMapSet = atomStateMap.set.bind(atomStateMap);
  atomStateMap.set = onAtomStateMapSet(storeWithAtomsLogger);

  const storeHooks = INTERNAL_initializeStoreHooksRev2(buildingBlocks[6]);
  storeHooks.m.add(undefined, getOnAtomMounted(storeWithAtomsLogger));
  storeHooks.u.add(undefined, getOnAtomUnmounted(storeWithAtomsLogger));

  const getState = atomStateMap.get.bind(atomStateMap);
  const getMounted = mountedMap.get.bind(mountedMap);

  const logTransactionsScheduler = createLogTransactionsScheduler(storeWithAtomsLogger);

  storeWithAtomsLogger[ATOMS_LOGGER_SYMBOL] = {
    ...newStateOptions,
    prevStoreGet,
    prevStoreSet,
    prevStoreSub,
    prevAtomStateMapSet,
    getState,
    getMounted,
    logTransactionsScheduler,
    transactionNumber: 1,
    currentTransaction: undefined,
    isInsideTransaction: false,
    atomsFinalizationRegistry,
    promisesResultsMap: new WeakMap(),
    dependenciesMap: new WeakMap(),
    prevTransactionDependenciesMap: new WeakMap(),
    transactionsDebounceTimeoutId: undefined,
  };

  return true;
}

export function isAtomsLoggerBoundToStore(store: Store): store is StoreWithAtomsLogger {
  return ATOMS_LOGGER_SYMBOL in store;
}
