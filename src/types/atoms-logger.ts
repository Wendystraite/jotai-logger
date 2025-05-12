import type { Atom, useStore } from 'jotai';
import type { INTERNAL_AtomStateMap } from 'jotai/vanilla/internals';

import type { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import type { AtomsLoggerStackTrace } from '../utils/get-atoms-logger-stack-trace.js';

export type Store = ReturnType<typeof useStore>;

/**
 * Type of the store with the logger attached.
 */
export type StoreWithAtomsLogger = Store & {
  [ATOMS_LOGGER_SYMBOL]: AtomsLoggerState;
};

/**
 * Internal state of the logger.
 *
 * Contains configuration options, transaction tracking, and references to original store methods.
 */
export type AtomsLoggerState = AtomsLoggerOptionsInState & {
  /** Incremental counter for transactions */
  transactionNumber: number;
  /** The currently active transaction being tracked, if any */
  currentTransaction:
    | {
        transactionMap: AtomsLoggerTransactionMap;
        transaction: AtomsLoggerTransaction;
      }
    | undefined;
  /** FinalizationRegistry that register atoms garbage collection */
  atomsFinalizationRegistry: FinalizationRegistry<string>;
  /** Map to track the values of promises */
  promisesResultsMap: WeakMap<PromiseLike<unknown>, unknown>;
  /** Timeout id of the current transaction if started independently (not triggered by a store update) */
  transactionsDebounceTimeoutId: ReturnType<typeof setTimeout> | undefined;
  /** Previous overridden store.get method */
  prevStoreGet: StoreWithAtomsLogger['get'];
  /** Previous overridden store.set method */
  prevStoreSet: StoreWithAtomsLogger['set'];
  /** Previous overridden store.sub method */
  prevStoreSub: StoreWithAtomsLogger['sub'];
  /** Previous overridden atom state map setter method */
  prevAtomStateMapSet: INTERNAL_AtomStateMap['set'];
  /** Previous overridden jotai dev store mounted atoms add method */
  prevDevtoolsMountedAtomsAdd: Set<Atom<unknown>>['add'] | undefined;
  /** Previous overridden jotai dev store mounted atoms delete method */
  prevDevtoolsMountedAtomsDelete: Set<Atom<unknown>>['delete'] | undefined;
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

  /** @see AtomsLoggerOptions.plainTextOutput */
  plainTextOutput: boolean;

  /** @see AtomsLoggerOptions.colorScheme */
  colorScheme: 'default' | 'light' | 'dark';

  /** @see AtomsLoggerOptions.stringifyLimit */
  stringifyLimit: number;

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
   * - If set to true, logs will be grouped using `logger.group`, `logger.groupCollapsed` and `logger.groupEnd`.
   * - If set to false, only `logger.log` will be used.
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
   * Whether to disable colors in the console.
   *
   * @default false
   */
  plainTextOutput?: boolean;

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
   * Whether to show the transaction number in the console.
   *
   * - If set to true, the transaction log will look like : `transaction 1 - 12:00:00 - 2.00 ms`
   * - If set to false, the transaction log will look like : `12:00:00 - 2.00 ms`
   *
   * @default true
   */
  showTransactionNumber?: boolean;

  /**
   * Whether to show when a transaction started in the console.
   *
   * - If set to true, the transaction log will look like : `transaction 1 - 12:00:00 - 2.00 ms`
   * - If set to false, the transaction log will look like : `transaction 1 - 2.00 ms`
   *
   * @default false
   */
  showTransactionLocaleTime?: boolean;

  /**
   * Whether to show the elapsed time of a transaction in the console.
   *
   * - If set to true, the transaction log will look like : `transaction 1 - 12:00:00 - 2.00 ms`
   * - If set to false, the transaction log will look like : `transaction 1 - 12:00:00`
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
}

export interface AtomsLoggerTransactionBase {
  atom?: Atom<unknown>;
  atomId?: string;
  stackTrace?: AtomsLoggerStackTrace | undefined;
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

export type AtomsLoggerEventMap = Partial<{
  initialized: { atom: Atom<unknown>; value: unknown };
  initialPromisePending: { atom: Atom<unknown> };
  initialPromiseResolved: { atom: Atom<unknown>; value: unknown };
  initialPromiseRejected: { atom: Atom<unknown>; error: unknown };
  initialPromiseAborted: { atom: Atom<unknown> };
  changed: { atom: Atom<unknown>; oldValue?: unknown; oldValues?: unknown[]; newValue: unknown };
  changedPromisePending: { atom: Atom<unknown>; oldValue: unknown };
  changedPromiseResolved: {
    atom: Atom<unknown>;
    oldValue: unknown;
    newValue: unknown;
  };
  changedPromiseRejected: {
    atom: Atom<unknown>;
    oldValue: unknown;
    error: unknown;
  };
  changedPromiseAborted: { atom: Atom<unknown>; oldValue: unknown };
  mounted: { atom: Atom<unknown> };
  unmounted: { atom: Atom<unknown> };
  destroyed: { atomId: string };
}>;

export type AtomsLoggerEvent = NonNullable<AtomsLoggerEventMap[keyof AtomsLoggerEventMap]>;
