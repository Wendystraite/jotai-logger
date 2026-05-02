import { addEventToTransaction } from '../transactions/add-event-to-transaction.js';
import type { StoreWithAtomsLogger } from '../types/atoms-logger.js';
import { AtomsLoggerEventTypes, type AnyAtom } from '../types/event.js';

export function getOnAtomUnmounted(store: StoreWithAtomsLogger) {
  return function onAtomUnmounted(atom: AnyAtom) {
    addEventToTransaction(store, { type: AtomsLoggerEventTypes.unmounted, atom });
  };
}
