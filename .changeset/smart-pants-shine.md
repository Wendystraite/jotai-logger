---
'jotai-logger': patch
---

fix: prevent crash on custom store

- Prevent the logger from crashing if the provided store does not
  contain Jotai's internal symbol for building blocks.
- The `bindAtomsLoggerToStore` now returns a boolean confirming whether
  the logger was successfully bound to the provided store.
- Add tests for that.
