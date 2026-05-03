import { atomLoggerStoreSymbol } from '../consts/store-symbol.js';
import { AtomEventTypes } from '../types/event.js';
import type { AtomLoggerStore } from '../types/store.js';
import type { AtomTransaction } from '../types/transaction.js';

export function flushTransactionEvents(store: AtomLoggerStore): void {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- should never happen since it is called in endTransaction
  const transaction = store[atomLoggerStoreSymbol].currentTransaction!;

  store[atomLoggerStoreSymbol].currentTransaction = undefined;

  // Update the previous dependency changed events for the current transaction.
  updatePreviousDependencyChangedEvents(store, transaction);

  // If the transaction has no events, we don't need to log it.
  if (transaction.eventsCount <= 0) {
    return;
  }

  // Only increment the transaction number if the current transaction is logged
  store[atomLoggerStoreSymbol].transactionNumber += 1;

  // Add current transaction to scheduler instead of executing immediately
  store[atomLoggerStoreSymbol].logTransactionsScheduler.add(transaction);
}

function updatePreviousDependencyChangedEvents(
  store: AtomLoggerStore,
  transaction: AtomTransaction,
): void {
  for (const event of transaction.events) {
    if (!event) continue;
    if (event.type === AtomEventTypes.dependenciesChanged) {
      // Update the previous dependencies with the new dependencies for the next transaction.
      store[atomLoggerStoreSymbol].prevTransactionDependenciesMap.set(
        event.atom,
        event.dependencies,
      );
    } else if (event.type === AtomEventTypes.initialized) {
      // Atoms initialized with only private deps produce no dependenciesChanged events, so
      // prevTransactionDependenciesMap is never set for them. Initialize it here so that
      // future dep additions can be correctly detected.
      const dependencies = store[atomLoggerStoreSymbol].dependenciesMap.get(event.atom);
      /* v8 ignore next 3 -- dependenciesMap is always initialized for visible atoms in getOnAtomStateMapSet -- @preserve */
      if (dependencies !== undefined) {
        store[atomLoggerStoreSymbol].prevTransactionDependenciesMap.set(event.atom, dependencies);
      }
    }
  }
}
