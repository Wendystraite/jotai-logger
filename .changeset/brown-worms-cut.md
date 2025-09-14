---
'jotai-logger': patch
---

fix: collapse transaction by default

Collapse grouped transactions by default.
Since transactions are grouped by default it makes sense to also
collapse them by default to prevent seeing too much spam when
investigating events.
