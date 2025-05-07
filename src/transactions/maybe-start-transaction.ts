import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import type { AtomsLoggerTransactionMap, StoreWithAtomsLogger } from '../types/atoms-logger.js';
import { startTransaction } from './start-transaction.js';

export function maybeStartTransaction(
  store: StoreWithAtomsLogger,
  transactionMap: AtomsLoggerTransactionMap,
): boolean {
  if (store[ATOMS_LOGGER_SYMBOL].currentTransaction === undefined) {
    startTransaction(store, transactionMap);
    return true;
  }
  return false;
}
