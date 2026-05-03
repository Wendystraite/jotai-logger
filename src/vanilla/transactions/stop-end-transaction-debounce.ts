import { atomLoggerStoreSymbol } from '../consts/store-symbol.js';
import type { AtomLoggerStore } from '../types/store.js';

export function stopEndTransactionDebounce(store: AtomLoggerStore) {
  if (store[atomLoggerStoreSymbol].transactionsDebounceTimeoutId !== undefined) {
    clearTimeout(store[atomLoggerStoreSymbol].transactionsDebounceTimeoutId);
    store[atomLoggerStoreSymbol].transactionsDebounceTimeoutId = undefined;
  }
}
