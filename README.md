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
- 🔌 Pluggable formatter system with built-in console output

## Installation

```bash
# npm
npm install jotai-logger

# yarn
yarn add jotai-logger

# pnpm
pnpm install jotai-logger
```

## Compatibility

ESM Only. Compatible with React 17+ and Jotai 2.18+.
See the table below for older Jotai versions.

<details>
<summary>Version compatibility reference</summary>

| jotai-logger | [react](https://github.com/facebook/react) | [jotai](https://github.com/pmndrs/jotai) | [jotai-devtools](https://github.com/jotaijs/jotai-devtools) |
| ------------ | ------------------------------------------ | ---------------------------------------- | ----------------------------------------------------------- |
| <= 2.5.2     | >=17.0.0                                   | >= 2.12.4 < 2.14.0                       | == 0.12.0                                                   |
| >= 3.0.0     | >=17.0.0                                   | >= 2.14.0 < 2.18.0                       | >= 0.13.0                                                   |
| >= 4.0.0     | >=17.0.0                                   | >= 2.18.0                                | >= 0.13.0                                                   |

</details>

## Usage

<details>
<summary>React Setup</summary>

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

</details>

<details>
<summary>Vanilla Setup</summary>

```ts
import { createStore } from 'jotai';
import { bindAtomsLoggerToStore } from 'jotai-logger/vanilla';

const store = createStore();
bindAtomsLoggerToStore(store);
```

</details>

## Logger Configuration

Options passed to `bindAtomsLoggerToStore` / `useAtomsLogger` via `AtomLoggerOptions`.
These control **event collection and transaction scheduling** only — display options live in `ConsoleFormatterOptions`.

<details>
<summary><code>AtomLoggerOptions</code> reference</summary>

```ts
import type { AtomLoggerOptions } from 'jotai-logger/vanilla';

type AtomLoggerOptions = {
  /** Custom formatter called for each completed transaction. Defaults to consoleFormatter(). */
  formatter?: AtomLoggerFormatter;

  /** Enable or disable the logger. @default true */
  enabled?: boolean;

  /** Show private atoms used internally by Jotai libraries. @default false */
  shouldShowPrivateAtoms?: boolean;

  /** Custom predicate to filter which atoms are logged. */
  shouldShowAtom?: (atom: Atom) => boolean;

  /** (Experimental) Retrieve the React component owner stack for a transaction. */
  getOwnerStack?: () => string | null | undefined;

  /** (Experimental) Retrieve the currently rendering React component's display name. */
  getComponentDisplayName?: () => string | undefined;

  /** Log synchronously instead of asynchronously. @default false */
  synchronous?: boolean;

  /** Debounce period for grouping events into a single transaction (ms). @default 250 */
  transactionDebounceMs?: number;

  /** Maximum timeout for requestIdleCallback scheduling (ms). @default 250 */
  requestIdleCallbackTimeoutMs?: number;

  /** Maximum processing time per batch (ms). @default 16 */
  maxProcessingTimeMs?: number;
};
```

</details>

<details>
<summary>Component Tracking — <code>getOwnerStack</code> &amp; <code>getComponentDisplayName</code> (Experimental)</summary>

These features are designed for React and may not work in all cases.

### Owner Stack (`getOwnerStack`)

Displays the React component hierarchy that triggered a transaction.
Accepts React 19.1+'s [`captureOwnerStack`](https://react.dev/reference/react/captureOwnerStack).

```tsx
import { useAtomsLogger } from 'jotai-logger';
import { captureOwnerStack } from 'react';

useAtomsLogger({
  getOwnerStack: captureOwnerStack,
});
```

The number of parent components shown is controlled by `ownerStackLimit` in `consoleFormatter` (default: `2`).

```tsx
import { consoleFormatter } from 'jotai-logger/formatters/console';
import { captureOwnerStack } from 'react';

useAtomsLogger({
  getOwnerStack: captureOwnerStack,
  formatter: consoleFormatter({ ownerStackLimit: 5 }),
});
```

### Component Display Name (`getComponentDisplayName`)

Shows the current component's display name in transaction logs.
If it is already shown at the end of the owner stack, it won't be duplicated.

```tsx
import { useAtomsLogger } from 'jotai-logger';

useAtomsLogger({
  getComponentDisplayName: getReact19ComponentDisplayName,
});
```

<details>
<summary>React 19+ implementation of <code>getReact19ComponentDisplayName</code></summary>

```tsx
import React from 'react';

function getReact19ComponentDisplayName(): string | undefined {
  const React19 = React as {
    __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE?: {
      A?: { getOwner?: () => { type?: { displayName?: string; name?: string } } };
    };
    __SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE?: {
      A?: { getOwner?: () => { type?: { displayName?: string; name?: string } } };
    };
  };
  const component = (
    React19.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE ??
    React19.__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  )?.A?.getOwner?.().type;
  return component?.displayName ?? component?.name;
}
```

</details>

</details>

<details>
<summary>Synchronous vs. Asynchronous Logging</summary>

By default the logger uses asynchronous logging to minimise performance impact.

### Synchronous

```tsx
useAtomsLogger({ synchronous: true });
```

Useful for debugging, testing, or deterministic log ordering.
Has a performance cost with frequent atom changes.

### Asynchronous pipeline

Three parameters control the async pipeline:

1. `transactionDebounceMs` (default: `250ms`) — groups events into transactions:
   - Higher → fewer, noisier transactions
   - `0` → immediate scheduling (equivalent to `synchronous: true`)
2. `requestIdleCallbackTimeoutMs` (default: `250ms`) — schedules when logs are written:
   - `0` → only write when truly idle (may delay indefinitely)
   - `-1` → disable idle scheduling entirely (equivalent to `synchronous: true`)
3. `maxProcessingTimeMs` (default: `16ms`) — caps time per processing batch:
   - `0` or negative → process everything in one go (equivalent to `synchronous: true`)
   - `16ms` ≈ one frame at 60fps

```tsx
// Quick feedback
useAtomsLogger({
  transactionDebounceMs: 50,
  requestIdleCallbackTimeoutMs: 100,
  maxProcessingTimeMs: 10,
});

// Performance priority
useAtomsLogger({
  transactionDebounceMs: 500,
  requestIdleCallbackTimeoutMs: 0,
  maxProcessingTimeMs: 50,
});

// Default
useAtomsLogger({
  transactionDebounceMs: 250,
  requestIdleCallbackTimeoutMs: 250,
  maxProcessingTimeMs: 16,
});
```

</details>

<details>
<summary>Logging Performances</summary>

The logger logs all transactions asynchronously to avoid blocking the main thread.

Internally, the logger uses a multi-stage approach:

1. **Debouncing**: Events are grouped into transactions using a debounce mechanism (`transactionDebounceMs`).
2. **Idle scheduling**: Transactions are scheduled using
   [requestIdleCallback](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback) when the
   browser is idle (`requestIdleCallbackTimeoutMs`).
3. **Batch processing**: Transactions are processed in batches to prevent blocking the main thread
   (`maxProcessingTimeMs`).

This approach ensures that even when handling large queues of transactions, UI responsiveness is maintained by
spreading the work across multiple idle periods.

</details>

## Built-in Console Formatter

The default formatter — `consoleFormatter()` from `jotai-logger/formatters/console` logs atom transactions to
the browser or Node.js console with colors, grouping, and timing information.

<details>
<summary><code>ConsoleFormatterOptions</code> reference</summary>

```ts
import { consoleFormatter } from 'jotai-logger/formatters/console';
import type { ConsoleFormatterOptions } from 'jotai-logger/formatters/console';

type ConsoleFormatterOptions = {
  /** Prefix shown before the transaction number in logs. */
  domain?: string;

  /** Custom logger object. @default console */
  logger?: Pick<Console, 'log'> & Partial<Pick<Console, 'group' | 'groupCollapsed' | 'groupEnd'>>;

  /** Group transactions with console.group. @default true */
  groupTransactions?: boolean;

  /** Group events inside a transaction with console.group. @default false */
  groupEvents?: boolean;

  /** Spaces per indentation level (0 = disabled). @default 0 */
  indentSpaces?: number;

  /** Use %c color/style formatting. @default true */
  formattedOutput?: boolean;

  /** Color palette: 'default' | 'light' | 'dark'. @default 'default' */
  colorScheme?: 'default' | 'light' | 'dark';

  /** Max length of stringified values (0 = no limit). @default 50 */
  stringifyLimit?: number;

  /** Stringify atom values in logs. @default true */
  stringifyValues?: boolean;

  /** Custom value-to-string function. */
  stringify?: (value: unknown) => string;

  /** Show transaction number. @default true */
  showTransactionNumber?: boolean;

  /** Show event count per transaction. @default true */
  showTransactionEventsCount?: boolean;

  /** Show transaction start time (locale time string). @default false */
  showTransactionLocaleTime?: boolean;

  /** Show transaction elapsed time. @default true */
  showTransactionElapsedTime?: boolean;

  /** Pad fields for column alignment across transactions. @default true */
  autoAlignTransactions?: boolean;

  /** Collapse transaction groups by default. @default false */
  collapseTransactions?: boolean;

  /** Collapse event groups by default. @default false */
  collapseEvents?: boolean;

  /** Max parent components shown from owner stack. @default 2 */
  ownerStackLimit?: number;
};
```

</details>

<details>
<summary>Colors</summary>

The default color scheme uses colors easy to read in both light and dark mode, based on the colorblind-friendly
[Okabe-Ito palette](https://siegal.bio.nyu.edu/color-palette/).

The `colorScheme` option adjusts contrast ratios to meet WCAG AA (min 5:1) on white (`#ffffff`) or dark
(`#282828`) backgrounds.

```ts
import { consoleFormatter } from 'jotai-logger/formatters/console';

// Follow the system preference
useAtomsLogger({
  formatter: consoleFormatter({
    colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  }),
});

// Read from an environment variable (Vite)
useAtomsLogger({
  formatter: consoleFormatter({
    colorScheme: import.meta.env.VITE_ATOMS_LOGGER_COLOR_SCHEME,
  }),
});

// Disable colors entirely
useAtomsLogger({
  formatter: consoleFormatter({ formattedOutput: false }),
});
```

</details>

<details>
<summary>Stringification</summary>

By default atom values are converted to strings using `toString()` and `JSON.stringify`.

- `stringifyValues`: enable/disable conversion (default: `true`)
- `stringifyLimit`: max output length in characters (default: `50`)
- `stringify`: custom serialiser function

```ts
// Custom serialiser with @vitest/pretty-format
import { format as prettyFormat } from '@vitest/pretty-format';
import { consoleFormatter } from 'jotai-logger/formatters/console';

useAtomsLogger({
  formatter: consoleFormatter({
    stringifyValues: true,
    stringifyLimit: 0,
    stringify(value) {
      return prettyFormat(value, { min: true, maxDepth: 3, maxWidth: 5 });
    },
  }),
});
```

</details>

<details>
<summary>Example Logs</summary>

<details>
<summary>Basic Transaction</summary>

A transaction represents what triggered some atom changes and the cascading events that followed.

```ts
const counterAtom = atom(0);
counterAtom.debugLabel = 'counter';
store.get(counterAtom);
store.set(counterAtom, 1);
```

```
▶ transaction 1 - 2.35ms - 1 event : retrieved value of atom1:counter
  ▼ initialized value of atom1:counter to 0
    value: 0
▶ transaction 2 - 4.00ms - 1 event : set value of atom1:counter to 1
  ▼ changed value of atom1:counter from 0 to 1
    old value: 0
    new value: 1
```

If a changed atom has dependent atoms, their new values appear in the same transaction:

```ts
const resultAtom = atom((get) => get(counterAtom) * 2);
resultAtom.debugLabel = 'result';
```

```
▶ transaction 3 - 2 events : set value of atom1:counter to 2
  ▶ changed value of atom1:counter from 1 to 2
  ▶ changed value of atom2:result from 2 to 4
```

</details>

<details>
<summary>Atom setter calls</summary>

```ts
const incrementCounterAtom = atom(null, (get, set) => {
  set(counterAtom, get(counterAtom) + 1);
});
incrementCounterAtom.debugLabel = 'incrementCounter';
store.set(incrementCounterAtom);
```

```
▶ transaction 4 - 1 event : called set of atom3:incrementCounter
  ▶ changed value of atom1:counter from 3 to 4
```

</details>

<details>
<summary>Async Transaction</summary>

```ts
const userDataAsyncAtom = atomWithQuery(...);
userDataAsyncAtom.debugLabel = 'userDataAsync';
```

```
▶ transaction 5 - 2 events : subscribed to atom4:userDataAsync
  ▶ pending initial promise of atom4:userDataAsync
  ▶ mounted atom4:userDataAsync
▶ transaction 6 - 1 event : resolved promise of atom4:userDataAsync
  ▶ resolved initial promise of atom4:userDataAsync to {"name":"Daishi"}
```

Transactions can be pending, resolved, rejected, or aborted.

</details>

<details>
<summary>Mount and Unmount</summary>

```ts
// Vanilla
const unsub = store.sub(counterAtom, () => {});

// React
function MyCounter() {
  const count = useAtomValue(counterAtom);
}
```

```
▶ transaction 7 - 2 events : subscribed to atom4
  ▶ initialized value of atom4 to 42
  ▶ mounted atom4
▶ transaction 8 - 1 event : unsubscribed from atom4
  ▶ unmounted atom4
```

</details>

<details>
<summary>Dependency Tracking</summary>

```ts
const derivedAtom = atom((get) => `${get(counterAtom)} is the count`);
derivedAtom.debugLabel = 'derived';
```

```
▶ transaction 9 - 2 events : subscribed to atom5:derived
  ▼ initialized value of atom5:derived to "42 is the count"
    value: "42 is the count"
    dependencies: ["atom1:counter"]
  ▶ mounted atom5:derived
```

If an atom's dependencies change:

```
▶ transaction 10 - 2 events :
  ▶ changed value of atom6:isEnabledAtom from true to false
  ▼ changed dependencies of atom7:atomWithVariableDeps
    old dependencies: ["atom6:isEnabledAtom", "atom8:anAtom"]
    new dependencies: ["atom6:isEnabledAtom", "atom9:anotherAtom"]
```

</details>

<details>
<summary>React component tracking</summary>

With `getOwnerStack` — shows parent component hierarchy:

```
▶ transaction 11 : [MyApp.MyParent] retrieved value of atom10
  ▶ initialized value of atom10 to false
```

With `getComponentDisplayName` — shows the currently rendering component:

```
▶ transaction 11 : MyComponent retrieved value of atom10
  ▶ initialized value of atom10 to false
```

With both combined:

```
▶ transaction 11 : [MyApp.MyParent] MyComponent retrieved value of atom10
  ▶ initialized value of atom10 to false
```

</details>

</details>

## Tree-shaking

Jotai Logger can be used in production mode. If you only want it in development, wrap the component in a
conditional and tree-shake it out to avoid accidental production usage.

<details>
<summary>Using with Vite.js</summary>

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

</details>

<details>
<summary>Using with Next.js</summary>

```tsx
// App.tsx
import dynamic from 'next/dynamic';

const AtomsLogger =
  process.env.NODE_ENV === 'development'
    ? dynamic(
        () => import('./AtomsLogger').then((mod) => ({ default: mod.AtomsLogger })),
        { ssr: false },
      )
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

</details>

## Lifecycle of atoms

<details>
<summary>Atom lifecycle reference</summary>

- **initialized** — the atom is created and its value is set for the first time.
- **changed** — the atom value changed.
- **mounted** — something subscribed to its value or one of its dependents.
- **unmounted** — all subscribers are gone.
- **destroyed** — the atom is no longer referenced and its value is removed from memory.
- **pending / resolved / rejected / aborted** — states for async atoms.

**In vanilla Jotai:**

- `store.get`, `store.set`, `store.sub` → atom is **initialized**.
- `store.sub` → atom is **mounted**; the returned unsubscribe function → **unmounted**.
- `store.set` → atom is **changed**.

**In React:**

- `useAtom` / `useAtomValue` → atom is **initialized** then **mounted**.
- All components stop using the atom → **unmounted**.
- `useAtom` / `useSetAtom` setter → atom is **changed**.

**Memory management:**

Jotai uses a `WeakMap` to store atom state, so when an atom is no longer referenced it is removed by the garbage
collector. The logger uses
[FinalizationRegistry](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/FinalizationRegistry)
to track when atoms are destroyed.

</details>
