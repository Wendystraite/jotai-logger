import {
  INTERNAL_buildStoreRev3 as buildStore,
  INTERNAL_getBuildingBlocksRev3 as getBuildingBlocks,
  INTERNAL_initializeStoreHooksRev3 as initializeStoreHooks,
  type INTERNAL_AtomStateMap as AtomStateMap,
} from 'jotai/vanilla/internals';

import { consoleFormatter } from '../formatters/console/index.js';
import { onAtomGarbageCollected } from './callbacks/on-atom-garbage-collected.js';
import { onAtomMounted } from './callbacks/on-atom-mounted.js';
import { onAtomStateMapSet } from './callbacks/on-atom-state-map-set.js';
import { onAtomUnmounted } from './callbacks/on-atom-unmounted.js';
import { onStoreGet } from './callbacks/on-store-get.js';
import { onStoreSet } from './callbacks/on-store-set.js';
import { onStoreSub } from './callbacks/on-store-sub.js';
import {
  DEFAULT_ENABLED,
  DEFAULT_MAX_PROCESSING_TIME_MS,
  DEFAULT_REQUEST_IDLE_CALLBACK_TIMEOUT_MS,
  DEFAULT_SHOULD_SHOW_PRIVATE_ATOMS,
  DEFAULT_SYNCHRONOUS,
  DEFAULT_TRANSACTION_DEBOUNCE_MS,
} from './consts/default-options.js';
import { createLogTransactionsScheduler } from './log-transactions-scheduler.js';
import type { AtomId } from './types/event.js';
import type { AtomLoggerOptions } from './types/options.js';
import type { Store, AtomLoggerStoreState } from './types/store.js';

const loggedStoreStates = new WeakMap<Store, AtomLoggerStoreState>();

/**
 * Create a new Jotai store that shares state with the given parent store but intercepts all `get`, `set` and `sub` calls to log atom transactions.
 *
 * @param parentStore The parent Jotai store to derive from.
 * @param options Mutable options object for the atom logger. Defaults are applied in-place.
 * @returns A new store that shares state with the parent but has logging enabled.
 *
 * @throws If the provided parentStore is not a valid Jotai store.
 *
 * @example
 * ```ts
 * const parentStore = createStore();
 * const options = { enabled: true };
 * const loggedStore = createLoggedStore(parentStore, options);
 * loggedStore.get(someAtom); // This call will be logged.
 * options.enabled = false;   // Disable logging at runtime.
 * ```
 */
export function createLoggedStore(parentStore: Store, options: AtomLoggerOptions = {}): Store {
  options.enabled ??= DEFAULT_ENABLED;
  options.shouldShowPrivateAtoms ??= DEFAULT_SHOULD_SHOW_PRIVATE_ATOMS;
  options.synchronous ??= DEFAULT_SYNCHRONOUS;
  options.transactionDebounceMs ??= DEFAULT_TRANSACTION_DEBOUNCE_MS;
  options.requestIdleCallbackTimeoutMs ??= DEFAULT_REQUEST_IDLE_CALLBACK_TIMEOUT_MS;
  options.maxProcessingTimeMs ??= DEFAULT_MAX_PROCESSING_TIME_MS;
  options.formatter ??= consoleFormatter();

  const logTransactionsScheduler = createLogTransactionsScheduler(options);

  const atomsFinalizationRegistry = new FinalizationRegistry<string>((atomId: AtomId) => {
    onAtomGarbageCollected(loggerState, buildingBlocks, atomId);
  });

  const loggerState: AtomLoggerStoreState = {
    options,
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

  const parentBuildingBlocks = getBuildingBlocks(parentStore);
  const parentAtomStateMap = parentBuildingBlocks[0];
  const parentStoreGet = parentBuildingBlocks[21];
  const parentStoreSet = parentBuildingBlocks[22];
  const parentStoreSub = parentBuildingBlocks[23];

  const atomStateMap: AtomStateMap = {
    get: parentAtomStateMap.get.bind(parentAtomStateMap),
    delete: parentAtomStateMap.delete.bind(parentAtomStateMap),
    has: parentAtomStateMap.has.bind(parentAtomStateMap),
    set(...args) {
      onAtomStateMapSet(parentAtomStateMap, loggedStore, buildingBlocks, loggerState, ...args);
    },
  };

  const storeHooks = initializeStoreHooks({});

  storeHooks.m.add(undefined, (atom) => {
    onAtomMounted(loggerState, buildingBlocks, atom);
  });
  storeHooks.u.add(undefined, (atom) => {
    onAtomUnmounted(loggerState, buildingBlocks, atom);
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
      return onStoreGet(parentStoreGet, store, buildingBlocks, loggerState, ...args);
    },
    (buildingBlocks, store, ...args) => {
      return onStoreSet(parentStoreSet, store, buildingBlocks, loggerState, ...args);
    },
    (buildingBlocks, store, ...args) => {
      return onStoreSub(parentStoreSub, store, buildingBlocks, loggerState, ...args);
    },
    parentBuildingBlocks[24],
    parentBuildingBlocks[25],
    parentBuildingBlocks[26],
    parentBuildingBlocks[27],
    parentBuildingBlocks[28],
  );

  const buildingBlocks = getBuildingBlocks(loggedStore);

  loggedStoreStates.set(loggedStore, loggerState);

  return loggedStore;
}

export function isLoggedStore(store: Store): boolean {
  return loggedStoreStates.has(store);
}

export function getLoggedStoreState(store: Store): AtomLoggerStoreState | undefined {
  return loggedStoreStates.get(store);
}

export function getLoggedStoreOptions(store: Store): AtomLoggerOptions | undefined {
  const loggerState = getLoggedStoreState(store);
  return loggerState?.options;
}
