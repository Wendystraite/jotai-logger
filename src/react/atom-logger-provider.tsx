import { Provider, useStore } from 'jotai';
import type { Store } from 'jotai/vanilla/store';
import { useMemo, useRef, type PropsWithChildren, type ReactNode } from 'react';

import { createLoggedStore } from '../vanilla/create-logged-store.js';
import type { AtomLoggerOptions } from '../vanilla/types/options.js';

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

  const optionsRef = useRef<AtomLoggerOptions | undefined>(undefined);
  if (optionsRef.current === undefined) optionsRef.current = { ...options };
  else Object.assign(optionsRef.current, options);

  const loggedStore = useMemo(() => {
    return createLoggedStore(parentStore, optionsRef.current);
  }, [parentStore]);

  return <Provider store={loggedStore}>{children}</Provider>;
}
