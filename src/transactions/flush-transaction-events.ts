import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import type { StoreWithAtomsLogger } from '../types/atoms-logger.js';
import { getTransactionMapTransaction } from '../utils/get-transaction-map-transaction.js';

export function flushTransactionEvents(store: StoreWithAtomsLogger): void {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- should never happen since it is called in endTransaction
  const transactionMap = store[ATOMS_LOGGER_SYMBOL].currentTransaction!;
  const transaction = getTransactionMapTransaction(transactionMap);

  store[ATOMS_LOGGER_SYMBOL].currentTransaction = undefined;

  // If the transaction has no events, we don't need to log it.
  if (!transaction.events?.length) {
    return;
  }

  // Add current transaction to scheduler instead of executing immediately
  store[ATOMS_LOGGER_SYMBOL].logTransactionsScheduler.add(transactionMap);
}
