import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import type { StoreWithAtomsLogger } from '../types/atoms-logger.js';

export function updateTransactionEndTimestamp(store: StoreWithAtomsLogger): void {
  if (
    !store[ATOMS_LOGGER_SYMBOL].showTransactionElapsedTime &&
    !store[ATOMS_LOGGER_SYMBOL].showTransactionLocaleTime
  ) {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- should never happen since it is called after startTransaction
  const transaction = store[ATOMS_LOGGER_SYMBOL].currentTransaction!;
  transaction.endTimestamp = performance.now();
}
