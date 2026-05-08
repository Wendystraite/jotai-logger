import { add, complete, cycle, save, suite } from 'benny';
import { atom, createStore } from 'jotai';
import { selectAtom } from 'jotai/vanilla/utils';

import { consoleFormatter } from '../dist/formatters/console.js';
import { createLoggedStore } from '../dist/vanilla/create-logged-store.js';

/**
 * Taken from Jotai benchmarks : [select-atom.ts](https://github.com/pmndrs/jotai/blob/main/benchmarks/select-atom.ts).
 */

const silentLogger = {
  log: () => {},
  group: () => {},
  groupCollapsed: () => {},
  groupEnd: () => {},
  warn: () => {},
};

const main = async () => {
  await suite(
    'select-atom',
    add('selectAtom 10k writes (relevant key)', () => {
      const store = createStore();
      const base = atom({ count: 0, name: 'test' });
      const countAtom = selectAtom(base, (v) => v.count);
      const unsub = store.sub(countAtom, () => {});
      store.get(countAtom); // prime
      return {
        fn: () => {
          for (let i = 0; i < 10_000; i++) {
            store.set(base, { count: i, name: 'test' });
            store.get(countAtom);
          }
        },
        teardown: () => {
          unsub();
        },
      };
    }),
    add('selectAtom 10k writes (relevant key) [with logger]', () => {
      const store = createLoggedStore(createStore(), {
        synchronous: true,
        formatter: () => {},
      });
      const base = atom({ count: 0, name: 'test' });
      const countAtom = selectAtom(base, (v) => v.count);
      const unsub = store.sub(countAtom, () => {});
      store.get(countAtom); // prime
      return {
        fn: () => {
          for (let i = 0; i < 10_000; i++) {
            store.set(base, { count: i, name: 'test' });
            store.get(countAtom);
          }
        },
        teardown: () => {
          unsub();
        },
      };
    }),
    add('selectAtom 10k writes (relevant key) [with console formatter]', () => {
      const store = createLoggedStore(createStore(), {
        synchronous: true,
        formatter: consoleFormatter({ logger: silentLogger }),
      });
      const base = atom({ count: 0, name: 'test' });
      const countAtom = selectAtom(base, (v) => v.count);
      const unsub = store.sub(countAtom, () => {});
      store.get(countAtom); // prime
      return {
        fn: () => {
          for (let i = 0; i < 10_000; i++) {
            store.set(base, { count: i, name: 'test' });
            store.get(countAtom);
          }
        },
        teardown: () => {
          unsub();
        },
      };
    }),
    add('selectAtom 10k writes (irrelevant key)', () => {
      const store = createStore();
      const base = atom({ count: 0, name: 'test' });
      const countAtom = selectAtom(base, (v) => v.count);
      const unsub = store.sub(countAtom, () => {});
      store.get(countAtom); // prime
      return {
        fn: () => {
          for (let i = 0; i < 10_000; i++) {
            store.set(base, { count: 0, name: `test-${i}` });
            store.get(countAtom);
          }
        },
        teardown: () => {
          unsub();
        },
      };
    }),
    add('selectAtom 10k writes (irrelevant key) [with logger]', () => {
      const store = createLoggedStore(createStore(), {
        synchronous: true,
        formatter: () => {},
      });
      const base = atom({ count: 0, name: 'test' });
      const countAtom = selectAtom(base, (v) => v.count);
      const unsub = store.sub(countAtom, () => {});
      store.get(countAtom); // prime
      return {
        fn: () => {
          for (let i = 0; i < 10_000; i++) {
            store.set(base, { count: 0, name: `test-${i}` });
            store.get(countAtom);
          }
        },
        teardown: () => {
          unsub();
        },
      };
    }),
    add('selectAtom 10k writes (irrelevant key) [with console formatter]', () => {
      const store = createLoggedStore(createStore(), {
        synchronous: true,
        formatter: consoleFormatter({ logger: silentLogger }),
      });
      const base = atom({ count: 0, name: 'test' });
      const countAtom = selectAtom(base, (v) => v.count);
      const unsub = store.sub(countAtom, () => {});
      store.get(countAtom); // prime
      return {
        fn: () => {
          for (let i = 0; i < 10_000; i++) {
            store.set(base, { count: 0, name: `test-${i}` });
            store.get(countAtom);
          }
        },
        teardown: () => {
          unsub();
        },
      };
    }),
    cycle(),
    complete(),
    save({
      folder: import.meta.dirname,
      file: 'select-atom',
      format: 'json',
    }),
    save({
      folder: import.meta.dirname,
      file: 'select-atom',
      format: 'chart.html',
    }),
  );
};

void main();
