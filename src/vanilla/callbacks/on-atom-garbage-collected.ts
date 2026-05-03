import { addEventToTransaction } from '../transactions/add-event-to-transaction.js';
import { AtomEventTypes, type AtomId } from '../types/event.js';
import type { AtomLoggerStore } from '../types/store.js';

export function onAtomGarbageCollected(store: AtomLoggerStore, atom: AtomId): void {
  addEventToTransaction(store, { type: AtomEventTypes.destroyed, atom });
}
