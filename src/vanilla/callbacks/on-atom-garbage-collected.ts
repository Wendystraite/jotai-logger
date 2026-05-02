import { addEventToTransaction } from '../transactions/add-event-to-transaction.js';
import type { StoreWithAtomsLogger } from '../types/atoms-logger.js';
import { AtomEventTypes, type AtomId } from '../types/event.js';

export function getOnAtomGarbageCollected(store: StoreWithAtomsLogger) {
  return function onAtomGarbageCollected(atom: AtomId): void {
    addEventToTransaction(store, { type: AtomEventTypes.destroyed, atom });
  };
}
