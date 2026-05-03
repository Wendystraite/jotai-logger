---
'jotai-logger': major
---

split package into vanilla/react/formatter entry points

Split the core logger from its console formatter.
The core handle only scheduling and filtering options and accepts a new `formatter` option.
The new `consoleFormatter` factory creates the built in console formatter and accepts the old display options (`domain`, `logger`, `colorScheme`, etc.).
Add the `formatter` option to `bindAtomsLoggerToStore` and `useAtomsLogger` to replace the default console output with any custom function.

BREAKING CHANGE: formatting options that were present in `createLoggedStore` and `AtomLoggerProvider` are now moved to the new `consoleFormatter` factory options.
Migration:
Before: `bindAtomsLoggerToStore(store, { stringifyLimit: 100 })`
After: `createLoggedStore(store, { formatter: consoleFormatter({ stringifyLimit: 100 }) })`
