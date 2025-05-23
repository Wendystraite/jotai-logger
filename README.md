# Jotai Logger

[![NPM Version](https://img.shields.io/npm/v/jotai-logger)](https://www.npmjs.com/package/jotai-logger)
[![Codecov](https://img.shields.io/codecov/c/gh/Wendystraite/jotai-logger)](https://app.codecov.io/gh/Wendystraite/jotai-logger)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/jotai-logger)](https://bundlephobia.com/package/jotai-logger)
[![GitHub License](https://img.shields.io/github/license/Wendystraite/jotai-logger)](https://github.com/Wendystraite/jotai-logger/blob/main/LICENSE.md)

Logging utility for [Jotai](https://github.com/pmndrs/jotai) that helps you debug and track atom state changes.

## Features

- 📊 Track atom state changes with detailed transaction logs
- 🔄 Monitor atom dependencies and their changes
- 📜 Show full atom lifecycle (init → mount → change → unmount → destroy)
- ⏱️ Performance monitoring with timing information
- 🛠️ Customizable with various configuration options
- 🔍 React component source tracking via stack traces (experimental)
- ⚡ Asynchronous logging that doesn't impact performance
- 🌈 Color-coded output with accessibility-friendly schemes
- 🐞 Compatible with [jotai-devtools](https://github.com/jotaijs/jotai-devtools)
- 📦 No dependencies, lightweight and tree-shakable
- 🎯 Support for both React hooks and vanilla store API

## Installation

```bash
# npm
npm install jotai-logger

# yarn
yarn add jotai-logger

# pnpm
pnpm install jotai-logger
```

## Usage

### Basic Setup

```tsx
import { useAtomsLogger } from 'jotai-logger';

function App() {
  return (
    <>
      <AtomsLogger />
      {/* your app */}
    </>
  );
}

function AtomsLogger() {
  useAtomsLogger();
  return null;
}
```

### Vanilla Setup

```ts
import { createStore } from 'jotai';
import { bindAtomsLoggerToStore } from 'jotai-logger';

const store = createStore();
bindAtomsLoggerToStore(store);
```

## Configuration Options

You can customize the logger with various options:

```tsx
import { AtomsLoggerOptions } from 'jotai-logger';

const options: AtomsLoggerOptions = {
  enabled: true,
  domain: 'MyApp',
  showPrivateAtoms: false,
  // Add other options as needed
};

useAtomsLogger(options);
// or
bindAtomsLoggerToStore(store, options);
```

### Options

You can customize the logger with various options:

```tsx
type AtomsLoggerOptions = {
  /** Enable or disable the logger (default: true) */
  enabled?: boolean;
  /** Domain identifier for the logger in console output */
  domain?: string;
  /** Whether to show private atoms used internally by Jotai (default: false) */
  shouldShowPrivateAtoms?: boolean;
  /** Custom function to determine which atoms to show */
  shouldShowAtom?: (atom: Atom) => boolean;
  /** Custom logger to use instead of console */
  logger?: Logger;
  /** Whether to group logs with logger.group (default: true) */
  groupLogs?: boolean;
  /** Number of spaces for each indentation level (default: 0) */
  indentSpaces?: number;
  /** Whether to use colors/formatting in the console (default: true) */
  formattedOutput?: boolean;
  /** Color scheme to use: 'default', 'light', or 'dark' (default: 'default') */
  colorScheme?: 'default' | 'light' | 'dark';
  /** Maximum length of stringified data (default: 50) */
  stringifyLimit?: number;
  /** Whether to stringify data in the logs (default: true) */
  stringifyValues?: boolean;
  /** Custom function to stringify data in the logs (default: `toString` and `JSON.stringify`) */
  stringify?: (value: unknown) => string;
  /** Whether to show transaction numbers (default: true) */
  showTransactionNumber?: boolean;
  /** Whether to show transaction timestamps (default: false) */
  showTransactionLocaleTime?: boolean;
  /** Whether to show elapsed time (default: true) */
  showTransactionElapsedTime?: boolean;
  /** Whether to collapse transaction logs (default: false) */
  collapseTransactions?: boolean;
  /** Whether to collapse event logs (default: true) */
  collapseEvents?: boolean;
  /** Custom function to retrieve calling React components' names from stack traces */
  getStackTrace?: () => { functionName?: string; fileName?: string }[] | undefined;
};

const options: AtomsLoggerOptions = {
  enabled: true,
  domain: 'MyApp',
  shouldShowPrivateAtoms: false,
  // Add other options as needed
};

useAtomsLogger(options);
// or
bindAtomsLoggerToStore(store, options);
```

### Colors

The default color scheme uses colors that are easy to read in both light and dark mode.
The colors are from the colorblind-friendly palette known as the [Okabe-Ito color palette](https://siegal.bio.nyu.edu/color-palette/).

The `colorScheme` option slightly changes the color palette contrast ratio to respect WCAG AA for normal text with a minimum contrast of 5:1 on a white (`#ffffff`) or dark (`#282828`) background.

See example bellow if you want the colors to be automatically determined based on the user's system preference using `window.matchMedia` :

```ts
// If you want the colors to be automatically determined based on the user's system preference
useAtomsLogger({
  colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
});

// If you want the color to be specified in an environment variable (in vite)
useAtomsLogger({ colorScheme: import.meta.env.VITE_ATOMS_LOGGER_COLOR_SCHEME });

// If you want to disable colors
useAtomsLogger({ formattedOutput: false });
```

### Stringification

By default, the logger converts atom values to strings for console output using a combination of `toString` and `JSON.stringify`.

You can control how values appear in logs with these options:

- `stringifyValues`: Enable/disable string conversion (default: `true`)
- `stringifyLimit`: Maximum length for stringified output (default: `50`)
- `stringify`: Custom function for more advanced formatting

For better formatting of complex objects, you can use libraries like [@vitest/pretty-format](https://www.npmjs.com/package/@vitest/pretty-format) or [pretty-format](https://www.npmjs.com/package/pretty-format):

```tsx
import { format as prettyFormat } from '@vitest/pretty-format';
import { useAtomsLogger } from 'jotai-logger';

useAtomsLogger({
  stringifyValues: true,
  stringifyLimit: 0,
  stringify(value) {
    return prettyFormat(value, {
      min: true,
      maxDepth: 3,
      maxWidth: 5,
      // See options in https://github.com/jestjs/jest/tree/main/packages/pretty-format#usage-with-options
    });
  },
});
```

### Stack traces

This is an experimental feature that may not work in all cases.

If defined, the logger will try to find the React component that triggered a transaction by calling the `getStackTrace` function and, if found, will log its name and file name in the console.

Here's an example using [stacktrace-js](https://github.com/stacktracejs/stacktrace.js/) library:

```tsx
import { useAtomsLogger } from 'jotai-logger';
import StackTrace from 'stacktrace-js';

useAtomsLogger({
  getStackTrace() {
    try {
      throw new Error('Stack trace');
    } catch (error) {
      return StackTrace.fromError(error as Error, { offline: true });
    }
  },
});
```

## Tree-shaking

Jotai Logger can be used in production mode.

If you only want it in development mode we recommend wrapping the `AtomsLogger` in a conditional statement and tree-shake it out in production to avoid any accidental usage in production.

### Using with Vite.js

For Vite.js applications, you can use environment variables to conditionally include the logger:

```tsx
import { useAtomsLogger } from 'jotai-logger';

function App() {
  return (
    <>
      {import.meta.env.DEV && <AtomsLogger />}
      {/* your app */}
    </>
  );
}

function AtomsLogger() {
  useAtomsLogger();
  return null;
}
```

### Using with Next.js

For Next.js applications, you can leverage environment variables or the built-in `process.env.NODE_ENV`:

```tsx
// App.tsx
import dynamic from 'next/dynamic';

const AtomsLogger = process.env.NODE_ENV === 'development'
  ? dynamic(() => import('./AtomsLogger').then((mod) => ({ default: mod.DevTools })), { ssr: false })
  : null;

function App() {
  return (
    <>
      {AtomsLogger && <AtomsLogger />}
      {/* your app */}
    </>
  );
}

// AtomsLogger.tsx
import { useAtomsLogger } from 'jotai-logger';

export function AtomsLogger() {
  useAtomsLogger();
  return null;
}
```

## Example Logs

Here are some examples of what the logs look like in the console:

### Basic Transaction

You can see a transaction as what triggered some atom changes and the following cascading events.

When an atom is initialized or its change value, you'll see a transaction log like this:

```ts
const counterAtom = atom(0);
counterAtom.debugLabel = 'counter';
store.get(counterAtom);
store.set(counterAtom, 1);
```

```
▶ transaction 1 - 2.35ms : retrieved value of atom1:counter
  ▼ initialized value of atom1:counter to 0
    value: 1
▶ transaction 2 - 4.00ms : set value of atom1:counter to 1
  ▼ changed value of atom1:counter from 0 to 1
    old value: 0
    new value: 1
```

If a changed atom has dependents atoms, their new values will be in the same transaction:

```ts
const resultAtom = atom((get) => get(counterAtom) * 2);
resultAtom.debugLabel = 'result';
```

```
▶ transaction 3 : set value of atom1:counter to 2
  ▶ changed value of atom1:counter from 1 to 2
  ▶ changed value of atom2:result from 2 to 4
```

### Atom setter calls

If you call a write only atom method, it will trigger a new transaction :

```ts
const incrementCounterAtom = atom(null, (get, set) => {
  set(counterAtom, get(counterAtom) + 1);
});
incrementCounterAtom.debugLabel = 'incrementCounter';
store.set(incrementCounterAtom);
```

```
▶ transaction 4 : called set of atom3:incrementCounter
  ▶ changed value of atom1:counter from 3 to 4
```

### Async Transaction

When working with asynchronous atoms, multiple transactions will be triggered based on the promise state :

```ts
const userDataAsyncAtom = atomWithQuery(...);
userDataAsyncAtom.debugLabel = "userDataAsync";
```

```
▶ transaction 5 : subscribed to atom4:userDataAsync
  ▶ pending initial promise of atom4:userDataAsync
  ▶ mounted atom4:userDataAsync
▶ transaction 6 : resolved promise of atom4:userDataAsync
  ▶ resolved initial promise of atom4:userDataAsync to {"name":"Daishi"}
```

Just like promises, these transactions can be either pending, resolved, rejected or aborted.

### Mount and Unmount

When an atom is mounted or unmounted, you'll see logs like this:

```ts
// Vanilla style : counter is mounted when calling store.sub
const unsub = store.sub(counterAtom, () => {
  console.log('counterAtom value is changed to', store.get(counterAtom));
});

// React style : counter is mounted when calling useAtomValue
function MyCounter() {
  const count = useAtomValue(counterAtom);
  // ..
}
```

```
▶ transaction 7 : subscribed to atom4
  ▶ initialized value of atom4 to 42
  ▶ mounted atom4
▶ transaction 8 : unsubscribed from atom4
  ▶ unmounted atom4
```

### Dependency Tracking

When an atom is used in a derived atom, the logger will show their dependencies and dependents:

```ts
const derivedAtom = atom((get) => `${get(counterAtom)} is the count`);
derivedAtom.debugLabel = 'derived';
```

```
▶ transaction 9 : subscribed to atom5:derived
  ▼ initialized value of atom5:derived to "42 is the count"
    value: "42 is the count"
    dependencies: ["atom1:counter"]
  ▶ mounted atom5:derived
```

If the derived atom has its dependencies changed, the logger will notify you:

```ts
const atomWithVariableDeps = atom((get) => {
  if (get(isEnabledAtom)) {
    const aValue = get(anAtom);
  } else {
    const anotherValue = get(anotherAtom);
  }
});
```

```
▶ transaction 10 :
  ▶ changed value of atom6:isEnabledAtom from true to false
  ▼ changed dependencies of atom7:atomWithVariableDeps
    old dependencies: ["atom6:isEnabledAtom", "atom8:anAtom"]
    new dependencies: ["atom6:isEnabledAtom", "atom9:anotherAtom"]
```

### React components

If the `getStackTrace` option is used, the logger will try to find the React component that triggered the transaction.

This can fail in some cases like calling from an `useEffect` but, if found, the log look like this :

```
▶ transaction 11 : [my-component-file-name] MyComponent.useMyAtomValue retrieved value of atom10
  ▶ initialized value of atom10 to false
```

## Logging performances

The logger logs all transactions asynchronously to avoid blocking the main thread.

Internally, the logger uses a debounce mechanism (250ms) to group multiple events into transactions.
Then, it uses [requestIdleCallback](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback) to log these transactions one by one when the browser is idle (with a limit of 250ms for each transaction).

## Lifecycle of atoms

Here's a brief overview of the lifecycle of atoms in Jotai and how they relate to the logger:

- When an atom is **initialized** this means that the atom is created and its value is set for the first time.
- When an atom is **changed** this means that the atom value changed.
- When an atom is **mounted** this means that something is subscribed to its value or one of its dependents.
- When an atom is **unmounted** this means that all subscribers are gone.
- When an atom is **destroyed** this means that the atom is no longer used and its value is removed from memory.
- When an async atom is used, its state will either be **pending**, **resolved**, **rejected** or **aborted**.

In Jotai :

- When using `store.get`, `store.set` or `store.sub`, the atom is **initialized**.
- When using `store.sub`, the atom is **mounted** when `store.sub` is called and **unmounted** when the `unsubscribe` method is called.
- When using `store.set`, the atom is **changed**.

In React :

- When using `useAtom` or `useAtomValue`, the atom is **initialized** and then **mounted** (it uses `store.get` and `store.sub`).
- When all components are not using `useAtom` and `useAtomValue` on an atom, it is **unmounted**.
- When calling `useAtom` or `useSetAtom`'s setter function, the atom is **changed** (it uses `store.set`).

Memory management :

Jotai uses a `WeakMap` to store the atom state, so when the atom is no longer referenced, it will be removed from memory by the garbage collector.
The logger uses [FinalizationRegistry](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/FinalizationRegistry) to track when the atom is destroyed.
