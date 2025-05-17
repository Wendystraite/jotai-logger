---
'jotai-logger': minor
---

feat: add "getStackTrace" option

- Add a "getStackTrace" option to provide your own function to retrieve
  the stack trace. If used, the logger will try to find the React
  component that triggered the transaction.
- Remove stacktrace.js dependency
- Document in the README how this option works and show an example
  using stacktrace-js.
- Add unit and integration tests for stack traces.
