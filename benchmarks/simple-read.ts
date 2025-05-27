import { add, complete, cycle, save, suite } from 'benny';
import { type PrimitiveAtom, atom, createStore } from 'jotai';

import { bindAtomsLoggerToStore } from '../src/bind-atoms-logger-to-store.js';

/**
 * Taken from Jotai benchmarks : [simple-read.ts](https://github.com/pmndrs/jotai/blob/main/benchmarks/simple-read.ts).
 */

const createStateWithAtoms = (n: number, { withLogger }: { withLogger: boolean }) => {
  let targetAtom: PrimitiveAtom<number> | undefined;
  const store = createStore();
  if (withLogger) {
    bindAtomsLoggerToStore(store, {
      synchronous: true,
      logger: { log: () => {}, group: () => {}, groupEnd: () => {} },
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
