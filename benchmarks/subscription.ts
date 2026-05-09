import { add, complete, cycle, save, suite } from 'benny';
import { atom, createStore } from 'jotai';

import { consoleFormatter } from '../dist/formatters/console.js';
import { createLoggedStore } from '../dist/vanilla/create-logged-store.js';

/**
 * Taken from Jotai benchmarks : [subscription.ts](https://github.com/pmndrs/jotai/blob/main/benchmarks/subscription.ts).
 */

const silentLogger = {
  log: () => {},
  group: () => {},
  groupCollapsed: () => {},
  groupEnd: () => {},
  warn: () => {},
};

const main = async () => {
  // Suite 1: Subscribe/unsubscribe churn
  await suite(
    'sub-unsub',
    ...[100, 500, 1000]
      .map((count) => [
        add(`sub/unsub ${count} atoms`, () => {
          return () => {
            const store = createStore();
            const atoms = [];
            for (let i = 0; i < count; i++) atoms.push(atom(i));
            for (const a of atoms) {
              const unsub = store.sub(a, () => {});
              unsub();
            }
          };
        }),
        add(`sub/unsub ${count} atoms [with logger]`, () => {
          return () => {
            const store = createLoggedStore(createStore(), {
              synchronous: true,
              formatter: () => {},
            });
            const atoms = [];
            for (let i = 0; i < count; i++) atoms.push(atom(i));
            for (const a of atoms) {
              const unsub = store.sub(a, () => {});
              unsub();
            }
          };
        }),
        add(`sub/unsub ${count} atoms [with console formatter]`, () => {
          return () => {
            const store = createLoggedStore(createStore(), {
              synchronous: true,
              formatter: consoleFormatter({ logger: silentLogger }),
            });
            const atoms = [];
            for (let i = 0; i < count; i++) atoms.push(atom(i));
            for (const a of atoms) {
              const unsub = store.sub(a, () => {});
              unsub();
            }
          };
        }),
      ])
      .flat(1),
    cycle(),
    complete(),
    save({
      folder: import.meta.dirname,
      file: 'sub-unsub',
      format: 'json',
    }),
    save({
      folder: import.meta.dirname,
      file: 'sub-unsub',
      format: 'chart.html',
    }),
  );

  // Suite 2: Write with all atoms subscribed
  await suite(
    'subscribe-write',
    ...[2, 3, 4]
      .map((n) => [
        add(`atoms=${10 ** n}`, () => {
          const store = createStore();
          const target = atom(0);
          const unsubs: (() => void)[] = [];
          for (let i = 0; i < 10 ** n; ++i) {
            const a = atom(i);
            store.get(a);
            unsubs.push(
              store.sub(a, () => {
                store.get(a);
              }),
            );
          }
          return {
            fn: () => {
              store.set(target, (c) => c + 1);
            },
            teardown: () => {
              unsubs.forEach((u) => {
                u();
              });
            },
          };
        }),
        add(`atoms=${10 ** n} [with logger]`, () => {
          const store = createLoggedStore(createStore(), {
            synchronous: true,
            formatter: () => {},
          });
          const target = atom(0);
          const unsubs: (() => void)[] = [];
          for (let i = 0; i < 10 ** n; ++i) {
            const a = atom(i);
            store.get(a);
            unsubs.push(
              store.sub(a, () => {
                store.get(a);
              }),
            );
          }
          return {
            fn: () => {
              store.set(target, (c) => c + 1);
            },
            teardown: () => {
              unsubs.forEach((u) => {
                u();
              });
            },
          };
        }),
        add(`atoms=${10 ** n} [with console formatter]`, () => {
          const store = createLoggedStore(createStore(), {
            synchronous: true,
            formatter: consoleFormatter({ logger: silentLogger }),
          });
          const target = atom(0);
          const unsubs: (() => void)[] = [];
          for (let i = 0; i < 10 ** n; ++i) {
            const a = atom(i);
            store.get(a);
            unsubs.push(
              store.sub(a, () => {
                store.get(a);
              }),
            );
          }
          return {
            fn: () => {
              store.set(target, (c) => c + 1);
            },
            teardown: () => {
              unsubs.forEach((u) => {
                u();
              });
            },
          };
        }),
      ])
      .flat(1),
    cycle(),
    complete(),
    save({
      folder: import.meta.dirname,
      file: 'subscribe-write',
      format: 'json',
    }),
    save({
      folder: import.meta.dirname,
      file: 'subscribe-write',
      format: 'chart.html',
    }),
  );
};

void main();
