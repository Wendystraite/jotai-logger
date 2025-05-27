---
'jotai-logger': patch
---

fix: handle direct store calls inside transactions

- Handle the rare case where store methods are called inside
  transactions (e.g. store.get called inside a store.sub). This can
  happen in some advanced use cases in some Jotai libraries.
- Instead of showing a new transaction, merge the nested transaction
  into the existing one.
- Update tests for this use case.
- Also update the existing jotai-effect test that was exactly doing
  that. Add a test for the stack-traces parsing since jotai-effect does
  not cover this case anymore.
