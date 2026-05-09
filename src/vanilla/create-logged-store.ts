import {
  INTERNAL_buildStoreRev3 as buildStore,
  INTERNAL_getBuildingBlocksRev3 as getBuildingBlocks,
  INTERNAL_initializeStoreHooksRev3 as initializeStoreHooks,
} from 'jotai/vanilla/internals';

import { consoleFormatter } from '../formatters/console/index.js';
import { onAtomGarbageCollected } from './callbacks/on-atom-garbage-collected.js';
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
import { trackDependencies } from './hooks/track-dependencies.js';
import { trackDestroyed } from './hooks/track-destroyed.js';
import { trackMounted } from './hooks/track-mounted.js';
import { trackPendingPromises } from './hooks/track-pending-promises.js';
import { trackUnmounted } from './hooks/track-unmounted.js';
import { trackValueChanges } from './hooks/track-value-changes.js';
import { createLogTransactionsScheduler } from './log-transactions-scheduler.js';
import type { AtomId } from './types/event.js';
import type { AtomLoggerOptions } from './types/options.js';
import type { Store, AtomLoggerStoreState } from './types/store.js';

/**
 * Internal WeakMap to track which stores are logged stores created by {@link createLoggedStore}, and to access their logger state.
 */
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
    transactionsDebounceTimeoutId: undefined,
  };

  const parentBuildingBlocks = getBuildingBlocks(parentStore);
  const parentStoreGet = parentBuildingBlocks[21];
  const parentStoreSet = parentBuildingBlocks[22];
  const parentStoreSub = parentBuildingBlocks[23];

  const storeHooks = initializeStoreHooks({});

  const loggedStore = buildStore(
    parentBuildingBlocks[0],
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

  trackMounted(storeHooks, loggerState, buildingBlocks);
  trackUnmounted(storeHooks, loggerState, buildingBlocks);
  trackDestroyed(storeHooks, loggerState);
  trackDependencies(storeHooks, loggerState, buildingBlocks);
  trackValueChanges(storeHooks, loggedStore, loggerState, buildingBlocks);
  trackPendingPromises(storeHooks, loggerState, buildingBlocks);

  loggedStoreStates.set(loggedStore, loggerState);

  return loggedStore;
}

/**
 * Check if a given store is a logged store created by `createLoggedStore`.
 *
 * @param store The Jotai store to check.
 * @returns `true` if the store is a logged store created by `createLoggedStore`, `false` otherwise.
 */
export function isLoggedStore(store: Store): boolean {
  return loggedStoreStates.has(store);
}

/**
 * @internal Exposes the raw internal logger state.
 */
export function getLoggedStoreState(store: Store): AtomLoggerStoreState | undefined {
  return loggedStoreStates.get(store);
}

/**
 * Get the current logger options for a logged store. Returns `undefined` if the store is not a logged store.
 *
 * @remarks
 * The returned options object is the same mutable object that was passed to `createLoggedStore` (with defaults applied).
 * Modifying it will affect the behavior of the logger at runtime.
 *
 * @param store The Jotai store to get the logger options from.
 * @returns The current logger options for the logged store, or `undefined` if the store is not a logged store.
 */
export function getLoggedStoreOptions(store: Store): AtomLoggerOptions | undefined {
  const loggerState = getLoggedStoreState(store);
  return loggerState?.options;
}
