import { addEventToTransaction } from '../transactions/add-event-to-transaction.js';
import {
  AtomsLoggerEventTypes,
  type AnyAtom,
  type StoreWithAtomsLogger,
} from '../types/atoms-logger.js';

export function getOnAtomUnmounted(store: StoreWithAtomsLogger) {
  return function onAtomUnmounted(atom: AnyAtom) {
    addEventToTransaction(store, { type: AtomsLoggerEventTypes.unmounted, atom });
  };
}
