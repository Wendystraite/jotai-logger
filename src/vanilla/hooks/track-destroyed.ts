import type { INTERNAL_StoreHooks as StoreHooks } from 'jotai/vanilla/internals';

import type { AtomLoggerStoreState } from '../types/store.js';
import { shouldShowAtom } from '../utils/should-show-atom.js';

/**
 * Track destroyed atoms.
 */
export function trackDestroyed(
  storeHooks: Required<StoreHooks>,
  loggerState: AtomLoggerStoreState,
) {
  storeHooks.i.add(undefined, (atom) => {
    if (shouldShowAtom(loggerState, atom)) {
      loggerState.atomsFinalizationRegistry.register(atom, atom.toString());
    }
  });
}
