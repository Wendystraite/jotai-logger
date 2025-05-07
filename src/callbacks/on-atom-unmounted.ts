import type { Atom } from 'jotai';

import { addEventToTransaction } from '../transactions/add-event-to-transaction.js';
import type { StoreWithAtomsLogger } from '../types/atoms-logger.js';

export function getOnAtomUnmounted(store: StoreWithAtomsLogger) {
  return function onAtomUnmounted(atom: Atom<unknown>) {
    addEventToTransaction(store, { unmounted: { atom } });
  };
}
