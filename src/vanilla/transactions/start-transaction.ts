import type { AtomLoggerStoreState } from '../types/store.js';
import type { AtomTransaction, AtomTransactionMap } from '../types/transaction.js';
import { shouldShowAtom } from '../utils/should-show-atom.js';
import { endTransaction } from './end-transaction.js';

export function startTransaction(
  loggerState: AtomLoggerStoreState,
  partialTransaction: {
    [K in keyof AtomTransactionMap]: Omit<
      AtomTransactionMap[K],
      | 'transactionNumber'
      | 'events'
      | 'startTimestamp'
      | 'endTimestamp'
      | 'ownerStack'
      | 'componentDisplayName'
    >;
  }[keyof AtomTransactionMap],
): void {
  if (loggerState.currentTransaction) {
    // Finish the previous transaction immediately to start a new one.
    endTransaction(loggerState, { immediate: true });
  }

  loggerState.isInsideTransaction = true;

  const transaction = partialTransaction as AtomTransaction;

  transaction.transactionNumber = loggerState.transactionNumber;
  transaction.events = [];

  transaction.startTimestamp = performance.now();

  if (!transaction.componentDisplayName && loggerState.options.getComponentDisplayName) {
    try {
      // Try to get the component display name.
      // Do it at the start AND the end of the transaction to cover more cases since this can fail.
      transaction.componentDisplayName = loggerState.options.getComponentDisplayName();
    } catch {
      transaction.componentDisplayName = undefined;
    }
  }

  if (transaction.atom && !shouldShowAtom(loggerState, transaction.atom)) {
    transaction.atom = undefined;
  }

  loggerState.currentTransaction = transaction;
}
