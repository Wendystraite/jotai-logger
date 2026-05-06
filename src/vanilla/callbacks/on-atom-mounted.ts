import type { INTERNAL_BuildingBlocks as BuildingBlocks } from 'jotai/vanilla/internals';

import { addEventToTransaction } from '../transactions/add-event-to-transaction.js';
import { AtomEventTypes, type AnyAtom } from '../types/event.js';
import type { AtomLoggerStoreState } from '../types/store.js';
import { getAtomValue } from '../utils/get-atom-value.js';

export function onAtomMounted(
  loggerState: AtomLoggerStoreState,
  parentBuildingBlocks: Readonly<BuildingBlocks>,
  atom: AnyAtom,
) {
  const { hasValue, value } = getAtomValue(loggerState, parentBuildingBlocks, atom);
  if (hasValue) {
    addEventToTransaction(loggerState, parentBuildingBlocks, {
      type: AtomEventTypes.mounted,
      atom,
      value,
    });
  } else {
    addEventToTransaction(loggerState, parentBuildingBlocks, {
      type: AtomEventTypes.mounted,
      atom,
    });
  }
}
