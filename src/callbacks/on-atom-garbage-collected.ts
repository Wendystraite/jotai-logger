import { addEventToTransaction } from '../transactions/add-event-to-transaction.js';
import type { StoreWithAtomsLogger } from '../types/atoms-logger.js';

export function getOnAtomGarbageCollected(store: StoreWithAtomsLogger) {
  return function onAtomGarbageCollected(atomId: string): void {
    addEventToTransaction(store, { destroyed: { atomId } });
  };
}
