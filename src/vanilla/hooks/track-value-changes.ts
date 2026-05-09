import type {
  INTERNAL_BuildingBlocks as BuildingBlocks,
  INTERNAL_StoreHooks as StoreHooks,
} from 'jotai/vanilla/internals';

import { onAtomValueChanged } from '../callbacks/on-atom-value-changed.js';
import type { AnyAtom } from '../types/event.js';
import type { Store, AtomLoggerStoreState } from '../types/store.js';

/**
 * Track atom value initialization and changes.
 */
export function trackValueChanges(
  storeHooks: Required<StoreHooks>,
  loggedStore: Store,
  loggerState: AtomLoggerStoreState,
  buildingBlocks: Readonly<BuildingBlocks>,
) {
  const previousAtomValues = new WeakMap<AnyAtom, unknown>();

  /** Emit the initialized event when the atom first gets a value (via first read). */
  const onAtomRead = (atom: AnyAtom) => {
    if (previousAtomValues.has(atom)) return;

    const atomStateMap = buildingBlocks[0];
    const atomState = atomStateMap.get(atom);

    /* v8 ignore next -- value should always be present when storeHooks.r fires -- @preserve */
    if (!atomState || !('v' in atomState)) return;

    const newValue = atomState.v;
    previousAtomValues.set(atom, newValue);
    onAtomValueChanged(loggedStore, loggerState, buildingBlocks, atom, {
      isInitialValue: true,
      newValue,
    });
  };

  /** Emit changed (or initialized for write-before-read) when storeHooks.c fires. */
  const onAtomChanged = (atom: AnyAtom) => {
    const atomStateMap = buildingBlocks[0];
    const atomState = atomStateMap.get(atom);

    if (!atomState || !('v' in atomState)) return;

    const newValue = atomState.v;

    if (!previousAtomValues.has(atom)) {
      previousAtomValues.set(atom, newValue);
      onAtomValueChanged(loggedStore, loggerState, buildingBlocks, atom, {
        isInitialValue: true,
        newValue,
      });
    } else {
      const oldValue = previousAtomValues.get(atom);
      previousAtomValues.set(atom, newValue);
      onAtomValueChanged(loggedStore, loggerState, buildingBlocks, atom, {
        isInitialValue: false,
        oldValue,
        newValue,
      });
    }
  };

  storeHooks.r.add(undefined, onAtomRead);
  storeHooks.c.add(undefined, onAtomChanged);
}
