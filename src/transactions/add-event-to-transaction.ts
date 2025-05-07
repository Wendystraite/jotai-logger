import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import type {
  AtomsLoggerEventMap,
  AtomsLoggerTransactionMap,
  StoreWithAtomsLogger,
} from '../types/atoms-logger.js';
import { endTransaction } from './end-transaction.js';
import { startTransaction } from './start-transaction.js';

export function addEventToTransaction(
  store: StoreWithAtomsLogger,
  eventMap: AtomsLoggerEventMap,
): void {
  if (!store[ATOMS_LOGGER_SYMBOL].currentTransaction) {
    // Execute the event in an independent "unknown" transaction if there is no current transaction.
    let transactionMap: AtomsLoggerTransactionMap = { unknown: {} };
    const event = Object.values(eventMap)[0] ?? undefined;
    if (event) {
      if ('atom' in event) {
        transactionMap = { unknown: { atom: event.atom } };
      } else {
        transactionMap = { unknown: { atomId: event.atomId } };
      }
    }
    startTransaction(store, transactionMap);
    addEventToTransaction(store, eventMap);
    endTransaction(store);
  } else {
    // Debounce the transaction if a new event is added to it.
    if (store[ATOMS_LOGGER_SYMBOL].transactionsDebounceTimeoutId !== undefined) {
      clearTimeout(store[ATOMS_LOGGER_SYMBOL].transactionsDebounceTimeoutId);
      endTransaction(store);
    }

    // Add the event to the current transaction.
    (store[ATOMS_LOGGER_SYMBOL].currentTransaction.transaction.events ??= []).push(eventMap);

    // HACK: logs that a promise was aborted before a new one is pending
    // -> In Jotai's code (`setAtomStateValueOrPromise`) the value of the promise is set **before** the abort event is triggered.
    //    This means that the abort event is added in the transaction after the new pending promise event.
    //    This hack just swap their order to make the log more readable.
    if (eventMap.initialPromiseAborted || eventMap.changedPromiseAborted) {
      const events = store[ATOMS_LOGGER_SYMBOL].currentTransaction.transaction.events;
      if (events.length > 1) {
        const eventBeforeAbort = events[events.length - 2];
        if (eventBeforeAbort?.initialPromisePending || eventBeforeAbort?.changedPromisePending) {
          events[events.length - 2] = eventMap;
          events[events.length - 1] = eventBeforeAbort;
        }
      }
    }
  }
}
