import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import type { StoreWithAtomsLogger } from '../types/atoms-logger.js';
import { flushTransactionEvents } from './flush-transaction-events.js';
import { stopEndTransactionDebounce } from './stop-end-transaction-debounce.js';
import { updateTransactionEndTimestamp } from './update-transaction-end-timestamp.js';

export function debounceEndTransaction(store: StoreWithAtomsLogger) {
  stopEndTransactionDebounce(store);

  // Store the transaction end timestamp BEFORE debouncing
  updateTransactionEndTimestamp(store);

  store[ATOMS_LOGGER_SYMBOL].transactionsDebounceTimeoutId = setTimeout(() => {
    store[ATOMS_LOGGER_SYMBOL].transactionsDebounceTimeoutId = undefined;
    flushTransactionEvents(store);
  }, store[ATOMS_LOGGER_SYMBOL].transactionDebounceMs);
}
