import { addEventToTransaction } from '../transactions/add-event-to-transaction.js';
import type { AnyAtom, StoreWithAtomsLogger } from '../types/atoms-logger.js';

export function getOnAtomUnmounted(store: StoreWithAtomsLogger) {
  return function onAtomUnmounted(atom: AnyAtom) {
    addEventToTransaction(store, { unmounted: { atom } });
  };
}
