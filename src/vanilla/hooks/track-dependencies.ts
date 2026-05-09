import type {
  INTERNAL_BuildingBlocks as BuildingBlocks,
  INTERNAL_StoreHooks as StoreHooks,
} from 'jotai/vanilla/internals';

import { addEventToTransaction } from '../transactions/add-event-to-transaction.js';
import type { AnyAtom } from '../types/event.js';
import { AtomEventTypes } from '../types/event.js';
import type { AtomLoggerStoreState } from '../types/store.js';
import { filterAtoms } from '../utils/filter-atoms.js';
import { shouldSetStateInEvent } from '../utils/should-set-state-in-event.js';
import { shouldShowAtom } from '../utils/should-show-atom.js';

/**
 * Track dependencies and dependents of atoms.
 */
export function trackDependencies(
  storeHooks: Required<StoreHooks>,
  loggerState: AtomLoggerStoreState,
  buildingBlocks: Readonly<BuildingBlocks>,
) {
  // Previous dependencies map to compare against for changes.
  const previousDependenciesMap = new WeakMap<AnyAtom, Set<AnyAtom>>();

  // Dependents of an atom that are not yet in its mounted state (mounted.t)
  const dependentsMap = new WeakMap<AnyAtom, Set<AnyAtom>>();

  // Track dependencies changes when they are read
  const onAtomRead = (atom: AnyAtom) => {
    if (!shouldShowAtom(loggerState, atom)) return;

    const atomStateMap = buildingBlocks[0];
    const atomState = atomStateMap.get(atom);
    /* v8 ignore next -- storeHooks.r fires only after atomState.v is set by setAtomStateValueOrPromise -- @preserve */
    if (!atomState) return;

    // Update previous and new dependencies maps
    const newDependencies = new Set<AnyAtom>();
    for (const dependency of atomState.d.keys()) {
      if (shouldShowAtom(loggerState, dependency)) {
        newDependencies.add(dependency);
      }
    }
    loggerState.dependenciesMap.set(atom, newDependencies);

    const previousDependencies = previousDependenciesMap.get(atom);
    previousDependenciesMap.set(atom, newDependencies);
    if (previousDependencies === undefined) return;

    // Diff previous and new dependencies to find added and removed dependencies.
    const addedDependencies = new Set<AnyAtom>();
    for (const d of newDependencies) if (!previousDependencies.has(d)) addedDependencies.add(d);
    const removedDependencies = new Set<AnyAtom>();
    for (const d of previousDependencies) if (!newDependencies.has(d)) removedDependencies.add(d);
    if (!addedDependencies.size && !removedDependencies.size) return;

    // For each added dependency, track the current atom as a pending dependent so that
    // when the dep is mounted, its events can be patched with the correct dependents.
    for (const addedDependency of addedDependencies) {
      const dependents = dependentsMap.get(addedDependency) ?? new Set<AnyAtom>();
      dependents.add(atom);
      dependentsMap.set(addedDependency, dependents);
    }

    addEventToTransaction(loggerState, buildingBlocks, {
      type: AtomEventTypes.dependenciesChanged,
      atom,
      ...(newDependencies.size ? { dependencies: newDependencies } : {}),
      ...(previousDependencies.size ? { oldDependencies: previousDependencies } : {}),
      ...(addedDependencies.size ? { addedDependencies: addedDependencies } : {}),
      ...(removedDependencies.size ? { removedDependencies: removedDependencies } : {}),
    });
  };

  // Retroactively patch dependents in events:
  const onAtomMounted = (atom: AnyAtom) => {
    // Case 1 : for each dep of the newly mounted atom, patch the dep's own events.
    updateDependentsOfAtomDependenciesInEvents(atom);
    // Case 2 : for the atom itself, when it is a freshly mounted dep of an already-mounted parent.
    updateDependentsOfAtomInEvents(atom);
  };

  /**
   * Case 1 : initial mount.
   * Jotai calls `aMounted.t.add(atom)` on every dep BEFORE storeHooks.m(atom) fires,
   * so `dep.t` is already final here. Patch each dep's events with the complete dependents set.
   */
  const updateDependentsOfAtomDependenciesInEvents = (atom: AnyAtom) => {
    const atomStateMap = buildingBlocks[0];
    const mountedMap = buildingBlocks[1];

    const atomState = atomStateMap.get(atom);
    /* v8 ignore next -- storeHooks.m fires only after mountAtom ensures atomState exists -- @preserve */
    if (!atomState) return;

    const currentTransactionEvents = loggerState.currentTransaction?.events;
    /* v8 ignore next -- is always inside a transaction -- @preserve */
    if (!currentTransactionEvents) return;

    for (const dependency of atomState.d.keys()) {
      if (!shouldShowAtom(loggerState, dependency)) continue;

      const dependencyMounted = mountedMap.get(dependency);
      /* v8 ignore next -- in Case 1, mountAtom mounts all deps before storeHooks.m(parent) fires -- @preserve */
      if (!dependencyMounted) continue;

      const dependents = filterAtoms(dependencyMounted.t, loggerState);
      updateDependentsInEvents(dependency, dependents);
    }
  };

  /**
   * Case 2 : dep freshly mounted by `mountDependencies` whose parent is already mounted.
   * Patch atom's own events with its future dependents (including parents not yet in atom.t).
   */
  const updateDependentsOfAtomInEvents = (atom: AnyAtom) => {
    if (!shouldShowAtom(loggerState, atom)) return;
    const dependents = dependentsMap.get(atom);
    dependentsMap.delete(atom);
    updateDependentsInEvents(atom, dependents);
  };

  /**
   * Retroactively update the dependents of the atom in the events of the current transaction.
   */
  const updateDependentsInEvents = (atom: AnyAtom, dependents: Set<AnyAtom> | undefined) => {
    const currentTransactionEvents = loggerState.currentTransaction?.events;
    /* v8 ignore next -- is always inside a transaction -- @preserve */
    if (!currentTransactionEvents) return;

    for (const event of currentTransactionEvents) {
      if (event.atom === atom && shouldSetStateInEvent(event)) {
        if (dependents?.size) event.dependents = dependents;
        else delete event.dependents;
      }
    }
  };

  storeHooks.r.add(undefined, onAtomRead);
  storeHooks.m.add(undefined, onAtomMounted);
}
