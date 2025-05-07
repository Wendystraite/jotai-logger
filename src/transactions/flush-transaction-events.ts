import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import { logTransaction } from '../log-atom-event/log-transaction.js';
import type { StoreWithAtomsLogger } from '../types/atoms-logger.js';

export function flushTransactionEvents(store: StoreWithAtomsLogger): void {
  if (store[ATOMS_LOGGER_SYMBOL].transactionsDebounceTimeoutId !== undefined) {
    clearTimeout(store[ATOMS_LOGGER_SYMBOL].transactionsDebounceTimeoutId);
    store[ATOMS_LOGGER_SYMBOL].transactionsDebounceTimeoutId = undefined;
  }

  if (!store[ATOMS_LOGGER_SYMBOL].currentTransaction) {
    return;
  }

  const { transaction, transactionMap } = store[ATOMS_LOGGER_SYMBOL].currentTransaction;
  transaction.endTimestamp ??= performance.now();
  store[ATOMS_LOGGER_SYMBOL].currentTransaction = undefined;

  logTransaction(store, transactionMap);
}
