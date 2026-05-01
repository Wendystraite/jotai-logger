import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import type { StoreWithAtomsLogger } from '../types/atoms-logger.js';
import { debounceEndTransaction } from './debounce-end-transaction.js';
import { flushTransactionEvents } from './flush-transaction-events.js';
import { stopEndTransactionDebounce } from './stop-end-transaction-debounce.js';
import { updateTransactionEndTimestamp } from './update-transaction-end-timestamp.js';

export function endTransaction(
  store: StoreWithAtomsLogger,
  { immediate } = { immediate: false },
): void {
  store[ATOMS_LOGGER_SYMBOL].isInsideTransaction = false;

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- should never happen since it is called after startTransaction
  const transaction = store[ATOMS_LOGGER_SYMBOL].currentTransaction!;

  // Retrieve the owner stack if there are events to log (for better logging performance)
  if (
    transaction.eventsCount > 0 &&
    !transaction.ownerStack &&
    store[ATOMS_LOGGER_SYMBOL].getOwnerStack
  ) {
    try {
      transaction.ownerStack = store[ATOMS_LOGGER_SYMBOL].getOwnerStack();
    } catch {
      transaction.ownerStack = undefined;
    }
  }

  /**
   * Re-try to get the component display name if not already set.
   *
   * This allows to get the component display name when using `useAtom` or `useAtomValue` during `subscribed` and `set` calls.
   *
   * These calls would normally not have a component display name since they are done in `useEffect` or event callbacks
   * (e.g. onClick) due to the way React works internally.
   *
   * But, this can be retrieved here due to `useAtomValue` internal code using `useReducer` :
   * - The internal code uses `useEffect` to subscribe to the atom (`store.sub`).
   *   This triggers a `storeSubscribe` transaction with no component display name (since called in an `useEffect`).
   * - Just after this call, it calls the `dispatch` method of its `useReducer`.
   *   To compare the previous and next value of the atom, it calls `store.get`.
   *   This store call is done in the component body (inside `useReducer`), so the component display name can be retrieved here.
   */
  if (!transaction.componentDisplayName && store[ATOMS_LOGGER_SYMBOL].getComponentDisplayName) {
    try {
      transaction.componentDisplayName = store[ATOMS_LOGGER_SYMBOL].getComponentDisplayName();
    } catch {
      transaction.componentDisplayName = undefined;
    }
  }

  // Flush the transaction events immediately (useful when starting a new transaction).
  if (immediate || store[ATOMS_LOGGER_SYMBOL].transactionDebounceMs <= 0) {
    stopEndTransactionDebounce(store);
    updateTransactionEndTimestamp(store);
    flushTransactionEvents(store);
    return;
  }

  // Start a new transaction debounce timeout.
  debounceEndTransaction(store);
}
