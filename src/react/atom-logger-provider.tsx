import { Provider, useStore } from 'jotai';
import type { Store } from 'jotai/vanilla/store';
import { useMemo, type PropsWithChildren, type ReactNode } from 'react';

import { atomLoggerStoreSymbol } from '../vanilla/consts/store-symbol.js';
import { createLoggedStore } from '../vanilla/create-logged-store.js';
import type { AtomLoggerOptions } from '../vanilla/types/options.js';
import { atomLoggerOptionsToState } from '../vanilla/utils/logger-options-to-state.js';

/**
 * Provider that wraps a Jotai store with atom logging.
 *
 * It retrieves the nearest Jotai store from context, creates a new logged
 * store derived from it, and propagates the logged store to all children via
 * a Jotai `<Provider>`. All `store.get`, `store.set` and `store.sub` calls
 * made by children are intercepted and logged.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <Provider>
 *       <AtomLoggerProvider>
 *         <MyApp />
 *       </AtomLoggerProvider>
 *     </Provider>
 *   );
 * }
 * ```
 */
export function AtomLoggerProvider({
  store,
  children,
  ...options
}: PropsWithChildren<{ store?: Store }> & AtomLoggerOptions): ReactNode {
  const parentStore = useStore({ store });

  const loggedStore = useMemo(() => createLoggedStore(parentStore, options), [parentStore]);

  Object.assign(loggedStore[atomLoggerStoreSymbol], atomLoggerOptionsToState(options));
  if (options.formatter) loggedStore[atomLoggerStoreSymbol].formatter = options.formatter;

  return <Provider store={loggedStore}>{children}</Provider>;
}
