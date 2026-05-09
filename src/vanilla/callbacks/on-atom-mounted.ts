import type { INTERNAL_BuildingBlocks as BuildingBlocks } from 'jotai/vanilla/internals';

import { addEventToTransaction } from '../transactions/add-event-to-transaction.js';
import { AtomEventTypes, type AnyAtom } from '../types/event.js';
import type { AtomLoggerStoreState } from '../types/store.js';
import { getAtomValue } from '../utils/get-atom-value.js';

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
}
