import { type INTERNAL_AtomState } from 'jotai/vanilla/internals';

import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import { addEventToTransaction } from '../transactions/add-event-to-transaction.js';
import type { StoreWithAtomsLogger } from '../types/atoms-logger.js';
import { AtomEventTypes, type AnyAtom, type AtomId } from '../types/event.js';
import { shouldShowAtom } from '../utils/should-show-atom.js';
import { onAtomValueChanged } from './on-atom-value-changed.js';

export function getOnAtomStateMapSet(store: StoreWithAtomsLogger) {
  return function onAtomStateMapSet(atom: AnyAtom, atomState: INTERNAL_AtomState): void {
    // atomStateMap.set is called once for each atom when it's created, so this is the earliest point at which we can track the atom and its dependencies.
    // We rely on this fact to set up the dependencies tracking before any dependencies are added, which allows us to capture the initial dependencies accurately.
    // See `ensureAtomState` in `src/vanilla/internals.ts` for reference.

    let isInitialValue = true;

    if (shouldShowAtom(store, atom)) {
      // Track the atom for garbage collection
      store[ATOMS_LOGGER_SYMBOL].atomsFinalizationRegistry.register(atom, atom.toString());

      // Initialize the dependencies map for this atom
      store[ATOMS_LOGGER_SYMBOL].dependenciesMap.set(atom, new Set());
    }

    // Track dependency additions
    const originalMapSet = atomState.d.set.bind(atomState.d);
    atomState.d.set = function mapSetProxy(addedDependency: AnyAtom, epochNumber: number) {
      const result = originalMapSet(addedDependency, epochNumber);

      if (!shouldShowAtom(store, atom) || !shouldShowAtom(store, addedDependency)) return result;

      const addedDepId = addedDependency.toString();

      // Update the dependencies map with the new dependency
      const currentDependencies = store[ATOMS_LOGGER_SYMBOL].dependenciesMap.get(atom);
      const newDependencies = new Set(currentDependencies).add(addedDepId);
      store[ATOMS_LOGGER_SYMBOL].dependenciesMap.set(atom, newDependencies);

      // Update the existing dependenciesChanged event incrementally if it exists
      /* v8 ignore next -- atomState.d.set should be called inside a transaction -- @preserve */
      const currentTransactionEvents = store[ATOMS_LOGGER_SYMBOL].currentTransaction?.events ?? [];
      for (const event of currentTransactionEvents) {
        if (event?.type === AtomEventTypes.dependenciesChanged && event.atom === atom) {
          event.dependencies = newDependencies;
          event.removedDependencies.delete(addedDepId);
          event.addedDependencies.add(addedDepId);
          return result;
        }
      }

      // Create a new dependenciesChanged event if there is no existing one
      // and the dep is genuinely new (not already in the baseline).
      const oldDependencies = store[ATOMS_LOGGER_SYMBOL].prevTransactionDependenciesMap.get(atom);
      if (oldDependencies !== undefined && !oldDependencies.has(addedDepId)) {
        addEventToTransaction(store, {
          type: AtomEventTypes.dependenciesChanged,
          atom,
          dependencies: newDependencies,
          oldDependencies,
          addedDependencies: new Set([addedDepId]),
          removedDependencies: new Set<AtomId>(),
        });
      }

      return result;
    };

    // Track dependency removals
    const originalMapDelete = atomState.d.delete.bind(atomState.d);
    atomState.d.delete = function mapDeleteProxy(removedDependency: AnyAtom) {
      const result = originalMapDelete(removedDependency);

      if (!shouldShowAtom(store, atom) || !shouldShowAtom(store, removedDependency)) return result;

      const removedDepId = removedDependency.toString();

      // Update the dependencies map with the removed dependency
      const currentDependencies = store[ATOMS_LOGGER_SYMBOL].dependenciesMap.get(atom);
      const newDependencies = new Set(currentDependencies);
      newDependencies.delete(removedDepId);
      store[ATOMS_LOGGER_SYMBOL].dependenciesMap.set(atom, newDependencies);

      // Update the existing dependenciesChanged event incrementally if it exists
      /* v8 ignore next -- atomState.d.set should be called inside a transaction -- @preserve */
      const currentTransactionEvents = store[ATOMS_LOGGER_SYMBOL].currentTransaction?.events ?? [];
      let hasUpdatedExistingDepsChangedEvent = false;
      for (const event of currentTransactionEvents) {
        if (event?.atom === atom) {
          // In jotai 2.18+, d.delete() fires AFTER the value is set (in `pruneDependencies`)
          // so retroactively update existing events for this atom with the new dependencies.
          event.dependencies = newDependencies;
          if (event.type === AtomEventTypes.dependenciesChanged) {
            event.removedDependencies.add(removedDepId);
            event.addedDependencies.delete(removedDepId);
            hasUpdatedExistingDepsChangedEvent = true;
          }
        }
      }
      if (hasUpdatedExistingDepsChangedEvent) return result;

      // Create a new dependenciesChanged event if there is no existing one
      // and the dep was genuinely in the baseline (not just added in this transaction).
      const oldDependencies = store[ATOMS_LOGGER_SYMBOL].prevTransactionDependenciesMap.get(atom);
      if (oldDependencies?.has(removedDepId)) {
        addEventToTransaction(store, {
          type: AtomEventTypes.dependenciesChanged,
          atom,
          dependencies: newDependencies,
          oldDependencies,
          addedDependencies: new Set<AtomId>(),
          removedDependencies: new Set([removedDepId]),
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
          onAtomValueChanged(store, atom, { isInitialValue, oldValue, newValue });
          isInitialValue = false;
        }
        return Reflect.set(target, prop, newValue);
      },
    });

    store[ATOMS_LOGGER_SYMBOL].prevAtomStateMapSet(atom, stateProxy);
  };
}
