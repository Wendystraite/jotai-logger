import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import { shouldSetStateInEvent } from '../log-atom-event/event-log-pipeline.js';
import type {
  AnyAtom,
  AtomId,
  AtomsLoggerEventBase,
  AtomsLoggerEventMap,
  AtomsLoggerTransaction,
  StoreWithAtomsLogger,
} from '../types/atoms-logger.js';
import { convertAtomsToStrings } from '../utils/convert-atoms-to-strings.js';
import { getEventMapEvent } from '../utils/get-event-map-event.js';
import { getTransactionMapTransaction } from '../utils/get-transaction-map-transaction.js';
import { shouldShowAtom } from '../utils/should-show-atom.js';
import { debounceEndTransaction } from './debounce-end-transaction.js';
import { endTransaction } from './end-transaction.js';
import { startTransaction } from './start-transaction.js';

export function addEventToTransaction(
  store: StoreWithAtomsLogger,
  partialEventMap: {
    [K in keyof AtomsLoggerEventMap]: Omit<
      NonNullable<AtomsLoggerEventMap[K]>,
      Exclude<keyof AtomsLoggerEventBase, 'atom'>
    >;
  },
): void {
  const eventMap = partialEventMap as AtomsLoggerEventMap;

  const event = getEventMapEvent(eventMap);

  if (!shouldShowAtom(store, event.atom)) {
    return;
  }

  if (updateDependencies(store, eventMap).shouldNotAddEvent) {
    return;
  }

  setStateInEvent(store, eventMap, event);

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
    debounceEndTransaction(store);
  }

  // Add the event to the current transaction.
  transaction.events.push(eventMap);

  // Compute/reorder the events in the transaction.
  mergeChangedEvents(transaction, eventMap);
  reversePromiseAbortedAndPending(transaction, eventMap);
}

/**
 * Update the dependencies map if the event is a dependency change.
 */
function updateDependencies(
  store: StoreWithAtomsLogger,
  eventMap: AtomsLoggerEventMap,
): { shouldNotAddEvent: boolean } {
  if (eventMap.dependenciesChanged) {
    const event = eventMap.dependenciesChanged;
    const atom = event.atom as AnyAtom;

    // Don't update dependencies if the added dependency is ignored
    if (event.addedDependency && !shouldShowAtom(store, event.addedDependency)) {
      return { shouldNotAddEvent: true };
    }

    let newDependencies: Set<AtomId>;
    if (event.clearedDependencies) {
      newDependencies = new Set();
    } else {
      const currentDependencies = store[ATOMS_LOGGER_SYMBOL].dependenciesMap.get(atom);
      newDependencies = new Set(currentDependencies).add(event.addedDependency.toString());
    }

    store[ATOMS_LOGGER_SYMBOL].dependenciesMap.set(atom, newDependencies);
  }
  return { shouldNotAddEvent: false };
}

/**
 * Set the state of the atom in the event.
 */
function setStateInEvent(
  store: StoreWithAtomsLogger,
  eventMap: AtomsLoggerEventMap,
  event: AtomsLoggerEventBase,
): void {
  if (typeof event.atom === 'string' || !shouldSetStateInEvent(eventMap)) return;

  event.dependencies = store[ATOMS_LOGGER_SYMBOL].dependenciesMap.get(event.atom);

  const options = store[ATOMS_LOGGER_SYMBOL];

  const mountedState = store[ATOMS_LOGGER_SYMBOL].getMounted(event.atom);
  event.dependents = convertAtomsToStrings(mountedState?.t.values(), options);

  const atomState = store[ATOMS_LOGGER_SYMBOL].getState(event.atom);
  event.pendingPromises = convertAtomsToStrings(atomState?.p.values(), options);
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
    if (events.length > 1) {
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
    const previousChangedEventIndex = events.findIndex(
      (previousEventMap) =>
        previousEventMap !== eventMap && previousEventMap.changed?.atom === changedEvent.atom,
    );
    if (previousChangedEventIndex > -1) {
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
