import type { Atom } from 'jotai';

import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import type { StoreWithAtomsLogger } from '../types/atoms-logger.js';
import { getOnAtomUnmounted } from './on-atom-unmounted.js';

export function getOnDevtoolsMountedDelete(store: StoreWithAtomsLogger) {
  const onAtomUnmounted = getOnAtomUnmounted(store);
  return function onDevtoolsMountedDelete(atom: Atom<unknown>): boolean {
    onAtomUnmounted(atom);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- should be defined
    return store[ATOMS_LOGGER_SYMBOL].prevDevtoolsMountedAtomsDelete!(atom);
  };
}
