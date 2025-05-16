---
'jotai-logger': minor
---

feat: add "stringify" option

- Add a "stringify" option to provide your own function to stringify
  data in the logs. Document it in the README.
- Handle more complex objects with the built-in stringify function using
  "toString" if present. Add more unit tests.
