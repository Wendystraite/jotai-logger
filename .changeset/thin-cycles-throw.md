---
'jotai-logger': major
---

Support Jotai 2.18.0

Internally, registerAbortHandler was replaced from an internal import function to a internal building block.
Also, Jotai 2.18.0 changed its internal implementation of dependencies that broke jotai-logger dependencies tracking.

BREAKING CHANGE: only jotai 2.18.0 and up is supported due to changes in their internal APIs.
