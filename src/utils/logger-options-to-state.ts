import type { AtomsLoggerOptions, AtomsLoggerOptionsInState } from '../types/atoms-logger.js';

// eslint-disable-next-line complexity -- it's a simple conversion function
export function atomsLoggerOptionsToState(
  options: AtomsLoggerOptions = {},
): AtomsLoggerOptionsInState {
  const {
    enabled = true,
    domain,
    shouldShowPrivateAtoms = false,
    shouldShowAtom,
    logger = console,
    groupLogs = true,
    indentSpaces = 0,
    formattedOutput = true,
    colorScheme = 'default',
    stringifyLimit = 50,
    stringifyValues = true,
    stringify,
    showTransactionNumber = true,
    showTransactionLocaleTime = false,
    showTransactionElapsedTime = true,
    collapseTransactions = false,
    collapseEvents = true,
    getStackTrace,
    synchronous = false,
    transactionDebounceMs = 250,
    requestIdleCallbackTimeoutMs = 250,
  } = options;
  return {
    enabled,
    domain,
    shouldShowPrivateAtoms,
    shouldShowAtom,
    logger,
    groupLogs,
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
    showTransactionLocaleTime,
    showTransactionElapsedTime,
    collapseTransactions,
    collapseEvents,
    getStackTrace,
    transactionDebounceMs: synchronous ? -1 : transactionDebounceMs,
    requestIdleCallbackTimeoutMs: synchronous ? -1 : requestIdleCallbackTimeoutMs,
  };
}
