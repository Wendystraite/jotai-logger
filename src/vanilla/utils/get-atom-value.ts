import { INTERNAL_isPromiseLike as isPromiseLike } from 'jotai/vanilla/internals';
import type { INTERNAL_BuildingBlocks as BuildingBlocks } from 'jotai/vanilla/internals';

import type { AnyAtom } from '../types/event.js';
import type { AtomLoggerStoreState } from '../types/store.js';

export function getAtomValue(
  loggerState: AtomLoggerStoreState,
  buildingBlocks: Readonly<BuildingBlocks>,
  atom: AnyAtom,
): { hasValue: boolean; value?: unknown } {
  const parentAtomStateMap = buildingBlocks[0];
  const state = parentAtomStateMap.get(atom);
  const value = state?.v;
  if (isPromiseLike(value)) {
    if (!loggerState.promisesResultsMap.has(value)) {
      return { hasValue: false };
    }
    const promiseValue = loggerState.promisesResultsMap.get(value);
    return { hasValue: true, value: promiseValue };
  }
  return { hasValue: true, value };
}
