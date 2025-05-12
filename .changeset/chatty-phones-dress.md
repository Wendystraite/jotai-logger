---
'jotai-logger': minor
---

feat: merge value changes in the same transaction

If multiple "changed" events occurs in the same transaction, merge them
together to prevent spam. The merge event will contains multiple old
values instead of one. It will be displayed with the number of times it
was changed with the first old value.
