---
'jotai-logger': patch
---

fix: display atoms with custom toString method

Show the full string returned by toString instead of "atom" if an atom
has a custom .toString method.
