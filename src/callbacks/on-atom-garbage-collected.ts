import { addEventToTransaction } from '../transactions/add-event-to-transaction.js';
import {
  AtomsLoggerEventTypes,
  type AtomId,
  type StoreWithAtomsLogger,
} from '../types/atoms-logger.js';

export function getOnAtomGarbageCollected(store: StoreWithAtomsLogger) {
  return function onAtomGarbageCollected(atom: AtomId): void {
    addEventToTransaction(store, { type: AtomsLoggerEventTypes.destroyed, atom });
  };
}
