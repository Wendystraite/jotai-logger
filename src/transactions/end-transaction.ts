import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import type { StoreWithAtomsLogger } from '../types/atoms-logger.js';
import { debounceEndTransaction } from './debounce-end-transaction.js';
import { flushTransactionEvents } from './flush-transaction-events.js';
import { stopEndTransactionDebounce } from './stop-end-transaction-debounce.js';
import { updateTransactionEndTimestamp } from './update-transaction-end-timestamp.js';

export function endTransaction(
  store: StoreWithAtomsLogger,
  { immediate } = { immediate: false },
): void {
  store[ATOMS_LOGGER_SYMBOL].isInsideTransaction = false;

  // Flush the transaction events immediately (useful when starting a new transaction).
  if (immediate) {
    stopEndTransactionDebounce(store);
    updateTransactionEndTimestamp(store);
    flushTransactionEvents(store);
    return;
  }

  // Start a new transaction debounce timeout.
  debounceEndTransaction(store);
}
