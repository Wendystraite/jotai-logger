import type {
  INTERNAL_BuildingBlocks as BuildingBlocks,
  INTERNAL_StoreHooks as StoreHooks,
} from 'jotai/vanilla/internals';

import { onAtomUnmounted } from '../callbacks/on-atom-unmounted.js';
import type { AtomLoggerStoreState } from '../types/store.js';

/**
 * Track unmounted atoms.
 */
export function trackUnmounted(
  storeHooks: Required<StoreHooks>,
  loggerState: AtomLoggerStoreState,
  buildingBlocks: Readonly<BuildingBlocks>,
) {
  storeHooks.u.add(undefined, (atom) => {
    onAtomUnmounted(loggerState, buildingBlocks, atom);
  });
}
