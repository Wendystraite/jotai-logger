---
'jotai-logger': patch
---

fix: retrieve component display name in edge cases

Retrieve the component's display name when using `useAtom` or
`useAtomValue` during `subscribed` and `set` calls.
