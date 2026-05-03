import type { AtomLoggerFormatter } from '../../vanilla/types/formatter.js';
import { consoleFormatterOptionsToState } from './console-formatter-options-to-state.js';
import { logTransaction } from './log-transaction.js';
import type { ConsoleFormatterOptions, ConsoleFormatterState } from './types.js';

/**
 * Creates a console formatter that logs atom transactions to the browser/Node console.
 *
 * @example
 * ```ts
 * import { createLoggedStore } from 'jotai-logger/vanilla';
 * import { consoleFormatter } from 'jotai-logger/formatters/console';
 *
 * const store = createLoggedStore(parentStore, {
 *   formatter: consoleFormatter({ colorScheme: 'dark' }),
 * });
 * ```
 */
export function consoleFormatter(options?: ConsoleFormatterOptions): AtomLoggerFormatter {
  const state: ConsoleFormatterState = consoleFormatterOptionsToState(options);
  return (transaction) => {
    logTransaction(transaction, state);
  };
}
