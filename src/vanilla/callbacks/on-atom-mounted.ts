import type { INTERNAL_BuildingBlocks as BuildingBlocks } from 'jotai/vanilla/internals';

import { addEventToTransaction } from '../transactions/add-event-to-transaction.js';
import { AtomEventTypes, type AnyAtom } from '../types/event.js';
import type { AtomLoggerStoreState } from '../types/store.js';
import { filterAtoms } from '../utils/filter-atoms.js';
import { getAtomValue } from '../utils/get-atom-value.js';
import { shouldSetStateInEvent } from '../utils/should-set-state-in-event.js';
import { shouldShowAtom } from '../utils/should-show-atom.js';

export function onAtomMounted(
  loggerState: AtomLoggerStoreState,
  buildingBlocks: Readonly<BuildingBlocks>,
  atom: AnyAtom,
) {
  const { hasValue, value } = getAtomValue(loggerState, buildingBlocks, atom);
  if (hasValue) {
    addEventToTransaction(loggerState, buildingBlocks, {
      type: AtomEventTypes.mounted,
      atom,
      value,
    });
  } else {
    addEventToTransaction(loggerState, buildingBlocks, {
      type: AtomEventTypes.mounted,
      atom,
    });
  }

  // Track dependents added to the mounted atom.
  // The dependents tracking is on mount since dependents are only relevant when the atom is mounted.
  // On the other hand, dependencies are tracked on atom creation since they are relevant even when the atom is not mounted.

  if (!shouldShowAtom(loggerState, atom)) return;

  const mountedMap = buildingBlocks[1];
  const mounted = mountedMap.get(atom);

  /* v8 ignore next -- mountedState always exists when the mount hook fires -- @preserve */
  if (!mounted) return;

  // Track dependents added to the mounted atom
  const originalMountedAdd = mounted.t.add.bind(mounted.t);
  mounted.t.add = function mountedAddProxy(dependentAtom: AnyAtom) {
    const result = originalMountedAdd(dependentAtom);

    /* v8 ignore next -- mountedAddProxy fires during mountAtom which is always within a transaction -- @preserve */
    const currentTransactionEvents = loggerState.currentTransaction?.events ?? [];

    // Retroactively update existing events for this atom with the new dependents
    const dependents = filterAtoms(mounted.t, loggerState);
    for (const event of currentTransactionEvents) {
      if (event.atom === atom && shouldSetStateInEvent(event)) {
        if (dependents?.size) event.dependents = dependents;
        else delete event.dependents;
      }
    }

    return result;
  };
}
