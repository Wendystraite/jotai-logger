---
'jotai-logger': patch
---

fix: don't merge promise in invalid transactions

Only merge a promise resolved or rejected in the promise pending
transaction. Add tests.
