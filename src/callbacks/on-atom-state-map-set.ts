import { type INTERNAL_AtomState } from 'jotai/vanilla/internals';

import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import type { AnyAtom, StoreWithAtomsLogger } from '../types/atoms-logger.js';
import { shouldShowAtom } from '../utils/should-show-atom.js';
import { onAtomValueChanged } from './on-atom-value-changed.js';

export function getOnAtomStateMapSet(store: StoreWithAtomsLogger) {
  return function onAtomStateMapSet(atom: AnyAtom, atomState: INTERNAL_AtomState): void {
    let isInitialValue = true;

    if (shouldShowAtom(store, atom)) {
      store[ATOMS_LOGGER_SYMBOL].atomsFinalizationRegistry.register(atom, atom.toString());
    }

    const stateProxy = new Proxy(atomState, {
      set(target, _prop, newValue: unknown) {
        const prop = _prop as keyof typeof target;
        if (prop === 'v') {
          const oldValue = target[prop];
          onAtomValueChanged(store, atom, { isInitialValue, oldValue, newValue });
          isInitialValue = false;
        }
        return Reflect.set(target, prop, newValue);
      },
    });

    store[ATOMS_LOGGER_SYMBOL].prevAtomStateMapSet(atom, stateProxy);
  };
}
