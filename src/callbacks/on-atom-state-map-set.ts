import type { Atom } from 'jotai';
import { type INTERNAL_AtomState } from 'jotai/vanilla/internals';

import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import type { StoreWithAtomsLogger } from '../types/atoms-logger.js';
import { getInternalBuildingBlocks } from '../utils/get-internal-building-blocks.js';
import { shouldShowAtom } from '../utils/should-show-atom.js';
import { onAtomValueChanged } from './on-atom-value-changed.js';

export function getOnAtomStateMapSet(store: StoreWithAtomsLogger) {
  return function onAtomStateMapSet(atom: Atom<unknown>, atomState: INTERNAL_AtomState): void {
    const { atomStateMap } = getInternalBuildingBlocks(store);

    let isInitialValue = !atomStateMap.get(atom);

    if ('v' in atomState) {
      const oldState = atomStateMap.get(atom);
      onAtomValueChanged(store, atom, {
        isInitialValue: !oldState,
        oldValue: oldState?.v,
        newValue: atomState.v,
      });
    }

    if (shouldShowAtom(store, atom) && !atomStateMap.get(atom)) {
      store[ATOMS_LOGGER_SYMBOL].atomsFinalizationRegistry.register(atom, atom.toString());
    }

    const stateProxy = new Proxy(atomState, {
      set(target, _prop, newValue: unknown) {
        const prop = _prop as keyof typeof target;
        if (prop === 'v') {
          const oldValue = target[prop];
          onAtomValueChanged(store, atom, {
            isInitialValue,
            oldValue,
            newValue,
          });
          isInitialValue = false;
        }
        (target as unknown as Record<string, unknown>)[prop] = newValue;
        return true;
      },
    });

    store[ATOMS_LOGGER_SYMBOL].prevAtomStateMapSet(atom, stateProxy);
  };
}
