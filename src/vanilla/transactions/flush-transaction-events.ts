import type { AtomLoggerStoreState } from '../types/store.js';

export function flushTransactionEvents(loggerState: AtomLoggerStoreState): void {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- should never happen since it is called in endTransaction
  const transaction = loggerState.currentTransaction!;

  loggerState.currentTransaction = undefined;

  // If the transaction has no events, we don't need to log it.
  if (transaction.events.length <= 0) {
    return;
  }

  // Only increment the transaction number if the current transaction is logged
  loggerState.transactionNumber += 1;

  // Add current transaction to scheduler instead of executing immediately
  loggerState.logTransactionsScheduler.add(transaction);
}
