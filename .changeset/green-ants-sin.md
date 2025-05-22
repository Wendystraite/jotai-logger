---
'jotai-logger': patch
---

fix: don't bind the store if already bound

- Support calling multiple times `bindAtomsLoggerToStore` to a store.
  Instead of binding the store multiple times, just bind it once and
  changes the store options for each new call.
- Add some tests to check that the store does not log anything if bound
  and disabled.
