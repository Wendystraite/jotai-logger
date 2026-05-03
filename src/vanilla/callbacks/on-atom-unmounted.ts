import { addEventToTransaction } from '../transactions/add-event-to-transaction.js';
import { AtomEventTypes, type AnyAtom } from '../types/event.js';
import type { AtomLoggerStore } from '../types/store.js';

export function getOnAtomUnmounted(store: AtomLoggerStore) {
  return function onAtomUnmounted(atom: AnyAtom) {
    addEventToTransaction(store, { type: AtomEventTypes.unmounted, atom });
  };
}
