import type { AtomLoggerStoreState } from '../types/store.js';
import { debounceEndTransaction } from './debounce-end-transaction.js';
import { flushTransactionEvents } from './flush-transaction-events.js';
import { stopEndTransactionDebounce } from './stop-end-transaction-debounce.js';
import { updateTransactionEndTimestamp } from './update-transaction-end-timestamp.js';

export function endTransaction(
  loggerState: AtomLoggerStoreState,
  { immediate } = { immediate: false },
): void {
  loggerState.isInsideTransaction = false;

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- should never happen since it is called after startTransaction
  const transaction = loggerState.currentTransaction!;

  // Retrieve the owner stack if there are events to log (for better logging performance)
  if (
    transaction.events.length > 0 &&
    !transaction.ownerStack &&
    loggerState.options.getOwnerStack
  ) {
    try {
      transaction.ownerStack = loggerState.options.getOwnerStack();
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
  if (!transaction.componentDisplayName && loggerState.options.getComponentDisplayName) {
    try {
      transaction.componentDisplayName = loggerState.options.getComponentDisplayName();
    } catch {
      transaction.componentDisplayName = undefined;
    }
  }

  // Flush the transaction events immediately (useful when starting a new transaction).
  if (
    immediate ||
    loggerState.options.synchronous ||
    loggerState.options.transactionDebounceMs === undefined ||
    loggerState.options.transactionDebounceMs <= 0
  ) {
    stopEndTransactionDebounce(loggerState);
    updateTransactionEndTimestamp(loggerState);
    flushTransactionEvents(loggerState);
    return;
  }

  // Start a new transaction debounce timeout.
  debounceEndTransaction(loggerState);
}
