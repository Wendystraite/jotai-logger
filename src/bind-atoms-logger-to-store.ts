import { INTERNAL_initializeStoreHooks } from 'jotai/vanilla/internals';

import { getOnAtomGarbageCollected } from './callbacks/on-atom-garbage-collected.js';
import { getOnAtomMounted } from './callbacks/on-atom-mounted.js';
import { getOnAtomStateMapSet as onAtomStateMapSet } from './callbacks/on-atom-state-map-set.js';
import { getOnAtomUnmounted } from './callbacks/on-atom-unmounted.js';
import { getOnDevtoolsMountedAdd } from './callbacks/on-devtools-mounted-add.js';
import { getOnDevtoolsMountedDelete } from './callbacks/on-devtools-mounted-delete.js';
import { getOnStoreGet } from './callbacks/on-store-get.js';
import { getOnStoreSet } from './callbacks/on-store-set.js';
import { getOnStoreSub } from './callbacks/on-store-sub.js';
import { ATOMS_LOGGER_SYMBOL } from './consts/atom-logger-symbol.js';
import { createLogTransactionsScheduler } from './log-transactions-scheduler.js';
import type {
  AnyAtom,
  AtomsLoggerOptions,
  Store,
  StoreWithAtomsLogger,
} from './types/atoms-logger.js';
import { getInternalBuildingBlocks } from './utils/get-internal-building-blocks.js';
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

  let buildingBlocks: ReturnType<typeof getInternalBuildingBlocks>;
  try {
    buildingBlocks = getInternalBuildingBlocks(store);
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

  const atomStateMap = buildingBlocks.atomStateMap;
  const devtoolsMountedAtoms = buildingBlocks.devtoolsMountedAtoms;
  const prevAtomStateMapSet = atomStateMap.set.bind(atomStateMap);
  atomStateMap.set = onAtomStateMapSet(storeWithAtomsLogger);

  let prevDevtoolsMountedAtomsAdd: Set<AnyAtom>['add'] | undefined;
  let prevDevtoolsMountedAtomsDelete: Set<AnyAtom>['delete'] | undefined;

  if (buildingBlocks.storeHooks) {
    const storeHooks = INTERNAL_initializeStoreHooks(buildingBlocks.storeHooks);
    storeHooks.m.add(undefined, getOnAtomMounted(storeWithAtomsLogger));
    storeHooks.u.add(undefined, getOnAtomUnmounted(storeWithAtomsLogger));
  } else if (devtoolsMountedAtoms) {
    prevDevtoolsMountedAtomsAdd = devtoolsMountedAtoms.add.bind(devtoolsMountedAtoms);
    prevDevtoolsMountedAtomsDelete = devtoolsMountedAtoms.delete.bind(devtoolsMountedAtoms);
    devtoolsMountedAtoms.add = getOnDevtoolsMountedAdd(storeWithAtomsLogger);
    devtoolsMountedAtoms.delete = getOnDevtoolsMountedDelete(storeWithAtomsLogger);
  }

  const logTransactionsScheduler = createLogTransactionsScheduler(storeWithAtomsLogger);

  storeWithAtomsLogger[ATOMS_LOGGER_SYMBOL] = {
    ...newStateOptions,
    prevStoreGet,
    prevStoreSet,
    prevStoreSub,
    prevAtomStateMapSet,
    prevDevtoolsMountedAtomsAdd,
    prevDevtoolsMountedAtomsDelete,
    getState: buildingBlocks.getState,
    getMounted: buildingBlocks.getMounted,
    logTransactionsScheduler,
    transactionNumber: 0,
    currentTransaction: undefined,
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
