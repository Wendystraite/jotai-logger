import { add, complete, cycle, save, suite } from 'benny';
import { type PrimitiveAtom, atom, createStore } from 'jotai';

import { consoleFormatter } from '../dist/formatters/console.js';
import { createLoggedStore } from '../dist/vanilla/create-logged-store.js';

/**
 * Taken from Jotai benchmarks : [simple-read.ts](https://github.com/pmndrs/jotai/blob/main/benchmarks/simple-read.ts).
 */

const silentLogger = {
  log: () => {},
  group: () => {},
  groupCollapsed: () => {},
  groupEnd: () => {},
  warn: () => {},
};

const createStateWithAtoms = (
  n: number,
  { withLogger, withConsoleFormatter }: { withLogger: boolean; withConsoleFormatter?: boolean },
) => {
  let targetAtom: PrimitiveAtom<number> | undefined;
  let store = createStore();
  if (withLogger) {
    store = createLoggedStore(store, {
      synchronous: true,
      formatter: withConsoleFormatter ? consoleFormatter({ logger: silentLogger }) : () => {},
    });
  }
  for (let i = 0; i < n; ++i) {
    const a = atom(i);
    targetAtom ??= a;
    store.set(a, i);
  }
  if (!targetAtom) {
    throw new Error();
  }
  return [store, targetAtom] as const;
};

const main = async () => {
  await suite(
    'simple-read',
    ...[2, 3, 4, 5]
      .map((n) => [
        add(`atoms=${10 ** n}`, () => {
          const [store, targetAtom] = createStateWithAtoms(10 ** n, { withLogger: false });
          return () => store.get(targetAtom);
        }),
        add(`atoms=${10 ** n} [with logger]`, () => {
          const [store, targetAtom] = createStateWithAtoms(10 ** n, { withLogger: true });
          return () => store.get(targetAtom);
        }),
        add(`atoms=${10 ** n} [with console formatter]`, () => {
          const [store, targetAtom] = createStateWithAtoms(10 ** n, {
            withLogger: true,
            withConsoleFormatter: true,
          });
          return () => store.get(targetAtom);
        }),
      ])
      .flat(1),
    cycle(),
    complete(),
    save({
      folder: import.meta.dirname,
      file: 'simple-read',
      format: 'json',
    }),
    save({
      folder: import.meta.dirname,
      file: 'simple-read',
      format: 'chart.html',
    }),
  );
};

void main();
