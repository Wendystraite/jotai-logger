---
'jotai-logger': patch
---

fix: merge transactions waiting for same promise

Instead of only merging a promise resolved or rejected in the promise
pending transaction, also merge multiple promise resolved or rejected
that happens at the same time. This usually means that these promises
were waiting for the same promise to settle. Add test.
