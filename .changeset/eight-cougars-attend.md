---
'jotai-logger': patch
---

fix: invalid transactions elapsed time

- Some transaction elapsed time were incorrect due to the internal
  debouncing of transaction events. Now store the end timestamp before
  debouncing.
- Fix some tests that were clearly showing the debouncing time in the
  transaction elapsed time.
- Cleanup internal code to always call flushTransactionEvents inside
  endTransaction. Also cleanup / simplify how the current transaction is
  stored.
