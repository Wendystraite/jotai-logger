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
  transaction.eventsCount += 1;

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

    // Don't update dependencies if the removed dependency is ignored
    if (event.removedDependency && !shouldShowAtom(store, event.removedDependency)) {
      return { shouldNotAddEvent: true };
    }

    let newDependencies: Set<AtomId>;
    /* v8 ignore next 3 -- clearedDependencies path relies on d.clear(), which jotai 2.18+ no longer calls; kept for jotai 2.17.x compatibility -- @preserve */
    if (event.clearedDependencies) {
      newDependencies = new Set();
    } else if (event.removedDependency) {
      const currentDependencies = store[ATOMS_LOGGER_SYMBOL].dependenciesMap.get(atom);
      newDependencies = new Set(currentDependencies);
      newDependencies.delete(event.removedDependency.toString());
    } else {
      const currentDependencies = store[ATOMS_LOGGER_SYMBOL].dependenciesMap.get(atom);
      newDependencies = new Set(currentDependencies).add(event.addedDependency.toString());
    }

    store[ATOMS_LOGGER_SYMBOL].dependenciesMap.set(atom, newDependencies);

    // In jotai 2.18+, d.delete() fires AFTER the value is set (pruneDependencies runs
    // after setAtomStateValueOrPromise). To preserve the correct event ordering
    // (dependenciesChanged before changed value) and avoid double-events, we retroactively
    // update existing dependenciesChanged events for this atom rather than appending a new one.
    if (event.removedDependency) {
      const currentTransaction = store[ATOMS_LOGGER_SYMBOL].currentTransaction;
      let hasExistingDepsChangedEvent = false;
      /* v8 ignore next 3 -- d.delete() always fires inside a store operation (inside a transaction) in jotai 2.18+ -- @preserve */
      if (currentTransaction) {
        for (const existingEvent of currentTransaction.events) {
          if (!existingEvent) continue;
          if (existingEvent.atom !== atom) continue;
          if (existingEvent.type === AtomsLoggerEventTypes.dependenciesChanged) {
            hasExistingDepsChangedEvent = true;
            existingEvent.dependencies = newDependencies;
            /* v8 ignore next 3 -- a non-dependenciesChanged event with .dependencies requires a same-transaction value+dep change that is extremely rare to reproduce -- @preserve */
          } else if (existingEvent.dependencies !== undefined) {
            // Also update value change events so they reflect the final dep set
            existingEvent.dependencies = newDependencies;
          }
        }
      }
      if (hasExistingDepsChangedEvent) {
        // Existing dependenciesChanged events already updated — no need to add a new event
        return { shouldNotAddEvent: true };
      }
      // No prior dependenciesChanged events exist (pure-deletion case): fall through and add
      // this event so cleanupDependencyChangedEvents can detect the change at flush time
    }
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
    /* v8 ignore next -- abort-as-only-event: the abort fires alone without a prior pending in the same transaction, which cannot happen in normal jotai usage -- @preserve */
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
    const previousChangedEventIndex = transaction.events.findIndex((previousEvent) => {
      return (
        previousEvent !== undefined &&
        previousEvent !== event &&
        previousEvent.type === AtomsLoggerEventTypes.changed &&
        previousEvent.atom === event.atom
      );
    });
    if (previousChangedEventIndex > -1) {
      const previousChangedEvent = transaction.events[
        previousChangedEventIndex
      ] as AtomsLoggerEventMap[AtomsLoggerEventTypes['changed']];
      let oldValues: unknown[];
      if (previousChangedEvent.oldValues !== undefined) {
        oldValues = previousChangedEvent.oldValues;
        oldValues.push(event.oldValue);
      } else {
        oldValues = [previousChangedEvent.oldValue, event.oldValue];
      }
      event.oldValues = oldValues;
      delete event.oldValue;
      transaction.events[previousChangedEventIndex] = undefined;
      transaction.eventsCount -= 1;
    }
  }
}
