---
'jotai-logger': patch
---

perf: do not call getOwnerStack if not needed

Only retrieve the component's owner stack when a transaction is logged.
