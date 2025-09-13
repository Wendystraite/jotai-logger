---
'jotai-logger': major
---

feat: add component owner stack and display name

Replace the `getStackTrace` option by three new options :
`getOwnerStack`, `ownerStackLimit` and `getComponentDisplayName`.
These options allows the logger to better track the React component
hierarchy by using React 19.1 APIs.

BREAKING CHANGE: `getStackTrace` is removed and replaced by the new
experimental options `getOwnerStack` and `getComponentDisplayName`.
See the README on how to setup these two new options.
