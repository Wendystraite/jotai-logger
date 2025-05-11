# jotai-logger

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
