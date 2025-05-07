import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import type { StoreWithAtomsLogger } from '../types/atoms-logger.js';
import { flushTransactionEvents } from './flush-transaction-events.js';

/**
 * Debounce time for transaction flushing in milliseconds.
 * This debounce ensures that multiple independent events are not logged immediately **during** a transaction but rather after a short delay are grouped together.
 * For example, if `store.set` is called and for some reasons, after this a side effect is triggered that changes the value of the atom, this will be logged as a single transaction.
 * If another transaction is started before the timeout, the previous transaction will be flushed immediately and the new transaction will start to accumulate the new events.
 */
const TRANSACTION_DEBOUNCE_MS = 250;

export function endTransaction(store: StoreWithAtomsLogger): void {
  store[ATOMS_LOGGER_SYMBOL].transactionsDebounceTimeoutId = setTimeout(() => {
    store[ATOMS_LOGGER_SYMBOL].transactionsDebounceTimeoutId = undefined;
    flushTransactionEvents(store);
  }, TRANSACTION_DEBOUNCE_MS);
}
