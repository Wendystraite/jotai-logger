import { addEventToTransaction } from '../transactions/add-event-to-transaction.js';
import { AtomEventTypes, type AnyAtom } from '../types/event.js';
import type { AtomLoggerStore } from '../types/store.js';
import { getAtomValue } from '../utils/get-atom-value.js';

export function onAtomMounted(store: AtomLoggerStore, atom: AnyAtom) {
  const { hasValue, value } = getAtomValue(store, atom);
  if (hasValue) {
    addEventToTransaction(store, { type: AtomEventTypes.mounted, atom, value });
  } else {
    addEventToTransaction(store, { type: AtomEventTypes.mounted, atom });
  }
}
