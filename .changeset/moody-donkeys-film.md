---
'jotai-logger': patch
---

perf: do not copy meta in log pipelines

Instead of instantiating multiple objects containing meta data in log
pipelines, assign these values directly to the shared context.
This prevents lots of instantiations, copies and gc.
