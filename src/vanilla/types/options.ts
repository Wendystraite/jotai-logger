import type { Atom } from 'jotai';

import type { AtomLoggerFormatter } from './formatter.js';

/**
 * Options for the atoms logger.
 *
 * These control event collection and transaction scheduling only.
 * To customise the console output, pass a {@link AtomLoggerFormatter} via the `formatter` option,
 * or use {@link consoleFormatter} from `jotai-logger/formatters/console`.
 */
export interface AtomLoggerOptions {
  /**
   * Custom formatter called for each completed transaction.
   *
   * When not provided, a default `consoleFormatter()` (from `jotai-logger/formatters/console`)
   * is used with its default options.
   *
   * @example
   * ```ts
   * import { consoleFormatter } from 'jotai-logger/formatters/console';
   * const store = createLoggedStore(parentStore, {
   *   formatter: consoleFormatter({ colorScheme: 'dark', domain: 'MyApp' }),
   * });
   * ```
   */
  formatter?: AtomLoggerFormatter;

  /**
   * Enable or disable the logger.
   *
   * @default true
   */
  enabled?: boolean;

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
   * createLoggedStore(parentStore, { shouldShowAtom });
   *
   * // Don't show a specific atom
   * const verboseAtom = atom(0);
   * const shouldShowAtom = (atom: Atom<unknown>) => atom !== verboseAtom;
   * createLoggedStore(parentStore, { shouldShowAtom });
   *
   * // Dont show an atom with a specific property
   * const verboseAtom = atom(0);
   * verboseAtom.debugLabel = 'verbose';
   * Object.assign(verboseAtom, { canLog: false });
   * const shouldShowAtom = (atom: Atom<unknown>) => !('canLog' in atom) || atom.canLog === true;
   * createLoggedStore(parentStore, { shouldShowAtom });
   * ```
   */
  shouldShowAtom?(this: void, atom: Atom<unknown>): boolean;

  /**
   * **Experimental feature** - Get the React component owner stack.
   *
   * This function should return a stack trace string showing the React component hierarchy
   * that triggered the current transaction. The logger will parse this to show up to
   * `ownerStackLimit` parent components in the logs.
   *
   * **React 19.1+ Example:**
   * ```tsx
   * import { captureOwnerStack } from 'react';
   *
   * createLoggedStore(parentStore, { getOwnerStack: captureOwnerStack });
   * ```
   *
   * **Expected format:**
   * ```
   * at MiddleWrapper (http://localhost:5173/src/App.tsx:70:21)
   * at ParentContainer (http://localhost:5173/src/App.tsx:31:21)
   * at App (http://localhost:5173/src/App.tsx:108:21)
   * ```
   *
   * **Output example:**
   * ```
   * transaction 1 : [ParentContainer.MiddleWrapper] retrieved value of countAtom
   * ```
   *
   * @returns Stack trace string, null, or undefined
   */
  getOwnerStack?(this: void): string | null | undefined;

  /**
   * **Experimental feature** - Get the current React component's display name.
   *
   * This function should return the display name or name of the currently rendering
   * React component. The logger will show this in transaction logs to help identify
   * which component triggered the state change.
   *
   * **React 19+ Example:**
   * ```tsx
   * import React from 'react';
   *
   * function getReact19ComponentDisplayName(): string | undefined {
   *   const React19 = React as any;
   *   const component = (
   *     React19.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE ??
   *     React19.__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
   *   )?.A?.getOwner?.().type;
   *   return component?.displayName ?? component?.name;
   * }
   *
   * createLoggedStore(parentStore, {
   *   getComponentDisplayName: getReact19ComponentDisplayName
   * });
   * ```
   *
   * **Output example:**
   * ```
   * transaction 1 : MyCounter retrieved value of countAtom
   * ```
   *
   * **Note:** When used with `getOwnerStack`, the component display name will only
   * be shown if it's different from the last component shown in the owner stack.
   *
   * @returns Component display name or undefined
   */
  getComponentDisplayName?(this: void): string | undefined;

  /**
   * Whether to log transactions synchronously or asynchronously.
   *
   * - If set to `true`, the logger will log transactions synchronously
   *   - This makes `transactionDebounceMs`, `requestIdleCallbackTimeoutMs`
   *     and `maxProcessingTimeMs` options irrelevant.
   *   - This is useful for debugging purposes or if you want to see the logs
   *     immediately.
   * - If set to `false`, the logger will log transactions asynchronously
   *   - First, transaction events are debounced using `transactionDebounceMs`
   *     option.
   *   - Then, the transactions are scheduled to be logged using
   *     `requestIdleCallback` with a maximum timeout defined by
   *     `requestIdleCallbackTimeoutMs` option.
   *   - Finally, the transactions are processed in chunks with a maximum
   *     processing time defined by `maxProcessingTimeMs` option.
   *   - This is useful for reducing the impact of the logger on the application
   *     performance.
   *
   * @default false
   */
  synchronous?: boolean;

  /**
   * Debounce time for transaction flushing in milliseconds.
   *
   * Only used if `synchronous` is set to `false`.
   *
   * - This ensures that multiple independent events are logged together in a
   *   single transaction instead of multiple transactions.
   *
   * - Use `0` for no debounce, which means that every transaction will be
   *   scheduled to be logged immediately. This is the same as setting
   *   `synchronous` to `true`.
   *
   * @default 250
   */
  transactionDebounceMs?: number;

  /**
   * Timeout in milliseconds for the
   * {@link https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback#timeout | `requestIdleCallback`}
   * used to flush transactions.
   *
   * Only used if `synchronous` is set to `false`.
   *
   * - `requestIdleCallback` queues transactions to be logged during a browser's
   *   idle periods with this maximum timeout per group of transactions.
   *   This ensure that the logger does not impact too much the application performances.
   *
   * - Use a positive value to set a maximum timeout for the
   *   `requestIdleCallback`.
   *   - This means that the logger will wait for the browser to be idle for at
   *     least this amount of time before logging the queued transactions.
   *   - It will fallback to `setTimeout` with a timeout of `0` if the browser
   *     does not support `requestIdleCallback`.
   *
   * - Use `0` to wait indefinitely for the browser to be idle before logging
   *   the queued transactions.
   *   - It will fallback to `setTimeout` with a timeout of `0` if the browser
   *     does not support `requestIdleCallback`.
   *
   * - Use `-1` or lower to log scheduled transactions immediately. This is the
   *   same as setting `synchronous` to `true`.
   *
   * @default 250
   */
  requestIdleCallbackTimeoutMs?: number;

  /**
   * Maximum number of milliseconds to process transactions in one go.
   *
   * Only used if `synchronous` is set to `false`.
   *
   * - This is to avoid blocking the main thread for too long.
   * - If there are still transactions in the queue after this time, they will be
   *   scheduled to be processed in the next idle period.
   *
   * - Use a positive value to set the maximum processing time per idle period.
   * - Use `0` or lower to process all queued transactions in one go, which may block
   *   the main thread for a long time.
   *   This is the same as setting `synchronous` to `true`.
   *
   * @default 16 (approximately 1 frame at 60fps)
   */
  maxProcessingTimeMs?: number;
}
