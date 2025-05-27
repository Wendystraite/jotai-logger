# jotai-logger

## 2.5.0

### Minor Changes

- 300c383: feat: synchronous logging

  Add three new options: `synchronous`, `transactionDebounceMs` and
  `requestIdleCallbackTimeoutMs`. These options can further customize the
  logger behavior either by logging everything immediately or waiting
  longer for the browser to be idle before logging. Each use case is
  explained in the README. Add tests for each option.

### Patch Changes

- 34a0327: fix: handle direct store calls inside transactions

  - Handle the rare case where store methods are called inside
    transactions (e.g. store.get called inside a store.sub). This can
    happen in some advanced use cases in some Jotai libraries.
  - Instead of showing a new transaction, merge the nested transaction
    into the existing one.
  - Update tests for this use case.
  - Also update the existing jotai-effect test that was exactly doing
    that. Add a test for the stack-traces parsing since jotai-effect does
    not cover this case anymore.

## 2.4.0

### Minor Changes

- e4a48f8: feat: atom dependencies tracking

  - Add a new event shown when dependencies of an atom have changed.
    This event is not shown for initial dependencies to prevent spam.
  - Add tests for that to maintain a full coverage.
  - Document it in the README.

### Patch Changes

- 1936212: fix: don't bind the store if already bound

  - Support calling multiple times `bindAtomsLoggerToStore` to a store.
    Instead of binding the store multiple times, just bind it once and
    changes the store options for each new call.
  - Add some tests to check that the store does not log anything if bound
    and disabled.

- 035bd58: fix: do not log mounted dependencies

  Instead of logging "dependencies", "mounted dependencies" and "mounted
  dependents", only log "dependencies" and "dependents". We already know
  that an atom is mounted with the corresponding event and Jotai internals
  guarantee that a mounted atom has all its dependencies mounted so
  showing both dependencies and mounted dependencies is pointless.
  This also has the benefits of better performances since we don't need to
  convert both lists to strings.

## 2.3.2

### Patch Changes

- abc54c0: fix: merge transactions waiting for same promise

  Instead of only merging a promise resolved or rejected in the promise
  pending transaction, also merge multiple promise resolved or rejected
  that happens at the same time. This usually means that these promises
  were waiting for the same promise to settle. Add test.

## 2.3.1

### Patch Changes

- 77616b7: fix: invalid transactions elapsed time

  - Some transaction elapsed time were incorrect due to the internal
    debouncing of transaction events. Now store the end timestamp before
    debouncing.
  - Fix some tests that were clearly showing the debouncing time in the
    transaction elapsed time.
  - Cleanup internal code to always call flushTransactionEvents inside
    endTransaction. Also cleanup / simplify how the current transaction is
    stored.

- a6c4df9: fix: prevent crashes if bound store is changed

  Change internal code to prevent crashes if Jotai internals are not
  exposed anymore after the store is bound.

- 5554d19: fix: don't merge promise in invalid transactions

  Only merge a promise resolved or rejected in the promise pending
  transaction. Add tests.

- a858bb2: perf: better perfs when not logging some atoms

  Do not add a transaction in the logging scheduler if it don't need to be
  logged because either there are no events to log or all atoms are
  private/ignored. The scheduler doesn't need to schedule these
  transactions resulting in a more fluid output. This also prevents
  useless calculations when adding it and trying to log it.

- 48e3e20: fix: no crash if stringify don't returns a string

  Fix a potential crash if the stringify option returns invalid data.

## 2.3.0

### Minor Changes

- 27bdda5: feat: add "getStackTrace" option

  - Add a "getStackTrace" option to provide your own function to retrieve
    the stack trace. If used, the logger will try to find the React
    component that triggered the transaction.
  - Remove stacktrace.js dependency
  - Document in the README how this option works and show an example
    using stacktrace-js.
  - Add unit and integration tests for stack traces.

## 2.2.0

### Minor Changes

- 07fb009: feat: better performances by scheduling logs

  - Debounce all received events by 250ms in transactions and schedule all
    transactions to be logged using either window.requestIdleCallback or
    setTimeout. requestIdleCallback queues transactions to be logged
    during a browser's idle periods with a maximum timeout of 250ms per
    transaction. This ensure that the logger does not impact too much the
    application performances.
  - Explain logging performances in the README.
  - Add tests for both the debouncing and the scheduling.

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
