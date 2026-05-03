import { atomLoggerStoreSymbol } from '../consts/store-symbol.js';
import type { AtomLoggerStore } from '../types/store.js';
import type { AtomTransaction, AtomTransactionMap } from '../types/transaction.js';
import { shouldShowAtom } from '../utils/should-show-atom.js';
import { endTransaction } from './end-transaction.js';

export function startTransaction(
  store: AtomLoggerStore,
  partialTransaction: {
    [K in keyof AtomTransactionMap]: Omit<
      AtomTransactionMap[K],
      | 'transactionNumber'
      | 'events'
      | 'eventsCount'
      | 'startTimestamp'
      | 'endTimestamp'
      | 'ownerStack'
      | 'componentDisplayName'
    >;
  }[keyof AtomTransactionMap],
): void {
  if (store[atomLoggerStoreSymbol].currentTransaction) {
    // Finish the previous transaction immediately to start a new one.
    endTransaction(store, { immediate: true });
  }

  store[atomLoggerStoreSymbol].isInsideTransaction = true;

  const transaction = partialTransaction as AtomTransaction;

  transaction.transactionNumber = store[atomLoggerStoreSymbol].transactionNumber;
  transaction.events = [];
  transaction.eventsCount = 0;

  transaction.startTimestamp = performance.now();

  if (!transaction.componentDisplayName && store[atomLoggerStoreSymbol].getComponentDisplayName) {
    try {
      // Try to get the component display name.
      // Do it at the start AND the end of the transaction to cover more cases since this can fail.
      transaction.componentDisplayName = store[atomLoggerStoreSymbol].getComponentDisplayName();
    } catch {
      transaction.componentDisplayName = undefined;
    }
  }

  if (transaction.atom && !shouldShowAtom(store, transaction.atom)) {
    transaction.atom = undefined;
  }

  store[atomLoggerStoreSymbol].currentTransaction = transaction;
}
