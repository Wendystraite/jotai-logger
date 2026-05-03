import { atomLoggerStoreSymbol } from '../consts/store-symbol.js';
import type { AtomLoggerStore } from '../types/store.js';
import { flushTransactionEvents } from './flush-transaction-events.js';
import { stopEndTransactionDebounce } from './stop-end-transaction-debounce.js';
import { updateTransactionEndTimestamp } from './update-transaction-end-timestamp.js';

export function debounceEndTransaction(store: AtomLoggerStore) {
  stopEndTransactionDebounce(store);

  // Store the transaction end timestamp BEFORE debouncing
  updateTransactionEndTimestamp(store);

  store[atomLoggerStoreSymbol].transactionsDebounceTimeoutId = setTimeout(() => {
    store[atomLoggerStoreSymbol].transactionsDebounceTimeoutId = undefined;
    flushTransactionEvents(store);
  }, store[atomLoggerStoreSymbol].transactionDebounceMs);
}
