import type { Atom } from 'jotai';

import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import type { StoreWithAtomsLogger } from '../types/atoms-logger.js';

export function shouldShowAtom(store: StoreWithAtomsLogger, atom: Atom<unknown>): boolean {
  if (!store[ATOMS_LOGGER_SYMBOL].enabled) {
    return false;
  }
  if (!store[ATOMS_LOGGER_SYMBOL].shouldShowPrivateAtoms && atom.debugPrivate === true) {
    return false;
  }
  if (store[ATOMS_LOGGER_SYMBOL].shouldShowAtom) {
    return store[ATOMS_LOGGER_SYMBOL].shouldShowAtom(atom);
  }
  return true;
}
