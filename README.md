# Jotai Logger

[![npm](https://img.shields.io/npm/v/jotai-logger)](https://www.npmjs.com/package/jotai-logger)
[![license](https://shields.io/badge/license-MIT-informational)](https://github.com/Wendystraite/jotai-logger/blob/main/LICENSE.md)

Logging utility for [Jotai](https://github.com/pmndrs/jotai) that helps you debug and track atom state changes.

## Features

- 📊 Track atom state changes with detailed transaction logs
- ⏱️ Performance monitoring with timing information
- 🧩 Configurable log levels and filtering options
- 🔍 Stack trace support for debugging
- 🛠️ Customizable with various configuration options
- 🐞 Compatible with [jotai-devtools](https://github.com/jotaijs/jotai-devtools)

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

| Option                       | Type                                                                                       | Default     | Description                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------ | ----------- | --------------------------------------------------------------- |
| `enabled`                    | `boolean`                                                                                  | `true`      | Enable or disable the logger                                    |
| `domain`                     | `string`                                                                                   | `undefined` | Domain identifier for the logger in console output              |
| `shouldShowPrivateAtoms`     | `boolean`                                                                                  | `false`     | Whether to show private atoms (used internally by Jotai)        |
| `shouldShowAtom`             | `(atom: Atom<unknown>) => boolean`                                                         | `undefined` | Custom function to determine whether to show a specific atom    |
| `logger`                     | `Pick<Console, 'log'> & Partial<Pick<Console, 'group' \| 'groupCollapsed' \| 'groupEnd'>>` | `console`   | Custom logger to use                                            |
| `groupLogs`                  | `boolean`                                                                                  | `true`      | Whether to group logs with `logger.group` and `logger.groupEnd` |
| `indentSpaces`               | `number`                                                                                   | `0`         | Number of spaces to use for each level of indentation           |
| `plainTextOutput`            | `boolean`                                                                                  | `false`     | Whether to disable colors in the console                        |
| `colorScheme`                | `'default' \| 'light' \| 'dark'`                                                           | `'default'` | Color scheme to use for the logger                              |
| `stringifyLimit`             | `number`                                                                                   | `50`        | Maximum length of any logged stringified data                   |
| `showTransactionNumber`      | `boolean`                                                                                  | `true`      | Whether to show the transaction number in the console           |
| `showTransactionLocaleTime`  | `boolean`                                                                                  | `false`     | Whether to show when a transaction started                      |
| `showTransactionElapsedTime` | `boolean`                                                                                  | `true`      | Whether to show the elapsed time of a transaction               |
| `collapseTransactions`       | `boolean`                                                                                  | `false`     | Whether to collapse grouped transaction logs by default         |
| `collapseEvents`             | `boolean`                                                                                  | `true`      | Whether to collapse grouped events logs by default              |

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
useAtomsLogger({ plainTextOutput: true });
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

### Lifecycle Events

The logger also tracks atom lifecycle events.

When an atom is `mounted` this means that something is subscribed to its value.
This is usually a React component using either `useAtom` or `useAtomValue` or the dependency of another mounted atom.

When an atom is `unmounted` this means that all subscriber are gone.

```ts
// Vanilla style : counter is mounted when calling store.sub
const unsub = store.sub(counterAtom, () => {
  console.log('counterAtom value is changed to', store.get(counterAtom));
});

// React style : counter is mounted when calling useAtomValue (useAtomValue call store.get / store.sub for you)
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

### React components

The logger try to use [stacktrace.js](https://github.com/stacktracejs/stacktrace.js) to find the React component name that triggered a transaction.
This can fail but if found the log look like this :

```
▶ transaction 9 : [my-component-file-name] MyComponent.useMyAtomValue retrieved value of atom5
  ▶ initialized value of atom5 to false
```
