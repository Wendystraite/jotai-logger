import { addEventToTransaction } from '../transactions/add-event-to-transaction.js';
import { AtomEventTypes, type AnyAtom } from '../types/event.js';
import type { AtomLoggerStore } from '../types/store.js';

export function onAtomUnmounted(store: AtomLoggerStore, atom: AnyAtom) {
  addEventToTransaction(store, { type: AtomEventTypes.unmounted, atom });
}
