---
'jotai-logger': major
---

feat: update to jotai 2.14.0

Support the new jotai internal API `INTERNAL_buildStoreRev2` and drop
support for older versions of jotai and jotai-devtools.
Update all dev dependencies.
Remove all previous hacks made for working with jotai-devtools.

BREAKING CHANGE: only jotai 2.14.0 and up is supported due to changes
in their internal APIs.
