import { type INTERNAL_AtomState } from 'jotai/vanilla/internals';

import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import { addEventToTransaction } from '../transactions/add-event-to-transaction.js';
import type { AnyAtom, StoreWithAtomsLogger } from '../types/atoms-logger.js';
import { shouldShowAtom } from '../utils/should-show-atom.js';
import { onAtomValueChanged } from './on-atom-value-changed.js';

export function getOnAtomStateMapSet(store: StoreWithAtomsLogger) {
  return function onAtomStateMapSet(atom: AnyAtom, atomState: INTERNAL_AtomState): void {
    let isInitialValue = true;

    if (shouldShowAtom(store, atom)) {
      store[ATOMS_LOGGER_SYMBOL].atomsFinalizationRegistry.register(atom, atom.toString());
    }

    // Track the dependencies changes in the dependency map.
    const originalMapSet = atomState.d.set.bind(atomState.d);
    atomState.d.set = function mapSetProxy(addedDependency: AnyAtom, epochNumber: number) {
      const result = originalMapSet(addedDependency, epochNumber);
      addEventToTransaction(store, { dependenciesChanged: { atom, addedDependency } });
      return result;
    };
    const originalMapClear = atomState.d.clear.bind(atomState.d);
    atomState.d.clear = function mapClearProxy() {
      originalMapClear();
      addEventToTransaction(store, { dependenciesChanged: { atom, clearedDependencies: true } });
    };

    // Track the values changes in the atom state.
    const stateProxy = new Proxy(atomState, {
      set(target, _prop, newValue: unknown, receiver) {
        const prop = _prop as keyof typeof target;
        if (prop === 'v') {
          const oldValue = Reflect.get(target, prop, receiver);
          onAtomValueChanged(store, atom, { isInitialValue, oldValue, newValue });
          isInitialValue = false;
        }
        return Reflect.set(target, prop, newValue);
      },
    });

    store[ATOMS_LOGGER_SYMBOL].prevAtomStateMapSet(atom, stateProxy);
  };
}
