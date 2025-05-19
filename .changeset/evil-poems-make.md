---
'jotai-logger': patch
---

fix: prevent crashes if bound store is changed

Change internal code to prevent crashes if Jotai internals are not
exposed anymore after the store is bound.
