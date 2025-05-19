---
'jotai-logger': patch
---

perf: better perfs when not logging some atoms

Do not add a transaction in the logging scheduler if it don't need to be
logged because either there are no events to log or all atoms are
private/ignored. The scheduler doesn't need to schedule these
transactions resulting in a more fluid output. This also prevents
useless calculations when adding it and trying to log it.
