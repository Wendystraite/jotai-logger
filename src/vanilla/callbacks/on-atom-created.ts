import type { INTERNAL_BuildingBlocks as BuildingBlocks } from 'jotai/vanilla/internals';

import { addEventToTransaction } from '../transactions/add-event-to-transaction.js';
import { AtomEventTypes, type AnyAtom } from '../types/event.js';
import type { AtomLoggerStoreState, Store } from '../types/store.js';
import { shouldShowAtom } from '../utils/should-show-atom.js';
import { onAtomValueChanged } from './on-atom-value-changed.js';

export function onAtomCreated(
  store: Store,
  buildingBlocks: Readonly<BuildingBlocks>,
  loggerState: AtomLoggerStoreState,
  atom: AnyAtom,
): void {
  const atomStateMap = buildingBlocks[0];
  const atomState = atomStateMap.get(atom);

  /* v8 ignore next -- .i always fires with the atom just stored in atomStateMap -- @preserve */
  if (!atomState) return;

  let isInitialValue = true;

  if (shouldShowAtom(loggerState, atom)) {
    // Track the atom for garbage collection
    loggerState.atomsFinalizationRegistry.register(atom, atom.toString());

    // Initialize the dependencies map for this atom
    loggerState.dependenciesMap.set(atom, new Set());
  }

  // Track dependency additions
  const originalMapSet = atomState.d.set.bind(atomState.d);
  atomState.d.set = function mapSetProxy(addedDependency: AnyAtom, epochNumber: number) {
    const result = originalMapSet(addedDependency, epochNumber);

    if (!shouldShowAtom(loggerState, atom) || !shouldShowAtom(loggerState, addedDependency))
      return result;

    // Update the dependencies map with the new dependency
    const currentDependencies = loggerState.dependenciesMap.get(atom);
    const newDependencies = new Set(currentDependencies).add(addedDependency);
    loggerState.dependenciesMap.set(atom, newDependencies);

    // Update the existing dependenciesChanged event incrementally if it exists
    /* v8 ignore next -- atomState.d.set should be called inside a transaction -- @preserve */
    const currentTransactionEvents = loggerState.currentTransaction?.events ?? [];
    for (const event of currentTransactionEvents) {
      if (event?.type === AtomEventTypes.dependenciesChanged && event.atom === atom) {
        event.dependencies = newDependencies;
        event.removedDependencies.delete(addedDependency);
        event.addedDependencies.add(addedDependency);
        return result;
      }
    }

    // Create a new dependenciesChanged event if there is no existing one
    // and the dep is genuinely new (not already in the baseline).
    const oldDependencies = loggerState.prevTransactionDependenciesMap.get(atom);
    if (oldDependencies !== undefined && !oldDependencies.has(addedDependency)) {
      addEventToTransaction(loggerState, buildingBlocks, {
        type: AtomEventTypes.dependenciesChanged,
        atom,
        dependencies: newDependencies,
        oldDependencies,
        addedDependencies: new Set([addedDependency]),
        removedDependencies: new Set<AnyAtom>(),
      });
    }

    return result;
  };

  // Track dependency removals
  const originalMapDelete = atomState.d.delete.bind(atomState.d);
  atomState.d.delete = function mapDeleteProxy(removedDependency: AnyAtom) {
    const result = originalMapDelete(removedDependency);

    if (!shouldShowAtom(loggerState, atom) || !shouldShowAtom(loggerState, removedDependency))
      return result;

    // Update the dependencies map with the removed dependency
    const currentDependencies = loggerState.dependenciesMap.get(atom);
    const newDependencies = new Set(currentDependencies);
    newDependencies.delete(removedDependency);
    loggerState.dependenciesMap.set(atom, newDependencies);

    // Update the existing dependenciesChanged event incrementally if it exists
    /* v8 ignore next -- atomState.d.set should be called inside a transaction -- @preserve */
    const currentTransactionEvents = loggerState.currentTransaction?.events ?? [];
    let hasUpdatedExistingDepsChangedEvent = false;
    for (const event of currentTransactionEvents) {
      if (event?.atom === atom) {
        // In jotai 2.18+, d.delete() fires AFTER the value is set (in `pruneDependencies`)
        // so retroactively update existing events for this atom with the new dependencies.
        event.dependencies = newDependencies;
        if (event.type === AtomEventTypes.dependenciesChanged) {
          event.removedDependencies.add(removedDependency);
          event.addedDependencies.delete(removedDependency);
          hasUpdatedExistingDepsChangedEvent = true;
        }
      }
    }
    if (hasUpdatedExistingDepsChangedEvent) return result;

    // Create a new dependenciesChanged event if there is no existing one
    // and the dep was genuinely in the baseline (not just added in this transaction).
    const oldDependencies = loggerState.prevTransactionDependenciesMap.get(atom);
    if (oldDependencies?.has(removedDependency)) {
      addEventToTransaction(loggerState, buildingBlocks, {
        type: AtomEventTypes.dependenciesChanged,
        atom,
        dependencies: newDependencies,
        oldDependencies,
        addedDependencies: new Set<AnyAtom>(),
        removedDependencies: new Set([removedDependency]),
      });
    }

    return result;
  };

  // Track the values changes in the atom state.
  const stateProxy = new Proxy(atomState, {
    set(target, _prop, newValue: unknown, receiver) {
      const prop = _prop as keyof typeof target;
      if (prop === 'v') {
        const oldValue = Reflect.get(target, prop, receiver);
        onAtomValueChanged(store, loggerState, buildingBlocks, atom, {
          isInitialValue,
          oldValue,
          newValue,
        });
        isInitialValue = false;
      }
      return Reflect.set(target, prop, newValue);
    },
  });

  atomStateMap.set(atom, stateProxy);
}
