import type { AtomsLoggerOptions, AtomsLoggerOptionsInState } from '../types/atoms-logger.js';

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
    plainTextOutput = false,
    colorScheme = 'default',
    stringifyLimit = 50,
    showTransactionNumber = true,
    showTransactionLocaleTime = false,
    showTransactionElapsedTime = true,
    collapseTransactions = false,
    collapseEvents = true,
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
    plainTextOutput,
    colorScheme,
    stringifyLimit,
    showTransactionNumber,
    showTransactionLocaleTime,
    showTransactionElapsedTime,
    collapseTransactions,
    collapseEvents,
  };
}
