import type { Atom, useStore } from 'jotai';
import type {
  INTERNAL_AtomState as AtomState,
  INTERNAL_AtomStateMap as AtomStateMap,
  INTERNAL_BuildingBlocks as BuildingBlocks,
  INTERNAL_Mounted as Mounted,
} from 'jotai/vanilla/internals';

import type { atomLoggerStoreSymbol } from '../consts/store-symbol.js';
import type { AnyAtom, AtomId } from './event.js';
import type { AtomLoggerFormatter } from './formatter.js';
import type { AtomTransaction } from './transaction.js';

/**
 * Jotai's store.
 */
export type Store = ReturnType<typeof useStore>;

/**
 * Type of the store with the logger attached.
 */
export type AtomLoggerStore = Store & {
  [atomLoggerStoreSymbol]: AtomLoggerStoreState;
};

/**
 * Internal state of the logger.
 *
 * Contains configuration options, transaction tracking, and references to original store methods.
 */
export type AtomLoggerStoreState = AtomLoggerOptionsInStoreState & {
  /** Internal method to register abort handlers for promises */
  registerAbortHandler: BuildingBlocks[26];
  /** Incremental counter for transactions */
  transactionNumber: number;
  /** The currently active transaction being tracked, if any */
  currentTransaction: AtomTransaction | undefined;
  /** Flag to indicate if the logger is currently processing a transaction (not debouncing) */
  isInsideTransaction: boolean;
  /** FinalizationRegistry that register atoms garbage collection */
  atomsFinalizationRegistry: FinalizationRegistry<AtomId>;
  /** Map to track the values of promises */
  promisesResultsMap: WeakMap<PromiseLike<unknown>, unknown>;
  /** Map to track the previous dependencies of atoms since last transaction */
  prevTransactionDependenciesMap: WeakMap<AnyAtom, Set<AtomId>>;
  /** Map to track the dependencies of atoms */
  dependenciesMap: WeakMap<AnyAtom, Set<AtomId>>;
  /** Timeout id of the current transaction if started independently (not triggered by a store update) */
  transactionsDebounceTimeoutId: ReturnType<typeof setTimeout> | undefined;
  /** Scheduler for logging queued transactions */
  logTransactionsScheduler: {
    /** Queue of transactions to be logged */
    queue: AtomTransaction[];
    /** Flag to indicate if the scheduler is currently processing */
    isProcessing: boolean;
    /** Process the next transaction in the queue */
    process: () => void;
    /** Add a transaction to the queue and process it */
    add: (transaction: AtomTransaction) => void;
  };
  /** Underlying store.get implementation (bypasses the logging wrapper) */
  prevStoreGet: BuildingBlocks[21];
  /** Underlying store.set implementation (bypasses the logging wrapper) */
  prevStoreSet: BuildingBlocks[22];
  /** Underlying store.sub implementation (bypasses the logging wrapper) */
  prevStoreSub: BuildingBlocks[23];
  /** Underlying atom state map setter method */
  prevAtomStateMapSet: AtomStateMap['set'];
  /** Return the state of an atom */
  getState(this: void, atom: AnyAtom): AtomState | undefined;
  /** Return the mounted state of an atom */
  getMounted(this: void, atom: AnyAtom): Mounted | undefined;
};

/**
 * Core logger options stored in the logger's state.
 * @see {@link AtomLoggerOptions} for the public API.
 */
export interface AtomLoggerOptionsInStoreState {
  /** @see AtomLoggerOptions.enabled */
  enabled: boolean;

  /** @see AtomLoggerOptions.shouldShowPrivateAtoms */
  shouldShowPrivateAtoms: boolean;

  /** @see AtomLoggerOptions.shouldShowAtom */
  shouldShowAtom: ((atom: Atom<unknown>) => boolean) | undefined;

  /** @see AtomLoggerOptions.getOwnerStack */
  getOwnerStack?(this: void): string | null | undefined;

  /** @see AtomLoggerOptions.getComponentDisplayName */
  getComponentDisplayName?(this: void): string | undefined;

  /** @see AtomLoggerOptions.transactionDebounceMs */
  transactionDebounceMs: number;

  /** @see AtomLoggerOptions.requestIdleCallbackTimeoutMs */
  requestIdleCallbackTimeoutMs: number;

  /** @see AtomLoggerOptions.maxProcessingTimeMs */
  maxProcessingTimeMs: number;

  /** The formatter to call when a transaction is ready to be output. */
  formatter: AtomLoggerFormatter;
}
