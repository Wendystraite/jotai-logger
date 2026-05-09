import type { AtomLoggerStoreState } from '../types/store.js';

export function updateTransactionEndTimestamp(loggerState: AtomLoggerStoreState): void {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- should never happen since it is called after startTransaction
  const transaction = loggerState.currentTransaction!;
  transaction.endTimestamp = performance.now();
}
