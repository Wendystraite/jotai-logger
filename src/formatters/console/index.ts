import type { AtomsLoggerFormatter } from '../../vanilla/types/formatter.js';
import { logTransaction } from './log-transaction.js';
import type { ConsoleFormatterOptions, ConsoleFormatterState } from './types.js';

export type { ConsoleFormatterOptions } from './types.js';

function consoleFormatterOptionsToState(
  options: ConsoleFormatterOptions = {},
): ConsoleFormatterState {
  const {
    domain,
    logger = console,
    groupTransactions = true,
    groupEvents = false,
    indentSpaces = 0,
    formattedOutput = true,
    colorScheme = 'default',
    stringifyLimit = 50,
    stringifyValues = true,
    stringify,
    showTransactionNumber = true,
    showTransactionEventsCount = true,
    showTransactionLocaleTime = false,
    showTransactionElapsedTime = true,
    autoAlignTransactions = true,
    collapseTransactions = true,
    collapseEvents = false,
    ownerStackLimit = 2,
  } = options;

  return {
    domain,
    logger,
    groupTransactions,
    groupEvents,
    indentSpaces,
    indentSpacesDepth1:
      indentSpaces <= 0 ? '' : Array.from({ length: indentSpaces }, () => ' ').join(''),
    indentSpacesDepth2:
      indentSpaces <= 0 ? '' : Array.from({ length: indentSpaces * 2 }, () => ' ').join(''),
    formattedOutput,
    colorScheme,
    stringifyLimit,
    stringifyValues,
    stringify,
    showTransactionNumber,
    showTransactionEventsCount,
    showTransactionLocaleTime,
    showTransactionElapsedTime,
    autoAlignTransactions,
    collapseTransactions,
    collapseEvents,
    ownerStackLimit,
    maxWidths: {
      eventsCount: 0,
      elapsedTime: 0,
    },
  };
}

/**
 * Creates a console formatter that logs atom transactions to the browser/Node console.
 *
 * @example
 * ```ts
 * import { bindAtomsLoggerToStore } from 'jotai-logger/vanilla';
 * import { consoleFormatter } from 'jotai-logger/formatters/console';
 *
 * bindAtomsLoggerToStore(store, {
 *   formatter: consoleFormatter({ colorScheme: 'dark' }),
 * });
 * ```
 */
export function consoleFormatter(options?: ConsoleFormatterOptions): AtomsLoggerFormatter {
  const state: ConsoleFormatterState = consoleFormatterOptionsToState(options);
  return (transaction) => {
    logTransaction(transaction, state);
  };
}
