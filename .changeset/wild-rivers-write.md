---
'jotai-logger': patch
---

fix: log the previous value of an aborted promise

If a promise was aborted, the next promise was logged as an initial
promise and without the old settled value. Now it show that it wasn't an
initial promise and log correctly the old settled value.
