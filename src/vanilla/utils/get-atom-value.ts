import { INTERNAL_isPromiseLike as isPromiseLike } from 'jotai/vanilla/internals';

import { atomLoggerStoreSymbol } from '../consts/store-symbol.js';
import type { AnyAtom } from '../types/event.js';
import type { AtomLoggerStore } from '../types/store.js';

export function getAtomValue(
  store: AtomLoggerStore,
  atom: AnyAtom,
): { hasValue: boolean; value?: unknown } {
  const parentAtomStateMap = store[atomLoggerStoreSymbol].parentBuildingBlocks[0];
  const state = parentAtomStateMap.get(atom);
  const value = state?.v;
  if (isPromiseLike(value)) {
    if (!store[atomLoggerStoreSymbol].promisesResultsMap.has(value)) {
      return { hasValue: false };
    }
    const promiseValue = store[atomLoggerStoreSymbol].promisesResultsMap.get(value);
    return { hasValue: true, value: promiseValue };
  }
  return { hasValue: true, value };
}
