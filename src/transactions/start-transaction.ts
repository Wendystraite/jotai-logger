import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import type {
  AtomsLoggerTransaction,
  AtomsLoggerTransactionMap,
  StoreWithAtomsLogger,
} from '../types/atoms-logger.js';
import { getAtomsLoggerStackTrace } from '../utils/get-atoms-logger-stack-trace.js';
import { flushTransactionEvents } from './flush-transaction-events.js';

export function startTransaction(
  store: StoreWithAtomsLogger,
  transactionMap: AtomsLoggerTransactionMap,
): void {
  if (store[ATOMS_LOGGER_SYMBOL].currentTransaction) {
    // Flush the previous transaction immediately to start a new one.
    flushTransactionEvents(store);
  }

  const transaction = (Object.values(transactionMap)[0] ?? []) as
    | AtomsLoggerTransaction
    | undefined;

  if (transaction) {
    transaction.startTimestamp ??= performance.now();
    transaction.stackTrace ??= getAtomsLoggerStackTrace();
    store[ATOMS_LOGGER_SYMBOL].currentTransaction = {
      transactionMap: transactionMap,
      transaction,
    };
  }
}
