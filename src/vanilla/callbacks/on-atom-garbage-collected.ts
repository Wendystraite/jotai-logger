import type { INTERNAL_BuildingBlocks as BuildingBlocks } from 'jotai/vanilla/internals';

import { addEventToTransaction } from '../transactions/add-event-to-transaction.js';
import { AtomEventTypes, type AtomId } from '../types/event.js';
import type { AtomLoggerStoreState } from '../types/store.js';

export function onAtomGarbageCollected(
  loggerState: AtomLoggerStoreState,
  parentBuildingBlocks: Readonly<BuildingBlocks>,
  atom: AtomId,
): void {
  addEventToTransaction(loggerState, parentBuildingBlocks, {
    type: AtomEventTypes.destroyed,
    atom,
  });
}
