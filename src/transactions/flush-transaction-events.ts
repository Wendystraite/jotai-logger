import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import type { StoreWithAtomsLogger } from '../types/atoms-logger.js';

export function flushTransactionEvents(store: StoreWithAtomsLogger): void {
  if (store[ATOMS_LOGGER_SYMBOL].transactionsDebounceTimeoutId !== undefined) {
    clearTimeout(store[ATOMS_LOGGER_SYMBOL].transactionsDebounceTimeoutId);
    store[ATOMS_LOGGER_SYMBOL].transactionsDebounceTimeoutId = undefined;
  }

  /* v8 ignore next 3 -- should never happen since flush is called after startTransaction */
  if (!store[ATOMS_LOGGER_SYMBOL].currentTransaction) {
    return;
  }

  const { transaction, transactionMap } = store[ATOMS_LOGGER_SYMBOL].currentTransaction;
  transaction.endTimestamp ??= performance.now();
  store[ATOMS_LOGGER_SYMBOL].currentTransaction = undefined;

  // Add current transaction to scheduler instead of executing immediately
  store[ATOMS_LOGGER_SYMBOL].logTransactionsScheduler.add(transactionMap);
}
