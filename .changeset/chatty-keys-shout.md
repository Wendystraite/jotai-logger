---
'jotai-logger': patch
---

perf: don't splice merged events

Do not use `Array.splice` in transaction events when merging changed
events preventing unnecessary iterations. Instead, set to `undefined`
the event's value at its given index and decrement the array's counter.
