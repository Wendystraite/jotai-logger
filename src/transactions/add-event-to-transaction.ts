import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import { shouldSetStateInEvent } from '../log-atom-event/event-log-pipeline.js';
import {
  AtomsLoggerEventTypes,
  AtomsLoggerTransactionTypes,
  type AtomId,
  type AtomsLoggerEvent,
  type AtomsLoggerEventMap,
  type AtomsLoggerTransaction,
  type StoreWithAtomsLogger,
} from '../types/atoms-logger.js';
import { convertAtomsToStrings } from '../utils/convert-atoms-to-strings.js';
import { shouldShowAtom } from '../utils/should-show-atom.js';
import { debounceEndTransaction } from './debounce-end-transaction.js';
import { endTransaction } from './end-transaction.js';
import { startTransaction } from './start-transaction.js';

export function addEventToTransaction(store: StoreWithAtomsLogger, event: AtomsLoggerEvent): void {
  if (!shouldShowAtom(store, event.atom)) {
    return;
  }

  if (updateDependencies(store, event).shouldNotAddEvent) {
    return;
  }

  setStateInEvent(store, event);

  const transaction = store[ATOMS_LOGGER_SYMBOL].currentTransaction;

  if (!transaction) {
    // Execute the event in an independent "unknown" transaction if there is no current transaction.
    startTransaction(store, { type: AtomsLoggerTransactionTypes.unknown, atom: event.atom });
    addEventToTransaction(store, event);
    endTransaction(store);
    return;
  }

  // Debounce the transaction since a new event is added to it.
  if (store[ATOMS_LOGGER_SYMBOL].transactionsDebounceTimeoutId !== undefined) {
    debounceEndTransaction(store);
  }

  // Add the event to the current transaction.
  transaction.events.push(event);

  // Compute/reorder the events in the transaction.
  mergeChangedEvents(transaction, event);
  reversePromiseAbortedAndPending(transaction, event);
}

/**
 * Update the dependencies map if the event is a dependency change.
 */
function updateDependencies(
  store: StoreWithAtomsLogger,
  event: AtomsLoggerEvent,
): { shouldNotAddEvent: boolean } {
  if (event.type === AtomsLoggerEventTypes.dependenciesChanged) {
    const atom = event.atom;

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
function setStateInEvent(store: StoreWithAtomsLogger, event: AtomsLoggerEvent): void {
  if (typeof event.atom === 'string' || !shouldSetStateInEvent(event)) return;

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
  event: AtomsLoggerEvent,
): void {
  if (
    event.type === AtomsLoggerEventTypes.initialPromiseAborted ||
    event.type === AtomsLoggerEventTypes.changedPromiseAborted
  ) {
    const events = transaction.events;
    if (events.length > 1) {
      const eventBeforeAbort = events[events.length - 2];
      if (
        eventBeforeAbort?.type === AtomsLoggerEventTypes.initialPromisePending ||
        eventBeforeAbort?.type === AtomsLoggerEventTypes.changedPromisePending
      ) {
        events[events.length - 2] = event;
        events[events.length - 1] = eventBeforeAbort;
      }
    }
  }
}

/**
 * Merge multiple "changed" events that occurs in the same transaction to prevent spam.
 */
function mergeChangedEvents(transaction: AtomsLoggerTransaction, event: AtomsLoggerEvent): void {
  if (event.type === AtomsLoggerEventTypes.changed) {
    const events = transaction.events;
    const previousChangedEventIndex = events.findIndex(
      (previousEvent) =>
        previousEvent !== event &&
        previousEvent.type === AtomsLoggerEventTypes.changed &&
        previousEvent.atom === event.atom,
    );
    if (previousChangedEventIndex > -1) {
      const [previousChangedEvent] = events.splice(previousChangedEventIndex, 1) as [
        AtomsLoggerEventMap[AtomsLoggerEventTypes['changed']],
      ];
      const oldValues: unknown[] = [];
      if (previousChangedEvent.oldValues !== undefined) {
        oldValues.push(...previousChangedEvent.oldValues);
      } else {
        oldValues.push(previousChangedEvent.oldValue);
      }
      oldValues.push(event.oldValue);
      event.oldValues = oldValues;
      delete event.oldValue;
    }
  }
}
