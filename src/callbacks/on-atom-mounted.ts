import type { Atom } from 'jotai';

import { addEventToTransaction } from '../transactions/add-event-to-transaction.js';
import type { StoreWithAtomsLogger } from '../types/atoms-logger.js';

export function getOnAtomMounted(store: StoreWithAtomsLogger) {
  return function onAtomMounted(atom: Atom<unknown>) {
    addEventToTransaction(store, { mounted: { atom } });
  };
}
