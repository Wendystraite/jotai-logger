import { add, complete, cycle, save, suite } from 'benny';
import type { Atom } from 'jotai';
import { atom, createStore } from 'jotai';

import { consoleFormatter } from '../dist/formatters/console.js';
import { createLoggedStore } from '../dist/vanilla/create-logged-store.js';

/**
 * Taken from Jotai benchmarks : [computed-read.ts](https://github.com/pmndrs/jotai/blob/main/benchmarks/computed-read.ts).
 */

const silentLogger = {
  log: () => {},
  group: () => {},
  groupCollapsed: () => {},
  groupEnd: () => {},
  warn: () => {},
};

function buildDerivedChain(depth: number): Atom<number> {
  const base = atom(0);
  let prev: Atom<number> = base;
  for (let i = 0; i < depth; i++) {
    const p = prev;
    prev = atom((get) => get(p) + 1);
  }
  return prev;
}

const main = async () => {
  await suite(
    'computed-read',
    ...[1, 5, 10, 50]
      .map((depth) => [
        add(`read chain depth=${depth}`, () => {
          const store = createStore();
          const leaf = buildDerivedChain(depth);
          const unsub = store.sub(leaf, () => {});
          store.get(leaf); // prime
          return {
            fn: () => store.get(leaf),
            teardown: () => {
              unsub();
            },
          };
        }),
        add(`read chain depth=${depth} [with logger]`, () => {
          const store = createLoggedStore(createStore(), {
            synchronous: true,
            formatter: () => {},
          });
          const leaf = buildDerivedChain(depth);
          const unsub = store.sub(leaf, () => {});
          store.get(leaf); // prime
          return {
            fn: () => store.get(leaf),
            teardown: () => {
              unsub();
            },
          };
        }),
        add(`read chain depth=${depth} [with console formatter]`, () => {
          const store = createLoggedStore(createStore(), {
            synchronous: true,
            formatter: consoleFormatter({ logger: silentLogger }),
          });
          const leaf = buildDerivedChain(depth);
          const unsub = store.sub(leaf, () => {});
          store.get(leaf); // prime
          return {
            fn: () => store.get(leaf),
            teardown: () => {
              unsub();
            },
          };
        }),
      ])
      .flat(1),
    cycle(),
    complete(),
    save({
      folder: import.meta.dirname,
      file: 'computed-read',
      format: 'json',
    }),
    save({
      folder: import.meta.dirname,
      file: 'computed-read',
      format: 'chart.html',
    }),
  );
};

void main();
