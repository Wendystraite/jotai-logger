import type { Atom, useStore } from 'jotai';
import type {
  INTERNAL_AtomState,
  INTERNAL_AtomStateMap,
  INTERNAL_Mounted,
} from 'jotai/vanilla/internals';

import type { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';

/**
 * Jotai's store.
 */
export type Store = ReturnType<typeof useStore>;

/**
 * Type of the store with the logger attached.
 */
export type StoreWithAtomsLogger = Store & {
  [ATOMS_LOGGER_SYMBOL]: AtomsLoggerState;
};

/**
 * String representation of an atom.
 */
export type AtomId = ReturnType<AnyAtom['toString']>;

/**
 * Generic atom type.
 */
export type AnyAtom = Atom<unknown>;

/**
 * Internal state of the logger.
 *
 * Contains configuration options, transaction tracking, and references to original store methods.
 */
export type AtomsLoggerState = AtomsLoggerOptionsInState & {
  /** Incremental counter for transactions */
  transactionNumber: number;
  /** The currently active transaction being tracked, if any */
  currentTransaction: AtomsLoggerTransactionMap | undefined;
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
    queue: AtomsLoggerTransactionMap[];
    /** Flag to indicate if the scheduler is currently processing */
    isProcessing: boolean;
    /** Process the next transaction in the queue */
    process: () => void;
    /** Add a transaction to the queue and process it */
    add: (transactionMap: AtomsLoggerTransactionMap) => void;
  };
  /** Previous overridden store.get method */
  prevStoreGet: StoreWithAtomsLogger['get'];
  /** Previous overridden store.set method */
  prevStoreSet: StoreWithAtomsLogger['set'];
  /** Previous overridden store.sub method */
  prevStoreSub: StoreWithAtomsLogger['sub'];
  /** Previous overridden atom state map setter method */
  prevAtomStateMapSet: INTERNAL_AtomStateMap['set'];
  /** Previous overridden jotai dev store mounted atoms add method */
  prevDevtoolsMountedAtomsAdd: Set<AnyAtom>['add'] | undefined;
  /** Previous overridden jotai dev store mounted atoms delete method */
  prevDevtoolsMountedAtomsDelete: Set<AnyAtom>['delete'] | undefined;
  /** Return the state of an atom */
  getState(this: void, atom: AnyAtom): INTERNAL_AtomState | undefined;
  /** Return the mounted state of an atom */
  getMounted(this: void, atom: AnyAtom): INTERNAL_Mounted | undefined;
};

/**
 * Logger options stored in the logger's state
 * @see {@link AtomsLoggerOptions} for the public API.
 */
export interface AtomsLoggerOptionsInState {
  /** @see AtomsLoggerOptions.enabled */
  enabled: boolean;

  /** @see AtomsLoggerOptions.domain */
  domain: string | undefined;

  /** @see AtomsLoggerOptions.shouldShowPrivateAtoms */
  shouldShowPrivateAtoms: boolean;

  /** @see AtomsLoggerOptions.shouldShowAtom */
  shouldShowAtom: ((atom: Atom<unknown>) => boolean) | undefined;

  /** @see AtomsLoggerOptions.logger */
  logger: Pick<Console, 'log'> & Partial<Pick<Console, 'group' | 'groupCollapsed' | 'groupEnd'>>;

  /** @see AtomsLoggerOptions.groupLogs */
  groupLogs: boolean;

  /** @see AtomsLoggerOptions.indentSpaces */
  indentSpaces: number;

  /** @see AtomsLoggerOptions.indentSpaces */
  indentSpacesDepth1: string;

  /** @see AtomsLoggerOptions.indentSpaces */
  indentSpacesDepth2: string;

  /** @see AtomsLoggerOptions.formattedOutput */
  formattedOutput: boolean;

  /** @see AtomsLoggerOptions.colorScheme */
  colorScheme: 'default' | 'light' | 'dark';

  /** @see AtomsLoggerOptions.stringifyLimit */
  stringifyLimit: number;

  /** @see AtomsLoggerOptions.stringifyValues */
  stringifyValues: boolean;

  /** @see AtomsLoggerOptions.stringify */
  stringify: ((this: void, value: unknown) => string) | undefined;

  /** @see AtomsLoggerOptions.showTransactionNumber */
  showTransactionNumber: boolean;

  /** @see AtomsLoggerOptions.showTransactionLocaleTime */
  showTransactionLocaleTime: boolean;

  /** @see AtomsLoggerOptions.showTransactionElapsedTime */
  showTransactionElapsedTime: boolean;

  /** @see AtomsLoggerOptions.collapseTransactions */
  collapseTransactions: boolean;

  /** @see AtomsLoggerOptions.collapseEvents */
  collapseEvents: boolean;

  /** @see AtomsLoggerOptions.getStackTrace */
  getStackTrace?(): StackFrame[] | undefined | Promise<StackFrame[] | undefined>;
}

/**
 * Options for the atoms logger.
 */
export interface AtomsLoggerOptions {
  /**
   * Enable or disable the logger.
   *
   * @default true
   */
  enabled?: boolean;

  /**
   * Domain to use for the logger.
   *
   * The domain is used to identify the logger in the console.
   * It is prefixed to the transaction number.
   *
   * - If not provided, the transaction log will look like : `transaction 1 - 12:00:00 - 2.00ms`
   * - If provided, the transaction log will look like : `domain - transaction 1 - 12:00:00 - 2.00ms`
   */
  domain?: string;

  /**
   * Whether to show private atoms in the console.
   *
   * Private are atoms that are used by Jotai libraries internally to manage state.
   * They're often used internally in atoms like `atomWithStorage` or `atomWithLocation`, etc. to manage state.
   * They are determined by the `debugPrivate` property of the atom.
   *
   * @default false
   */
  shouldShowPrivateAtoms?: boolean;

  /**
   * Function to determine whether to show a specific atom in the console.
   *
   * This is useful for filtering out atoms that you don't want to see in the console.
   *
   * `shouldShowPrivateAtoms` takes precedence over this option.
   *
   * @example
   * ```ts
   * // Show all atoms that have a debug label
   * const shouldShowAtom = (atom: Atom<unknown>) => atom.debugLabel !== undefined;
   * useAtomsLogger({ shouldShowAtom });
   *
   * // Don't show a specific atom
   * const verboseAtom = atom(0);
   * const shouldShowAtom = (atom: Atom<unknown>) => atom !== verboseAtom;
   * useAtomsLogger({ shouldShowAtom });
   *
   * // Dont show an atom with a specific property
   * const verboseAtom = atom(0);
   * verboseAtom.debugLabel = 'verbose';
   * Object.assign(verboseAtom, { canLog: false });
   * const shouldShowAtom = (atom: Atom<unknown>) => !('canLog' in atom) || atom.canLog === true;
   * useAtomsLogger({ shouldShowAtom });
   * ```
   */
  shouldShowAtom?(this: void, atom: Atom<unknown>): boolean;

  /**
   * Custom logger to use.
   *
   * By default, it uses the `console` global object.
   *
   * If either `groupLogs` is `false` or `logger.group` and `logger.groupEnd` are not provided, logs will not be grouped.
   *
   * @default console
   */
  logger?: Pick<Console, 'log'> & Partial<Pick<Console, 'group' | 'groupCollapsed' | 'groupEnd'>>;

  /**
   * Whether to group logs with `logger.group` and `logger.groupEnd`.
   *
   * - If set to `true`, logs will be grouped using `logger.group`, `logger.groupCollapsed` and `logger.groupEnd`.
   * - If set to `false`, only `logger.log` will be used.
   *   This can be useful if using a custom `logger` that doesn't support grouping or for testing purposes.
   *
   * @default true
   */
  groupLogs?: boolean;

  /**
   * Number of spaces to use for each level of indentation in the logs.
   *
   * Set to 0 to disable indentation completely.
   *
   * @default 0
   */
  indentSpaces?: number;

  /**
   * Whether to use colors/formatting in the console.
   *
   * - If set to `true`, the logger will use formatted and colorized output using [the browser console's string substitutions](https://developer.mozilla.org/en-US/docs/Web/API/console#using_string_substitutions) (%c / %o).
   *   This works with the `colorScheme` option to determine the colors to use.
   * - If set to `false`, the logger will use plain texts without formatting.
   *
   * This is useful for testing purposes or if you want to use the logger in a non-browser environment.
   *
   * @default true
   */
  formattedOutput?: boolean;

  /**
   * Color scheme to use for the logger.
   *
   * This is used to determine the colors of the logs in the console.
   * The default color scheme uses colors that are easy to read in both light and dark mode.
   *
   * - If `default`, the logger will use the colors that are easy to read in both light and dark mode. If will **NOT** use the system preference.
   * - If `light`, the logger will use the colors that are easy to read in light mode.
   * - If `dark`, the logger will use the colors that are easy to read in dark mode.
   *
   * See example bellow if you want the colors to be automatically determined based on the user's system preference using `window.matchMedia`.
   *
   * This option has no effect if `formattedOutput` is set to `false`.
   *
   * @default "default"
   *
   * @example
   * ```ts
   * // If you want the colors to be automatically determined based on the user's system preference
   * useAtomsLogger({ colorScheme: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light" });
   *
   * // If you want the color to be specified in an environment variable (in vite)
   * useAtomsLogger({ colorScheme: import.meta.env.VITE_ATOMS_LOGGER_COLOR_SCHEME });
   * ```
   */
  colorScheme?: 'default' | 'light' | 'dark';

  /**
   * Maximum length of any logged stringified data.
   *
   * This includes the state of atoms, the arguments and results of atoms setter methods, etc.
   *
   * If the string is longer, it will be truncated and appended with '…'.
   * Use 0 for no limit.
   *
   * @default 50
   */
  stringifyLimit?: number;

  /**
   * Whether to stringify data in the logs.
   *
   * This includes the state of atoms, the arguments and results of atoms
   * setter methods, etc.
   *
   * - If set to `true`, the logged data will be stringified using `stringify` with a maximum length of `stringifyLimit`.
   * - If set to `false`, the logged data will be logged as is.
   *
   * @default true
   */
  stringifyValues?: boolean;

  /**
   * Custom function to stringify data in the logs.
   *
   * This includes the state of atoms, the arguments and results of atoms
   * setter methods, etc.
   *
   * If not provided, a basic stringification using `toString()` and `JSON.stringify` will be used.
   * This makes the logger library agnostic to the stringification library used.
   *
   * `stringifyLimit` is still applied to the output of this function.
   *
   * @example
   * ```ts
   * // Example using Jest's / Vitest's pretty-format:
   * import { format as prettyFormat } from '@vitest/pretty-format';
   * useAtomsLogger({
   *   stringify(value) {
   *     return prettyFormat(value, { min: true, maxDepth: 3, maxWidth: 5 });
   *   }
   * });
   * ```
   */
  stringify?(this: void, value: unknown): string;

  /**
   * Whether to show the transaction number in the console.
   *
   * - If set to `true`, the transaction log will look like : `transaction 1 - 12:00:00 - 2.00 ms`
   * - If set to `false`, the transaction log will look like : `12:00:00 - 2.00 ms`
   *
   * @default true
   */
  showTransactionNumber?: boolean;

  /**
   * Whether to show when a transaction started in the console.
   *
   * - If set to `true`, the transaction log will look like : `transaction 1 - 12:00:00 - 2.00 ms`
   * - If set to `false`, the transaction log will look like : `transaction 1 - 2.00 ms`
   *
   * @default false
   */
  showTransactionLocaleTime?: boolean;

  /**
   * Whether to show the elapsed time of a transaction in the console.
   *
   * - If set to `true`, the transaction log will look like : `transaction 1 - 12:00:00 - 2.00 ms`
   * - If set to `false`, the transaction log will look like : `transaction 1 - 12:00:00`
   *
   * @default true
   */
  showTransactionElapsedTime?: boolean;

  /**
   * Whether to collapse grouped transaction logs by default using `logger.groupCollapsed` instead of `logger.group`.
   *
   * This is useful for reducing clutter in the console.
   *
   * @default false
   */
  collapseTransactions?: boolean;

  /**
   * Whether to collapse grouped events logs by default using `logger.groupCollapsed` instead of `logger.group`.
   *
   * This is useful for reducing clutter in the console.
   *
   * @default true
   */
  collapseEvents?: boolean;

  /**
   * Custom function to get a stack trace.
   *
   * If not provided, stack traces will not be included in the logs.
   * The returned stack trace will be used to identify the component and the hooks that triggered the event.
   * Promises are supported and will be resolved before logging the transaction.
   *
   * This makes the logger library agnostic to the stack trace library used and in which ways to retrieve it.
   *
   * @example
   * ```ts
   * // Example using stacktrace-js library:
   * useAtomsLogger({
   *   getStackTrace() {
   *     try {
   *       throw new Error('Stack trace');
   *     } catch (error) {
   *       return StackTrace.fromError(error as Error, { offline: true });
   *     }
   *   },
   * });
   * ```
   */
  getStackTrace?(this: void): StackFrame[] | undefined | Promise<StackFrame[] | undefined>;
}

export interface AtomsLoggerTransactionBase {
  atom: AnyAtom | AtomId | undefined;
  transactionNumber?: number;
  stackTrace?: AtomsLoggerStackTrace | Promise<AtomsLoggerStackTrace | undefined> | undefined;
  events?: AtomsLoggerEventMap[];
  startTimestamp?: ReturnType<typeof performance.now>;
  endTimestamp?: ReturnType<typeof performance.now>;
}

export type AtomsLoggerTransactionMap = Partial<{
  unknown: AtomsLoggerTransactionBase;
  storeGet: AtomsLoggerTransactionBase;
  storeSet: AtomsLoggerTransactionBase & { args: unknown[]; result: unknown };
  storeSubscribe: AtomsLoggerTransactionBase & { listener: () => void };
  storeUnsubscribe: AtomsLoggerTransactionBase & { listener: () => void };
  promiseResolved: AtomsLoggerTransactionBase;
  promiseRejected: AtomsLoggerTransactionBase;
}>;

export type AtomsLoggerTransaction = NonNullable<
  AtomsLoggerTransactionMap[keyof AtomsLoggerTransactionMap]
>;

export interface AtomsLoggerEventBase {
  atom: AnyAtom | AtomId;
  /** @see {@link INTERNAL_AtomState.p} */
  pendingPromises?: AtomId[];
  /** @see {@link INTERNAL_AtomState.d} @see {@link INTERNAL_Mounted.d} */
  dependencies?: Set<AtomId>;
  /** @see {@link INTERNAL_Mounted.t} */
  dependents?: AtomId[];
}

export type AtomsLoggerEventMap = Partial<{
  initialized: AtomsLoggerEventBase & { value: unknown };
  initialPromisePending: AtomsLoggerEventBase;
  initialPromiseResolved: AtomsLoggerEventBase & { value: unknown };
  initialPromiseRejected: AtomsLoggerEventBase & { error: unknown };
  initialPromiseAborted: AtomsLoggerEventBase;
  changed: AtomsLoggerEventBase & { oldValue?: unknown; oldValues?: unknown[]; newValue: unknown };
  changedPromisePending: AtomsLoggerEventBase & { oldValue: unknown };
  changedPromiseResolved: AtomsLoggerEventBase & { oldValue: unknown; newValue: unknown };
  changedPromiseRejected: AtomsLoggerEventBase & { oldValue: unknown; error: unknown };
  changedPromiseAborted: AtomsLoggerEventBase & { oldValue: unknown };
  dependenciesChanged: AtomsLoggerEventBase & {
    oldDependencies?: Set<AtomId>;
  } & (
      | { addedDependency: AnyAtom; clearedDependencies?: undefined }
      | { addedDependency?: undefined; clearedDependencies: true }
    );
  mounted: AtomsLoggerEventBase & { value?: unknown };
  unmounted: AtomsLoggerEventBase;
  destroyed: AtomsLoggerEventBase;
}>;

export type AtomsLoggerEvent = NonNullable<AtomsLoggerEventMap[keyof AtomsLoggerEventMap]>;

/**
 * Stack frame information for the logger to identify the component and the hooks that triggered the event.
 * The function names are required but the file names are optional.
 */
export interface StackFrame {
  /**
   * Name of the function that triggered the event.
   * This is used to identify the component and the hooks that triggered the event.
   * Required.
   */
  functionName?: string;

  /**
   * Full path of the file where the event was triggered.
   * The file name is extracted from this path.
   * Optional.
   */
  fileName?: string;
}

/**
 * Information about the stack trace of the event that triggered the logger.
 * This information is used to identify the component and the hooks that triggered the event.
 */
export interface AtomsLoggerStackTrace {
  /**
   * All the stack frames of the event.
   * Retrieved using the logger's `getStackTrace` option.
   */
  stackFrames: StackFrame[];

  /**
   * Parsed file information.
   */
  file?: {
    /**
     * Full path of the file where the event was triggered.
     * The file name is extracted from the stack trace.
     */
    path: string;

    /**
     * Name of the file where the event was triggered.
     * The file name is extracted from the stack trace.
     * The file name is the last part of the path, without the extension.
     */
    name: string;
  };

  /**
   * Parsed React information.
   */
  react?: {
    /**
     * Name of the hooks that triggered the event.
     * `useAtomValue`, `useSetAtom` and `useAtom` are ignored.
     */
    hooks: string[] | undefined;

    /**
     * Name of the React component that triggered the event.
     */
    component: string;
  };
}
