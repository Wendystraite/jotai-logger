import type { INTERNAL_BuildingBlocks as BuildingBlocks } from 'jotai/vanilla/internals';

import { addEventToTransaction } from '../transactions/add-event-to-transaction.js';
import { AtomEventTypes, type AnyAtom } from '../types/event.js';
import type { AtomLoggerStoreState } from '../types/store.js';

export function onAtomUnmounted(
  loggerState: AtomLoggerStoreState,
  parentBuildingBlocks: Readonly<BuildingBlocks>,
  atom: AnyAtom,
) {
  addEventToTransaction(loggerState, parentBuildingBlocks, {
    type: AtomEventTypes.unmounted,
    atom,
  });
}
