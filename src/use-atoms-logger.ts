import { useStore } from 'jotai';
import { useRef } from 'react';

import { bindAtomsLoggerToStore, isAtomsLoggerBoundToStore } from './bind-atoms-logger-to-store.js';
import { ATOMS_LOGGER_SYMBOL } from './consts/atom-logger-symbol.js';
import type { AtomsLoggerOptions, AtomsLoggerOptionsInState } from './types/atoms-logger.js';
import { atomsLoggerOptionsToState } from './utils/logger-options-to-state.js';

/**
 * Hook that logs atom state changes in the console.
 * It uses the Jotai store to track atoms and their dependencies.
 *
 * @param options Options to configure the logger behavior with optionally a Jotai store.
 * @param options.store The Jotai store to bind the logger to. If not provided, the default store from `useStore` is used.
 *
 * @example
 * ```tsx
 * function AtomsLogger() {
 *   useAtomsLogger();
 *   return null;
 * }
 * ```
 */
export function useAtomsLogger(
  options?: Parameters<typeof useStore>[0] & AtomsLoggerOptions,
): void {
  const store = useStore(options);

  const storeRef = useRef(store);
  const prevStore = storeRef.current;
  storeRef.current = store;

  // Disable the logger bound to the previous store if the store changes
  if (store !== prevStore && isAtomsLoggerBoundToStore(prevStore)) {
    prevStore[ATOMS_LOGGER_SYMBOL].enabled = false;
  }

  // Bind the logger to the store if it is not already bound
  if (options?.enabled !== false && !isAtomsLoggerBoundToStore(store)) {
    bindAtomsLoggerToStore(store, options);
  }

  // Update the logger options if they changes
  if (isAtomsLoggerBoundToStore(store)) {
    const stateOptions: AtomsLoggerOptionsInState = atomsLoggerOptionsToState(options);
    Object.assign(store[ATOMS_LOGGER_SYMBOL], stateOptions);
  }
}
