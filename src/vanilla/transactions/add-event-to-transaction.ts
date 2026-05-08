import type { INTERNAL_BuildingBlocks as BuildingBlocks } from 'jotai/vanilla/internals';

import { AtomEventTypes, type AtomEvent } from '../types/event.js';
import type { AtomLoggerStoreState } from '../types/store.js';
import { AtomTransactionTypes, type AtomTransaction } from '../types/transaction.js';
import { filterAtoms } from '../utils/filter-atoms.js';
import { shouldSetStateInEvent } from '../utils/should-set-state-in-event.js';
import { shouldShowAtom } from '../utils/should-show-atom.js';
import { debounceEndTransaction } from './debounce-end-transaction.js';
import { endTransaction } from './end-transaction.js';
import { startTransaction } from './start-transaction.js';

export function addEventToTransaction(
  loggerState: AtomLoggerStoreState,
  buildingBlocks: Readonly<BuildingBlocks>,
  event: AtomEvent,
): void {
  if (!shouldShowAtom(loggerState, event.atom)) {
    return;
  }

  setStateInEvent(loggerState, buildingBlocks, event);

  const transaction = loggerState.currentTransaction;

  if (!transaction) {
    // Execute the event in an independent "unknown" transaction if there is no current transaction.
    startTransaction(loggerState, { type: AtomTransactionTypes.unknown, atom: event.atom });
    addEventToTransaction(loggerState, buildingBlocks, event);
    endTransaction(loggerState);
    return;
  }

  // Debounce the transaction since a new event is added to it.
  if (loggerState.transactionsDebounceTimeoutId !== undefined) {
    debounceEndTransaction(loggerState);
  }

  // Add the event to the current transaction.
  transaction.events.push(event);

  // Reorder the events in the transaction.
  reversePromiseAbortedAndPending(transaction, event);
}

/**
 * Set the state of the atom in the event.
 */
function setStateInEvent(
  loggerState: AtomLoggerStoreState,
  buildingBlocks: Readonly<BuildingBlocks>,
  event: AtomEvent,
): void {
  if (typeof event.atom === 'string' || !shouldSetStateInEvent(event)) return;

  const dependencies = loggerState.dependenciesMap.get(event.atom);
  if (dependencies?.size) event.dependencies = dependencies;

  const parentMountedMap = buildingBlocks[1];
  const mountedState = parentMountedMap.get(event.atom);
  const dependents = filterAtoms(mountedState?.t, loggerState);
  if (dependents?.size) event.dependents = dependents;

  const parentAtomStateMap = buildingBlocks[0];
  const atomState = parentAtomStateMap.get(event.atom);
  const pendingPromises = filterAtoms(atomState?.p, loggerState);
  if (pendingPromises?.size) event.pendingPromises = pendingPromises;
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
