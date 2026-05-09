import type {
  INTERNAL_BuildingBlocks as BuildingBlocks,
  INTERNAL_StoreHooks as StoreHooks,
} from 'jotai/vanilla/internals';

import { onAtomMounted } from '../callbacks/on-atom-mounted.js';
import type { AtomLoggerStoreState } from '../types/store.js';

/**
 * Track mounted atoms.
 */
export function trackMounted(
  storeHooks: Required<StoreHooks>,
  loggerState: AtomLoggerStoreState,
  buildingBlocks: Readonly<BuildingBlocks>,
) {
  storeHooks.m.add(undefined, (atom) => {
    onAtomMounted(loggerState, buildingBlocks, atom);
  });
}
