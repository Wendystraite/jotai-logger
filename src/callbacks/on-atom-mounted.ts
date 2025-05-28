import { addEventToTransaction } from '../transactions/add-event-to-transaction.js';
import {
  AtomsLoggerEventTypes,
  type AnyAtom,
  type StoreWithAtomsLogger,
} from '../types/atoms-logger.js';
import { getAtomValue } from '../utils/get-atom-value.js';

export function getOnAtomMounted(store: StoreWithAtomsLogger) {
  return function onAtomMounted(atom: AnyAtom) {
    const { hasValue, value } = getAtomValue(store, atom);
    if (hasValue) {
      addEventToTransaction(store, { type: AtomsLoggerEventTypes.mounted, atom, value });
    } else {
      addEventToTransaction(store, { type: AtomsLoggerEventTypes.mounted, atom });
    }
  };
}
