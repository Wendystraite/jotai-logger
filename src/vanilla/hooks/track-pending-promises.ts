import { INTERNAL_isPromiseLike as isPromiseLike } from 'jotai/vanilla/internals';
import type {
  INTERNAL_BuildingBlocks as BuildingBlocks,
  INTERNAL_StoreHooks as StoreHooks,
} from 'jotai/vanilla/internals';

import type { AnyAtom } from '../types/event.js';
import type { AtomLoggerStoreState } from '../types/store.js';
import { filterAtoms } from '../utils/filter-atoms.js';
import { shouldSetStateInEvent } from '../utils/should-set-state-in-event.js';
import { shouldShowAtom } from '../utils/should-show-atom.js';

/**
 * Tracks pending promises of atoms.
 */
export function trackPendingPromises(
  storeHooks: Required<StoreHooks>,
  loggerState: AtomLoggerStoreState,
  buildingBlocks: Readonly<BuildingBlocks>,
) {
  const onAtomRead = (atom: AnyAtom) => {
    const atomStateMap = buildingBlocks[0];
    const atomState = atomStateMap.get(atom);
    if (!atomState || !isPromiseLike(atomState.v)) return;

    const currentTransactionEvents = loggerState.currentTransaction?.events;
    /* v8 ignore next -- is always inside a transaction -- @preserve */
    if (!currentTransactionEvents) return;

    for (const dependency of atomState.d.keys()) {
      if (!shouldShowAtom(loggerState, dependency)) continue;
      const dependencyAtomState = atomStateMap.get(dependency);
      const pendingPromises = filterAtoms(dependencyAtomState?.p, loggerState);
      for (const event of currentTransactionEvents) {
        if (event.atom === dependency && shouldSetStateInEvent(event)) {
          /* v8 ignore next -- dep passed shouldShowAtom so filterAtoms always returns non-empty -- @preserve */
          if (pendingPromises?.size) event.pendingPromises = pendingPromises;
          else delete event.pendingPromises;
        }
      }
    }
  };

  storeHooks.r.add(undefined, onAtomRead);
}
