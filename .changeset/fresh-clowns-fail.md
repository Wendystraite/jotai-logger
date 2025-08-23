---
'jotai-logger': patch
---

perf: don't use transaction and event mappings

Do not use transaction and event mappings when starting transactions and
events and instead send directly the corresponding transaction or event.
Makes the code and typing simpler and prevent the need to find which
transaction or event is used using `Object.values[0]` everywhere,
a thing that was eating performances. Use numbers as types to prevent
a costly strings comparison. Use mapping by type where possible.