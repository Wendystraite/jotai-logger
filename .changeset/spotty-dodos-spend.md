---
'jotai-logger': patch
---

fix: atom name color was gray instead of black

The debug label of atoms was gray instead of being black if it didn't
contain slashes "/". In this other case it is normal to have the names
before the last slash in gray. Add a test for that.
