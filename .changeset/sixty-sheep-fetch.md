---
'jotai-logger': major
---

Replace the mutation-based API with a derived-store API

- The store is no longer mutated. Instead, `createLoggedStore` returns a **new** store that shares all internal state with the parent but intercepts `get`, `set` and `sub` for logging.
- On the React side, `AtomLoggerProvider` propagates the logged store to children via a Jotai `<Provider>`, retrieving the parent store from context automatically.
- This approach aligns with Jotai's internal `INTERNAL_buildStoreRev2` API introduced in jotai v2.15 (see https://github.com/pmndrs/jotai/pull/3149).

BREAKING CHANGE:

A migration guide from v4 to v5 is present in the README. [See link](https://github.com/Wendystraite/jotai-logger#migration-guide). TLDR:

- `useAtomsLogger` is replaced by `AtomLoggerProvider`, a Provider-like component that automatically picks up the nearest Jotai store from context and wraps children in a new logged store.
- `bindAtomsLoggerToStore` is replaced by `createLoggedStore` that creates and return a new store.
- `isAtomsLoggerBoundToStore` removed → use `isLoggedStore`
- `createLoggedStore` **throws** instead of returning `false`
