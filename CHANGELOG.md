# jotai-logger

## 2.1.0

### Minor Changes

- be06395: feat: add "stringify" option

  - Add a "stringify" option to provide your own function to stringify
    data in the logs. Document it in the README.
  - Handle more complex objects with the built-in stringify function using
    "toString" if present. Add more unit tests.

### Patch Changes

- 46376c1: fix: don't log dependents before they are mounted

  - Don't log dependents atoms in a log before they are mounted.
    This also prevent the incorrect data to be logged in a "mount" event.

## 2.0.1

### Patch Changes

- 0f8a14c: fix: display atoms with custom toString method

  Show the full string returned by toString instead of "atom" if an atom
  has a custom .toString method.

- fddaeb3: fix: do not show atom name in unknown transactions

  Do not show the name of the atom in the transaction log if the atom was
  updated outside of a normal transaction. This can happen for example if
  an atom is set in a setTimeout inside an atom setter.

- 13aafca: fix: log the previous value of an aborted promise

  If a promise was aborted, the next promise was logged as an initial
  promise and without the old settled value. Now it show that it wasn't an
  initial promise and log correctly the old settled value.

## 2.0.0

### Major Changes

- 1085092: feat: stringifyValues and formattedOutput options

  Add two new options for the logger:

  - stringifyValues to stringify data in the logs.
    - If enabled, it will be like before : the state of atoms, arguments,
      ect.. will be stringified in the log.
    - If disabled, the data will be logged in the console as is without
      any formatting.
  - formattedOutput to use colors/formatting in the console.
    - If enabled, It will display colors and data using the browser
      console's string substitutions like %c and %o.
    - If disabled, only plain text and data will be displayed.
  - Both options are obviously tested.
  - Also add tests for the stringified data.

  BREAKING CHANGE: `plainTextOutput` is replaced by `formattedOutput`.
  Just replace `plainTextOutput: true` by `formattedOutput: false` if
  you used this option.

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
