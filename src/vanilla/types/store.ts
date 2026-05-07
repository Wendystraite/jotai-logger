import type { useStore } from 'jotai';

import type { AnyAtom, AtomId } from './event.js';
import type { AtomLoggerOptions } from './options.js';
import type { AtomTransaction } from './transaction.js';

/**
 * Jotai's store.
 */
export type Store = ReturnType<typeof useStore>;

/**
 * Internal state of the logger.
 */
export interface AtomLoggerStoreState {
  /** The logger's options. Can be mutated at runtime to change logger behavior. */
  options: AtomLoggerOptions;
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
}
