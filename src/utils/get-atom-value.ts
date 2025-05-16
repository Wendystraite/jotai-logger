import type { Atom } from 'jotai';
import { INTERNAL_isPromiseLike } from 'jotai/vanilla/internals';

import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import type { StoreWithAtomsLogger } from '../types/atoms-logger.js';
import { getInternalBuildingBlocks } from './get-internal-building-blocks.js';

export function getAtomValue(
  store: StoreWithAtomsLogger,
  atom: Atom<unknown>,
): { hasValue: boolean; value?: unknown } {
  const state = getInternalBuildingBlocks(store).atomStateMap.get(atom);
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
