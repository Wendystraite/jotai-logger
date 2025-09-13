---
'jotai-logger': minor
---

feat: add option `maxProcessingTimeMs` option

Add a new option `maxProcessingTimeMs` that further improves runtime
performances by limiting the time spent processing transactions in each
idle period.
Transactions are now processed in groups and each group and each group
is limited to a maximum processing time to prevent blocking the main
thread. When the time limit is reached, processing continues in the next
idle period, ensuring UI responsiveness is maintained even when handling
large queues of transactions.
