import { addEventToTransaction } from '../transactions/add-event-to-transaction.js';
import type { AtomId, StoreWithAtomsLogger } from '../types/atoms-logger.js';

export function getOnAtomGarbageCollected(store: StoreWithAtomsLogger) {
  return function onAtomGarbageCollected(atom: AtomId): void {
    addEventToTransaction(store, { destroyed: { atom } });
  };
}
