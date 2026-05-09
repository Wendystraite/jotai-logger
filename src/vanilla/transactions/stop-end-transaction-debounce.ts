import type { AtomLoggerStoreState } from '../types/store.js';

export function stopEndTransactionDebounce(loggerState: AtomLoggerStoreState) {
  if (loggerState.transactionsDebounceTimeoutId !== undefined) {
    clearTimeout(loggerState.transactionsDebounceTimeoutId);
    loggerState.transactionsDebounceTimeoutId = undefined;
  }
}
