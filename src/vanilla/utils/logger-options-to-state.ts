import type { AtomLoggerOptions, AtomLoggerOptionsInState } from '../types/atoms-logger.js';

/**
 * Core options subset of AtomLoggerOptionsInState — excludes the `formatter` field
 * so that Object.assign on re-binds never accidentally overwrites the existing formatter.
 */
export type AtomsLoggerCoreState = Omit<AtomLoggerOptionsInState, 'formatter'>;

export function atomLoggerOptionsToState(options: AtomLoggerOptions = {}): AtomsLoggerCoreState {
  const {
    enabled = true,
    shouldShowPrivateAtoms = false,
    shouldShowAtom,
    getOwnerStack,
    getComponentDisplayName,
    synchronous = false,
    transactionDebounceMs = 250,
    requestIdleCallbackTimeoutMs = 250,
    maxProcessingTimeMs = 16,
  } = options;
  return {
    enabled,
    shouldShowPrivateAtoms,
    shouldShowAtom,
    getOwnerStack,
    getComponentDisplayName,
    transactionDebounceMs: synchronous ? -1 : transactionDebounceMs,
    requestIdleCallbackTimeoutMs: synchronous ? -1 : requestIdleCallbackTimeoutMs,
    maxProcessingTimeMs: synchronous ? -1 : maxProcessingTimeMs,
  };
}
