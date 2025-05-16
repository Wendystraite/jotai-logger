---
'jotai-logger': minor
---

feat: better performances by scheduling logs

- Debounce all received events by 250ms in transactions and schedule all
  transactions to be logged using either window.requestIdleCallback or
  setTimeout. requestIdleCallback queues transactions to be logged
  during a browser's idle periods with a maximum timeout of 250ms per
  transaction. This ensure that the logger does not impact too much the
  application performances.
- Explain logging performances in the README.
- Add tests for both the debouncing and the scheduling.
