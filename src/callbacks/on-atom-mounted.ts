import type { Atom } from 'jotai';

import { addEventToTransaction } from '../transactions/add-event-to-transaction.js';
import type { StoreWithAtomsLogger } from '../types/atoms-logger.js';
import { getAtomValue } from '../utils/get-atom-value.js';

export function getOnAtomMounted(store: StoreWithAtomsLogger) {
  return function onAtomMounted(atom: Atom<unknown>) {
    const { hasValue, value } = getAtomValue(store, atom);
    if (hasValue) {
      addEventToTransaction(store, { mounted: { atom, value } });
    } else {
      addEventToTransaction(store, { mounted: { atom } });
    }
  };
}
