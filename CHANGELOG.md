# jotai-logger

## 1.1.0

### Minor Changes

- 2e7c4d4: feat: merge value changes in the same transaction

  If multiple "changed" events occurs in the same transaction, merge them
  together to prevent spam. The merge event will contains multiple old
  values instead of one. It will be displayed with the number of times it
  was changed with the first old value.

- fbe918e: feat: jotai-devtools compatibility

  The logger is now fully compatible with jotai-devtools. It wasn't the
  case before becose jotai-devtools create a custom store without giving
  access to jotai's private API (a.k.a. buildingBlocks).
  The logger now check whenever the given jotai store is a dev store and
  bind the logger to it.
  It also try to bind to any other custom store that exposes the API in
  another keyed symbol.
  Add tests for both cases.
  Add jotai-devtools as a peer dependency.

### Patch Changes

- 89fb980: fix: atom name color was gray instead of black

  The debug label of atoms was gray instead of being black if it didn't
  contain slashes "/". In this other case it is normal to have the names
  before the last slash in gray. Add a test for that.

- 375cbae: refactor: remove "enableDebugMode" internal option

  Remove the hidden "enableDebugMode" option from the logger.
  It was not tested and not useful.
  If there is a need to log data that was shown by this option, a new
  public option will be added.

## 1.0.2

### Patch Changes

- 6e4f056: fix: prevent crash on custom store

  - Prevent the logger from crashing if the provided store does not
    contain Jotai's internal symbol for building blocks.
  - The `bindAtomsLoggerToStore` now returns a boolean confirming whether
    the logger was successfully bound to the provided store.
  - Add tests for that.

## 1.0.1

### Patch Changes

- 06954c2: Remove React and Jotai from dependencies
