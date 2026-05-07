import { AtomEventTypes } from '../types/event.js';
import type { AtomLoggerStoreState } from '../types/store.js';
import type { AtomTransaction } from '../types/transaction.js';

export function flushTransactionEvents(loggerState: AtomLoggerStoreState): void {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- should never happen since it is called in endTransaction
  const transaction = loggerState.currentTransaction!;

  loggerState.currentTransaction = undefined;

  // Update the previous dependency changed events for the current transaction.
  updatePreviousDependencyChangedEvents(loggerState, transaction);

  // If the transaction has no events, we don't need to log it.
  if (transaction.events.length <= 0) {
    return;
  }

  // Only increment the transaction number if the current transaction is logged
  loggerState.transactionNumber += 1;

  // Add current transaction to scheduler instead of executing immediately
  loggerState.logTransactionsScheduler.add(transaction);
}

function updatePreviousDependencyChangedEvents(
  loggerState: AtomLoggerStoreState,
  transaction: AtomTransaction,
): void {
  for (const event of transaction.events) {
    if (event.type === AtomEventTypes.dependenciesChanged) {
      // Update the previous dependencies with the new dependencies for the next transaction.
      loggerState.prevTransactionDependenciesMap.set(event.atom, event.dependencies);
    } else if (event.type === AtomEventTypes.initialized) {
      // Atoms initialized with only private deps produce no dependenciesChanged events, so
      // prevTransactionDependenciesMap is never set for them. Initialize it here so that
      // future dep additions can be correctly detected.
      const dependencies = loggerState.dependenciesMap.get(event.atom);
      /* v8 ignore next 3 -- dependenciesMap is always initialized for visible atoms in onAtomCreated -- @preserve */
      if (dependencies !== undefined) {
        loggerState.prevTransactionDependenciesMap.set(event.atom, dependencies);
      }
    }
  }
}
