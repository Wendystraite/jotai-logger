import { type INTERNAL_AtomState } from 'jotai/vanilla/internals';

import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import { addEventToTransaction } from '../transactions/add-event-to-transaction.js';
import {
  AtomsLoggerEventTypes,
  type AnyAtom,
  type StoreWithAtomsLogger,
} from '../types/atoms-logger.js';
import { shouldShowAtom } from '../utils/should-show-atom.js';
import { onAtomValueChanged } from './on-atom-value-changed.js';

export function getOnAtomStateMapSet(store: StoreWithAtomsLogger) {
  return function onAtomStateMapSet(atom: AnyAtom, atomState: INTERNAL_AtomState): void {
    let isInitialValue = true;

    if (shouldShowAtom(store, atom)) {
      store[ATOMS_LOGGER_SYMBOL].atomsFinalizationRegistry.register(atom, atom.toString());
      // In jotai 2.17.x, d.clear() was called at the start of each atom read, which initialized
      // dependenciesMap for every visible atom (even those with no deps). In jotai 2.18+,
      // d.clear() is gone, so we initialize it here when the atom state is first created.
      /* v8 ignore next 3 -- atom state is created only once per atom per store instance -- @preserve */
      if (!store[ATOMS_LOGGER_SYMBOL].dependenciesMap.has(atom)) {
        store[ATOMS_LOGGER_SYMBOL].dependenciesMap.set(atom, new Set());
      }
    }

    // Track the dependencies changes in the dependency map.
    const originalMapSet = atomState.d.set.bind(atomState.d);
    atomState.d.set = function mapSetProxy(addedDependency: AnyAtom, epochNumber: number) {
      const result = originalMapSet(addedDependency, epochNumber);
      addEventToTransaction(store, {
        type: AtomsLoggerEventTypes.dependenciesChanged,
        atom,
        addedDependency,
      });
      return result;
    };
    /* v8 ignore start -- clear is not used anymore in jotai 2.18+ -- @preserve */
    const originalMapClear = atomState.d.clear.bind(atomState.d);
    atomState.d.clear = function mapClearProxy() {
      originalMapClear();
      addEventToTransaction(store, {
        type: AtomsLoggerEventTypes.dependenciesChanged,
        atom,
        clearedDependencies: true,
      });
    };
    /* v8 ignore end -- @preserve */
    const originalMapDelete = atomState.d.delete.bind(atomState.d);
    atomState.d.delete = function mapDeleteProxy(removedDependency: AnyAtom) {
      const result = originalMapDelete(removedDependency);
      if (result) {
        addEventToTransaction(store, {
          type: AtomsLoggerEventTypes.dependenciesChanged,
          atom,
          removedDependency,
        });
      }
      return result;
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
