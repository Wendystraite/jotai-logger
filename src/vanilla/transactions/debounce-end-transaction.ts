import type { AtomLoggerStoreState } from '../types/store.js';
import { flushTransactionEvents } from './flush-transaction-events.js';
import { stopEndTransactionDebounce } from './stop-end-transaction-debounce.js';
import { updateTransactionEndTimestamp } from './update-transaction-end-timestamp.js';

export function debounceEndTransaction(loggerState: AtomLoggerStoreState) {
  stopEndTransactionDebounce(loggerState);

  // Store the transaction end timestamp BEFORE debouncing
  updateTransactionEndTimestamp(loggerState);

  loggerState.transactionsDebounceTimeoutId = setTimeout(() => {
    loggerState.transactionsDebounceTimeoutId = undefined;
    flushTransactionEvents(loggerState);
  }, loggerState.transactionDebounceMs);
}
