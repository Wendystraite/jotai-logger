import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import type {
  AtomsLoggerEventBase,
  AtomsLoggerEventMap,
  AtomsLoggerTransaction,
  StoreWithAtomsLogger,
} from '../types/atoms-logger.js';
import { convertAtomsToStrings } from '../utils/convert-atoms-to-strings.js';
import { getEventMapEvent } from '../utils/get-event-map-event.js';
import { getTransactionMapTransaction } from '../utils/get-transaction-map-transaction.js';
import { shouldShowAtom } from '../utils/should-show-atom.js';
import { endTransaction } from './end-transaction.js';
import { startTransaction } from './start-transaction.js';

export function addEventToTransaction(
  store: StoreWithAtomsLogger,
  eventMap: AtomsLoggerEventMap,
): void {
  const event = getEventMapEvent(eventMap);

  if (!shouldShowAtom(store, event.atom)) {
    return;
  }

  setStateInEvent(store, event);

  const currentTransactionMap = store[ATOMS_LOGGER_SYMBOL].currentTransaction;

  if (!currentTransactionMap) {
    // Execute the event in an independent "unknown" transaction if there is no current transaction.
    startTransaction(store, { unknown: { atom: event.atom } });
    addEventToTransaction(store, eventMap);
    endTransaction(store);
    return;
  }

  const transaction = getTransactionMapTransaction(currentTransactionMap);

  // Debounce the transaction since a new event is added to it.
  if (store[ATOMS_LOGGER_SYMBOL].transactionsDebounceTimeoutId !== undefined) {
    endTransaction(store);
  }

  // Add the event to the current transaction.
  (transaction.events ??= []).push(eventMap);

  // Compute/reorder the events in the transaction.
  mergeChangedEvents(transaction, eventMap);
  reversePromiseAbortedAndPending(transaction, eventMap);
}

/**
 * Set the state of the atom in the event.
 */
function setStateInEvent(store: StoreWithAtomsLogger, event: AtomsLoggerEventBase): void {
  if (typeof event.atom === 'string') {
    return;
  }

  const options = store[ATOMS_LOGGER_SYMBOL];

  const atomState = store[ATOMS_LOGGER_SYMBOL].getState(event.atom);
  if (atomState) {
    if (atomState.d.size > 0) {
      event.dependencies = convertAtomsToStrings(atomState.d.keys(), options);
    }
    if (atomState.p.size > 0) {
      event.pendingPromises = convertAtomsToStrings(atomState.p.keys(), options);
    }
  }

  const mountedState = store[ATOMS_LOGGER_SYMBOL].getMounted(event.atom);
  if (mountedState) {
    if (mountedState.d.size > 0) {
      event.mountedDependencies = convertAtomsToStrings(mountedState.d.values(), options);
    }
    if (mountedState.t.size > 0) {
      event.mountedDependents = convertAtomsToStrings(mountedState.t.values(), options);
    }
  }
}

/**
 * HACK: logs that a promise was aborted before a new one is pending
 *
 * In Jotai's code (`setAtomStateValueOrPromise`) the value of the promise is set **before** the abort event is triggered.
 * This means that the abort event is added in the transaction after the new pending promise event.
 * This hack just swap their order to make the log more readable.
 */
function reversePromiseAbortedAndPending(
  transaction: AtomsLoggerTransaction,
  eventMap: AtomsLoggerEventMap,
): void {
  if (eventMap.initialPromiseAborted || eventMap.changedPromiseAborted) {
    const events = transaction.events;
    if (events && events.length > 1) {
      const eventBeforeAbort = events[events.length - 2];
      if (eventBeforeAbort?.initialPromisePending || eventBeforeAbort?.changedPromisePending) {
        events[events.length - 2] = eventMap;
        events[events.length - 1] = eventBeforeAbort;
      }
    }
  }
}

/**
 * Merge multiple "changed" events that occurs in the same transaction to prevent spam.
 */
function mergeChangedEvents(
  transaction: AtomsLoggerTransaction,
  eventMap: AtomsLoggerEventMap,
): void {
  if (eventMap.changed !== undefined) {
    const changedEvent = getEventMapEvent(eventMap) as NonNullable<AtomsLoggerEventMap['changed']>;
    const events = transaction.events;
    const previousChangedEventIndex = events?.findIndex(
      (previousEventMap) =>
        previousEventMap !== eventMap && previousEventMap.changed?.atom === changedEvent.atom,
    );
    if (events && previousChangedEventIndex !== undefined && previousChangedEventIndex > -1) {
      const [previousChangedEventMap] = events.splice(previousChangedEventIndex, 1);
      const previousChangedEvent = previousChangedEventMap?.changed;
      if (previousChangedEvent !== undefined) {
        const oldValues: unknown[] = [];
        if (previousChangedEvent.oldValues !== undefined) {
          oldValues.push(...previousChangedEvent.oldValues);
        } else {
          oldValues.push(previousChangedEvent.oldValue);
        }
        oldValues.push(changedEvent.oldValue);
        changedEvent.oldValues = oldValues;
        delete changedEvent.oldValue;
      }
    }
  }
}
