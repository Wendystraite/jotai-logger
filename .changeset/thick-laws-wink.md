---
'jotai-logger': patch
---

refactor: remove "enableDebugMode" internal option

Remove the hidden "enableDebugMode" option from the logger.
It was not tested and not useful.
If there is a need to log data that was shown by this option, a new
public option will be added.
