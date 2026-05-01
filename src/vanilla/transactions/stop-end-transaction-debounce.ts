import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import type { StoreWithAtomsLogger } from '../types/atoms-logger.js';

export function stopEndTransactionDebounce(store: StoreWithAtomsLogger) {
  if (store[ATOMS_LOGGER_SYMBOL].transactionsDebounceTimeoutId !== undefined) {
    clearTimeout(store[ATOMS_LOGGER_SYMBOL].transactionsDebounceTimeoutId);
    store[ATOMS_LOGGER_SYMBOL].transactionsDebounceTimeoutId = undefined;
  }
}
