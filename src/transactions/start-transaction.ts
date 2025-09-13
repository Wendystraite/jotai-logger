import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import type {
  AtomsLoggerTransaction,
  AtomsLoggerTransactionMap,
  StoreWithAtomsLogger,
} from '../types/atoms-logger.js';
import { shouldShowAtom } from '../utils/should-show-atom.js';
import { endTransaction } from './end-transaction.js';

export function startTransaction(
  store: StoreWithAtomsLogger,
  partialTransaction: {
    [K in keyof AtomsLoggerTransactionMap]: Omit<
      AtomsLoggerTransactionMap[K],
      | 'transactionNumber'
      | 'events'
      | 'eventsCount'
      | 'startTimestamp'
      | 'endTimestamp'
      | 'ownerStack'
      | 'componentDisplayName'
    >;
  }[keyof AtomsLoggerTransactionMap],
): void {
  if (store[ATOMS_LOGGER_SYMBOL].currentTransaction) {
    // Finish the previous transaction immediately to start a new one.
    endTransaction(store, { immediate: true });
  }

  store[ATOMS_LOGGER_SYMBOL].isInsideTransaction = true;

  const transaction = partialTransaction as AtomsLoggerTransaction;

  transaction.transactionNumber = store[ATOMS_LOGGER_SYMBOL].transactionNumber;
  transaction.events = [];
  transaction.eventsCount = 0;
  transaction.startTimestamp = performance.now();

  if (!transaction.ownerStack && store[ATOMS_LOGGER_SYMBOL].getOwnerStack) {
    try {
      transaction.ownerStack = store[ATOMS_LOGGER_SYMBOL].getOwnerStack();
    } catch {
      transaction.ownerStack = undefined;
    }
  }
  if (!transaction.componentDisplayName && store[ATOMS_LOGGER_SYMBOL].getComponentDisplayName) {
    try {
      transaction.componentDisplayName = store[ATOMS_LOGGER_SYMBOL].getComponentDisplayName();
    } catch {
      transaction.componentDisplayName = undefined;
    }
  }

  if (transaction.atom && !shouldShowAtom(store, transaction.atom)) {
    transaction.atom = undefined;
  }

  store[ATOMS_LOGGER_SYMBOL].currentTransaction = transaction;
}
