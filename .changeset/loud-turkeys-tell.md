---
'jotai-logger': patch
---

fix: do not show atom name in unknown transactions

Do not show the name of the atom in the transaction log if the atom was
updated outside of a normal transaction. This can happen for example if
an atom is set in a setTimeout inside an atom setter.
