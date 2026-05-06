import {
  INTERNAL_buildStoreRev3 as buildStore,
  INTERNAL_getBuildingBlocksRev3 as getBuildingBlocks,
  INTERNAL_initializeStoreHooksRev3 as initializeStoreHooks,
  type INTERNAL_AtomStateMap as AtomStateMap,
  type INTERNAL_BuildingBlocks as BuildingBlocks,
} from 'jotai/vanilla/internals';

import { consoleFormatter } from '../formatters/console/index.js';
import { onAtomGarbageCollected } from './callbacks/on-atom-garbage-collected.js';
import { onAtomMounted } from './callbacks/on-atom-mounted.js';
import { onAtomStateMapSet } from './callbacks/on-atom-state-map-set.js';
import { onAtomUnmounted } from './callbacks/on-atom-unmounted.js';
import { onStoreGet } from './callbacks/on-store-get.js';
import { onStoreSet } from './callbacks/on-store-set.js';
import { onStoreSub } from './callbacks/on-store-sub.js';
import { atomLoggerStoreSymbol } from './consts/store-symbol.js';
import { createLogTransactionsScheduler } from './log-transactions-scheduler.js';
import type { AtomId } from './types/event.js';
import type { AtomLoggerOptions } from './types/options.js';
import type { Store, AtomLoggerStore, AtomLoggerStoreState } from './types/store.js';
import { atomLoggerOptionsToState } from './utils/logger-options-to-state.js';

/**
 * Create a new Jotai store that shares state with the given parent store but intercepts all `get`, `set` and `sub` calls to log atom transactions.
 *
 * The logged store state can be accessed via the `atomLoggerStoreSymbol` property on the returned store, which includes configuration options, transaction tracking state, and internal methods used by the logging implementation.
 * Theses options can be changed at runtime to enable/disable logging, change the formatter, etc.
 *
 * @param parentStore The parent Jotai store to derive from.
 * @param options Optional configuration for the atom logger.
 * @returns A new store that shares state with the parent but has logging enabled. It can be used in place of the parent store and will log all atom interactions performed through it.
 *
 * @throws If the provided parentStore is not a valid Jotai store.
 *
 * @example
 * ```ts
 * const parentStore = createStore();
 * const loggedStore = createLoggedStore(parentStore, { enabled: true });
 * loggedStore.get(someAtom); // This call will be logged.
 * ```
 */
export function createLoggedStore(
  parentStore: Store,
  options?: AtomLoggerOptions,
): AtomLoggerStore {
  const newStateOptions = atomLoggerOptionsToState(options);
  const formatter = options?.formatter ?? consoleFormatter();

  const parentBuildingBlocks = getBuildingBlocks(parentStore);
  const parentAtomStateMap = parentBuildingBlocks[0];

  // Declare buildingBlocks and loggerState early for closure access in callbacks before they are initialized below
  /* eslint-disable prefer-const */
  let buildingBlocks!: Readonly<BuildingBlocks>;
  const loggerState = {} as AtomLoggerStoreState;
  /* eslint-enable prefer-const */

  const atomStateMap: AtomStateMap = {
    get: parentAtomStateMap.get.bind(parentAtomStateMap),
    delete: parentAtomStateMap.delete.bind(parentAtomStateMap),
    has: parentAtomStateMap.has.bind(parentAtomStateMap),
    set(...args) {
      onAtomStateMapSet(loggedStore, loggerState, parentBuildingBlocks, buildingBlocks, ...args);
    },
  };

  const storeHooks = initializeStoreHooks({});

  storeHooks.m.add(undefined, (atom) => {
    onAtomMounted(loggerState, parentBuildingBlocks, atom);
  });
  storeHooks.u.add(undefined, (atom) => {
    onAtomUnmounted(loggerState, parentBuildingBlocks, atom);
  });

  const loggedStore = buildStore(
    atomStateMap,
    parentBuildingBlocks[1],
    parentBuildingBlocks[2],
    parentBuildingBlocks[3],
    parentBuildingBlocks[4],
    parentBuildingBlocks[5],
    storeHooks,
    parentBuildingBlocks[7],
    parentBuildingBlocks[8],
    parentBuildingBlocks[9],
    parentBuildingBlocks[10],
    parentBuildingBlocks[11],
    parentBuildingBlocks[12],
    parentBuildingBlocks[13],
    parentBuildingBlocks[14],
    parentBuildingBlocks[15],
    parentBuildingBlocks[16],
    parentBuildingBlocks[17],
    parentBuildingBlocks[18],
    parentBuildingBlocks[19],
    parentBuildingBlocks[20],
    (buildingBlocks, store, ...args) => {
      return onStoreGet(store, loggerState, parentBuildingBlocks, buildingBlocks, ...args);
    },
    (buildingBlocks, store, ...args) => {
      return onStoreSet(store, loggerState, parentBuildingBlocks, buildingBlocks, ...args);
    },
    (buildingBlocks, store, ...args) => {
      return onStoreSub(store, loggerState, parentBuildingBlocks, buildingBlocks, ...args);
    },
    parentBuildingBlocks[24],
    parentBuildingBlocks[25],
    parentBuildingBlocks[26],
    parentBuildingBlocks[27],
    parentBuildingBlocks[28],
  ) as AtomLoggerStore;

  buildingBlocks = getBuildingBlocks(loggedStore);

  const atomsFinalizationRegistry = new FinalizationRegistry<string>((atomId: AtomId) => {
    onAtomGarbageCollected(loggerState, parentBuildingBlocks, atomId);
  });

  const logTransactionsScheduler = createLogTransactionsScheduler(loggerState);

  Object.assign(loggerState, {
    ...newStateOptions,
    formatter,
    logTransactionsScheduler,
    transactionNumber: 1,
    currentTransaction: undefined,
    isInsideTransaction: false,
    atomsFinalizationRegistry,
    promisesResultsMap: new WeakMap(),
    dependenciesMap: new WeakMap(),
    prevTransactionDependenciesMap: new WeakMap(),
    transactionsDebounceTimeoutId: undefined,
  });

  loggedStore[atomLoggerStoreSymbol] = loggerState;

  return loggedStore;
}

export function isLoggedStore(store: Store): store is AtomLoggerStore {
  return atomLoggerStoreSymbol in store;
}
