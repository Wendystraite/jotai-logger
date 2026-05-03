import { atomLoggerStoreSymbol } from '../consts/store-symbol.js';
import type { AtomLoggerStore } from '../types/store.js';

export function updateTransactionEndTimestamp(store: AtomLoggerStore): void {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- should never happen since it is called after startTransaction
  const transaction = store[atomLoggerStoreSymbol].currentTransaction!;
  transaction.endTimestamp = performance.now();
}
