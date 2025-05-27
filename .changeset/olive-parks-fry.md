---
'jotai-logger': minor
---

feat: synchronous logging

Add three new options: `synchronous`, `transactionDebounceMs` and
`requestIdleCallbackTimeoutMs`. These options can further customize the
logger behavior either by logging everything immediately or waiting
longer for the browser to be idle before logging. Each use case is
explained in the README. Add tests for each option.
