import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import type { StoreWithAtomsLogger } from '../types/atoms-logger.js';
import { getTransactionMapTransaction } from '../utils/get-transaction-map-transaction.js';

export function updateTransactionEndTimestamp(store: StoreWithAtomsLogger): void {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- should never happen since it is called after startTransaction
  const transaction = getTransactionMapTransaction(store[ATOMS_LOGGER_SYMBOL].currentTransaction!);
  transaction.endTimestamp = performance.now();
}
