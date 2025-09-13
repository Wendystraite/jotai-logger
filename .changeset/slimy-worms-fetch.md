---
'jotai-logger': major
---

feat: split `groupLogs` option in two options

Replace `groupLogs` option by the two new options `groupTransactions`
and `groupEvents`.
Transactions are still grouped and not collapsed by default.
Events are now not grouped and collapsed by default.

BREAKING CHANGE: `groupLogs` option has been removed in favor of
`groupTransactions` and `groupEvents` options. Just replace it by these
two new options for the same functionalities.
