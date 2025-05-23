import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import type {
  AnyAtom,
  AtomId,
  AtomsLoggerTransaction,
  StoreWithAtomsLogger,
} from '../types/atoms-logger.js';
import { getTransactionMapTransaction } from '../utils/get-transaction-map-transaction.js';

export function flushTransactionEvents(store: StoreWithAtomsLogger): void {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- should never happen since it is called in endTransaction
  const transactionMap = store[ATOMS_LOGGER_SYMBOL].currentTransaction!;
  const transaction = getTransactionMapTransaction(transactionMap);

  store[ATOMS_LOGGER_SYMBOL].currentTransaction = undefined;

  // Cleanup the dependencies events that have not changed since the last transaction.
  cleanupDependencyChangedEvents(store, transaction);

  // If the transaction has no events, we don't need to log it.
  if (!transaction.events?.length) {
    return;
  }

  transaction.transactionNumber = store[ATOMS_LOGGER_SYMBOL].transactionNumber += 1;

  // Add current transaction to scheduler instead of executing immediately
  store[ATOMS_LOGGER_SYMBOL].logTransactionsScheduler.add(transactionMap);
}

/**
 * Cleanup the dependencies events that have not changed since the last
 * transaction or that are duplicated.
 */
function cleanupDependencyChangedEvents(
  store: StoreWithAtomsLogger,
  transaction: AtomsLoggerTransaction,
): void {
  if (!transaction.events) return;

  const existingDependencyChangedEventsMap = new WeakMap<AnyAtom, boolean>();

  for (let i = transaction.events.length - 1; i >= 0; i -= 1) {
    const eventMap = transaction.events[i];
    if (!eventMap?.dependenciesChanged) {
      continue;
    }

    const event = eventMap.dependenciesChanged;
    const atom = event.atom as AnyAtom;

    // Remove the event if it is a duplicate
    if (existingDependencyChangedEventsMap.has(atom)) {
      transaction.events.splice(i, 1);
      continue;
    }
    existingDependencyChangedEventsMap.set(atom, true);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- should always be set in this event
    const newDependencies = event.dependencies!;

    event.oldDependencies = store[ATOMS_LOGGER_SYMBOL].prevTransactionDependenciesMap.get(atom);

    store[ATOMS_LOGGER_SYMBOL].prevTransactionDependenciesMap.set(atom, newDependencies);

    // Don't log initial dependencies or dependencies that are not changed
    if (
      event.oldDependencies === undefined ||
      !hasDependenciesChanged(event.oldDependencies, newDependencies)
    ) {
      transaction.events.splice(i, 1);
      continue;
    }
  }
}

/**
 * Checks if the dependencies have changed.
 */
function hasDependenciesChanged(
  oldDependencies: Set<AtomId>,
  newDependencies: Set<AtomId>,
): boolean {
  if (oldDependencies.size !== newDependencies.size) {
    return true;
  }

  for (const dep of oldDependencies) {
    if (!newDependencies.has(dep)) {
      return true;
    }
  }

  return false;
}
