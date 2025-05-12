import type { Atom } from 'jotai';

import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import type { StoreWithAtomsLogger } from '../types/atoms-logger.js';
import { getOnAtomMounted } from './on-atom-mounted.js';

export function getOnDevtoolsMountedAdd(store: StoreWithAtomsLogger) {
  const onAtomMounted = getOnAtomMounted(store);
  return function onDevtoolsMountedAdd(atom: Atom<unknown>): Set<Atom<unknown>> {
    onAtomMounted(atom);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- should be defined
    return store[ATOMS_LOGGER_SYMBOL].prevDevtoolsMountedAtomsAdd!(atom);
  };
}
