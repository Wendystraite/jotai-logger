---
'jotai-logger': patch
---

fix: don't log dependents before they are mounted

- Don't log dependents atoms in a log before they are mounted.
  This also prevent the incorrect data to be logged in a "mount" event.
