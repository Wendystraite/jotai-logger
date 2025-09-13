---
'jotai-logger': patch
---

perf: do not call performance.now if not needed

Do not call `performance.now` if `showTransactionElapsedTime` and
`showTransactionLocaleTime` are disabled to prevent unnecessary calls.
