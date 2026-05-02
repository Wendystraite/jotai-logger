import { INTERNAL_isPromiseLike } from 'jotai/vanilla/internals';

import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import type { StoreWithAtomsLogger } from '../types/atoms-logger.js';
import type { AnyAtom } from '../types/event.js';

export function getAtomValue(
  store: StoreWithAtomsLogger,
  atom: AnyAtom,
): { hasValue: boolean; value?: unknown } {
  const state = store[ATOMS_LOGGER_SYMBOL].getState(atom);
  const value = state?.v;
  if (INTERNAL_isPromiseLike(value)) {
    if (!store[ATOMS_LOGGER_SYMBOL].promisesResultsMap.has(value)) {
      return { hasValue: false };
    }
    const promiseValue = store[ATOMS_LOGGER_SYMBOL].promisesResultsMap.get(value);
    return { hasValue: true, value: promiseValue };
  }
  return { hasValue: true, value };
}
