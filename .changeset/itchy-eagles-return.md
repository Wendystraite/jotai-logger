---
'jotai-logger': minor
---

feat: jotai-devtools compatibility

The logger is now fully compatible with jotai-devtools. It wasn't the
case before becose jotai-devtools create a custom store without giving
access to jotai's private API (a.k.a. buildingBlocks).
The logger now check whenever the given jotai store is a dev store and
bind the logger to it.
It also try to bind to any other custom store that exposes the API in
another keyed symbol.
Add tests for both cases.
Add jotai-devtools as a peer dependency.
