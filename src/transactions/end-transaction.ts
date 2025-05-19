import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import type { StoreWithAtomsLogger } from '../types/atoms-logger.js';
import { getTransactionMapTransaction } from '../utils/get-transaction-map-transaction.js';
import { flushTransactionEvents } from './flush-transaction-events.js';

/**
 * Debounce time for transaction flushing in milliseconds.
 * This debounce ensures that multiple independent events are not logged immediately **during** a transaction but rather after a short delay are grouped together.
 * For example, if `store.set` is called and for some reasons, after this a side effect is triggered that changes the value of the atom, this will be logged as a single transaction.
 * If another transaction is started before the timeout, the previous transaction will be flushed immediately and the new transaction will start to accumulate the new events.
 */
const TRANSACTION_DEBOUNCE_MS = 250;

export function endTransaction(
  store: StoreWithAtomsLogger,
  { immediate } = { immediate: false },
): void {
  // Stop the previous transaction debounce timeout if it exists.
  if (store[ATOMS_LOGGER_SYMBOL].transactionsDebounceTimeoutId !== undefined) {
    clearTimeout(store[ATOMS_LOGGER_SYMBOL].transactionsDebounceTimeoutId);
    store[ATOMS_LOGGER_SYMBOL].transactionsDebounceTimeoutId = undefined;
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- should never happen since it is called after startTransaction
  const transaction = getTransactionMapTransaction(store[ATOMS_LOGGER_SYMBOL].currentTransaction!);

  // Store the transaction end timestamp BEFORE debouncing
  transaction.endTimestamp = performance.now();

  // Flush the transaction events immediately (useful when starting a new transaction).
  if (immediate) {
    flushTransactionEvents(store);
    return;
  }

  // Start a new transaction debounce timeout.
  store[ATOMS_LOGGER_SYMBOL].transactionsDebounceTimeoutId = setTimeout(() => {
    store[ATOMS_LOGGER_SYMBOL].transactionsDebounceTimeoutId = undefined;
    flushTransactionEvents(store);
  }, TRANSACTION_DEBOUNCE_MS);
}
