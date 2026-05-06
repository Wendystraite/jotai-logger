import type { INTERNAL_BuildingBlocks as BuildingBlocks } from 'jotai/vanilla/internals';

import { AtomEventTypes, type AtomEvent, type AtomEventMap } from '../types/event.js';
import type { AtomLoggerStoreState } from '../types/store.js';
import { AtomTransactionTypes, type AtomTransaction } from '../types/transaction.js';
import { convertAtomsToStrings } from '../utils/convert-atoms-to-strings.js';
import { shouldSetStateInEvent } from '../utils/should-set-state-in-event.js';
import { shouldShowAtom } from '../utils/should-show-atom.js';
import { debounceEndTransaction } from './debounce-end-transaction.js';
import { endTransaction } from './end-transaction.js';
import { startTransaction } from './start-transaction.js';

export function addEventToTransaction(
  loggerState: AtomLoggerStoreState,
  parentBuildingBlocks: Readonly<BuildingBlocks>,
  event: AtomEvent,
): void {
  if (!shouldShowAtom(loggerState, event.atom)) {
    return;
  }

  setStateInEvent(loggerState, parentBuildingBlocks, event);

  const transaction = loggerState.currentTransaction;

  if (!transaction) {
    // Execute the event in an independent "unknown" transaction if there is no current transaction.
    startTransaction(loggerState, { type: AtomTransactionTypes.unknown, atom: event.atom });
    addEventToTransaction(loggerState, parentBuildingBlocks, event);
    endTransaction(loggerState);
    return;
  }

  // Debounce the transaction since a new event is added to it.
  if (loggerState.transactionsDebounceTimeoutId !== undefined) {
    debounceEndTransaction(loggerState);
  }

  // Add the event to the current transaction.
  transaction.events.push(event);
  transaction.eventsCount += 1;

  // Compute/reorder the events in the transaction.
  mergeChangedEvents(transaction, event);
  reversePromiseAbortedAndPending(transaction, event);
}

/**
 * Set the state of the atom in the event.
 */
function setStateInEvent(
  loggerState: AtomLoggerStoreState,
  parentBuildingBlocks: Readonly<BuildingBlocks>,
  event: AtomEvent,
): void {
  if (typeof event.atom === 'string' || !shouldSetStateInEvent(event)) return;

  event.dependencies = loggerState.dependenciesMap.get(event.atom);

  const parentMountedMap = parentBuildingBlocks[1];
  const mountedState = parentMountedMap.get(event.atom);
  event.dependents = convertAtomsToStrings(mountedState?.t, loggerState);

  const parentAtomStateMap = parentBuildingBlocks[0];
  const atomState = parentAtomStateMap.get(event.atom);
  event.pendingPromises = convertAtomsToStrings(atomState?.p, loggerState);
}

/**
 * HACK: logs that a promise was aborted before a new one is pending
 *
 * In Jotai's code (`setAtomStateValueOrPromise`) the value of the promise is set **before** the abort event is triggered.
 * This means that the abort event is added in the transaction after the new pending promise event.
 * This hack just swap their order to make the log more readable.
 */
function reversePromiseAbortedAndPending(transaction: AtomTransaction, event: AtomEvent): void {
  if (
    event.type === AtomEventTypes.initialPromiseAborted ||
    event.type === AtomEventTypes.changedPromiseAborted
  ) {
    const events = transaction.events;
    /* v8 ignore next -- abort-as-only-event: the abort fires alone without a prior pending in the same transaction, which cannot happen in normal jotai usage -- @preserve */
    if (events.length > 1) {
      const eventBeforeAbort = events[events.length - 2];
      if (
        eventBeforeAbort?.type === AtomEventTypes.initialPromisePending ||
        eventBeforeAbort?.type === AtomEventTypes.changedPromisePending
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
function mergeChangedEvents(transaction: AtomTransaction, event: AtomEvent): void {
  if (event.type === AtomEventTypes.changed) {
    const previousChangedEventIndex = transaction.events.findIndex((previousEvent) => {
      return (
        previousEvent !== undefined &&
        previousEvent !== event &&
        previousEvent.type === AtomEventTypes.changed &&
        previousEvent.atom === event.atom
      );
    });
    if (previousChangedEventIndex > -1) {
      const previousChangedEvent = transaction.events[
        previousChangedEventIndex
      ] as AtomEventMap[AtomEventTypes['changed']];
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
