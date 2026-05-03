import { atomLoggerStoreSymbol } from '../consts/store-symbol.js';
import type { AnyAtom, AtomId } from '../types/event.js';
import type { AtomLoggerStore } from '../types/store.js';

export function shouldShowAtom(store: AtomLoggerStore, atom: AnyAtom | AtomId): boolean {
  if (!store[atomLoggerStoreSymbol].enabled) {
    return false;
  }
  if (typeof atom === 'string') {
    return true;
  }
  if (!store[atomLoggerStoreSymbol].shouldShowPrivateAtoms && atom.debugPrivate === true) {
    return false;
  }
  if (store[atomLoggerStoreSymbol].shouldShowAtom) {
    return store[atomLoggerStoreSymbol].shouldShowAtom(atom);
  }
  return true;
}
