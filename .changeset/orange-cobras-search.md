---
'jotai-logger': major
---

feat: stringifyValues and formattedOutput options

Add two new options for the logger:

- stringifyValues to stringify data in the logs.
  - If enabled, it will be like before : the state of atoms, arguments,
    ect.. will be stringified in the log.
  - If disabled, the data will be logged in the console as is without
    any formatting.
- formattedOutput to use colors/formatting in the console.
  - If enabled, It will display colors and data using the browser
    console's string substitutions like %c and %o.
  - If disabled, only plain text and data will be displayed.
- Both options are obviously tested.
- Also add tests for the stringified data.

BREAKING CHANGE: `plainTextOutput` is replaced by `formattedOutput`.
Just replace `plainTextOutput: true` by `formattedOutput: false` if
you used this option.
