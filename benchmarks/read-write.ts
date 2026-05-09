import { add, complete, cycle, save, suite } from 'benny';
import { atom, createStore } from 'jotai';

import { consoleFormatter } from '../dist/formatters/console.js';
import { createLoggedStore } from '../dist/vanilla/create-logged-store.js';

/**
 * Taken from Jotai benchmarks : [read-write.ts](https://github.com/pmndrs/jotai/blob/main/benchmarks/read-write.ts).
 */

const silentLogger = {
  log: () => {},
  group: () => {},
  groupCollapsed: () => {},
  groupEnd: () => {},
  warn: () => {},
};

const main = async () => {
  // Suite 1: Batch read/write on a single mounted atom
  await suite(
    'read-write-batch',
    add('write 10k', () => {
      const store = createStore();
      const a = atom(0);
      const unsub = store.sub(a, () => {});
      return {
        fn: () => {
          for (let i = 0; i < 10_000; i++) {
            store.set(a, i);
          }
        },
        teardown: () => {
          unsub();
        },
      };
    }),
    add('write 10k [with logger]', () => {
      const store = createLoggedStore(createStore(), {
        synchronous: true,
        formatter: () => {},
      });
      const a = atom(0);
      const unsub = store.sub(a, () => {});
      return {
        fn: () => {
          for (let i = 0; i < 10_000; i++) {
            store.set(a, i);
          }
        },
        teardown: () => {
          unsub();
        },
      };
    }),
    add('write 10k [with console formatter]', () => {
      const store = createLoggedStore(createStore(), {
        synchronous: true,
        formatter: consoleFormatter({ logger: silentLogger }),
      });
      const a = atom(0);
      const unsub = store.sub(a, () => {});
      return {
        fn: () => {
          for (let i = 0; i < 10_000; i++) {
            store.set(a, i);
          }
        },
        teardown: () => {
          unsub();
        },
      };
    }),
    add('read 10k', () => {
      const store = createStore();
      const a = atom(0);
      const unsub = store.sub(a, () => {});
      return {
        fn: () => {
          for (let i = 0; i < 10_000; i++) {
            store.get(a);
          }
        },
        teardown: () => {
          unsub();
        },
      };
    }),
    add('read 10k [with logger]', () => {
      const store = createLoggedStore(createStore(), {
        synchronous: true,
        formatter: () => {},
      });
      const a = atom(0);
      const unsub = store.sub(a, () => {});
      return {
        fn: () => {
          for (let i = 0; i < 10_000; i++) {
            store.get(a);
          }
        },
        teardown: () => {
          unsub();
        },
      };
    }),
    add('read 10k [with console formatter]', () => {
      const store = createLoggedStore(createStore(), {
        synchronous: true,
        formatter: consoleFormatter({ logger: silentLogger }),
      });
      const a = atom(0);
      const unsub = store.sub(a, () => {});
      return {
        fn: () => {
          for (let i = 0; i < 10_000; i++) {
            store.get(a);
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
      file: 'read-write-batch',
      format: 'json',
    }),
    save({
      folder: import.meta.dirname,
      file: 'read-write-batch',
      format: 'chart.html',
    }),
  );

  // Suite 2: Single read/write scaling by store size
  await suite(
    'store-size-scaling',
    ...[2, 3, 4, 5].map((n) =>
      add(`read atoms=${10 ** n}`, () => {
        const store = createStore();
        const target = atom(0);
        for (let i = 0; i < 10 ** n; ++i) {
          const a = atom(i);
          store.set(a, i);
        }
        store.set(target, 0);
        return () => store.get(target);
      }),
    ),
    ...[2, 3, 4, 5].map((n) =>
      add(`read atoms=${10 ** n} [with logger]`, () => {
        const store = createLoggedStore(createStore(), {
          synchronous: true,
          formatter: () => {},
        });
        const target = atom(0);
        for (let i = 0; i < 10 ** n; ++i) {
          const a = atom(i);
          store.set(a, i);
        }
        store.set(target, 0);
        return () => store.get(target);
      }),
    ),
    ...[2, 3, 4, 5].map((n) =>
      add(`read atoms=${10 ** n} [with console formatter]`, () => {
        const store = createLoggedStore(createStore(), {
          synchronous: true,
          formatter: consoleFormatter({ logger: silentLogger }),
        });
        const target = atom(0);
        for (let i = 0; i < 10 ** n; ++i) {
          const a = atom(i);
          store.set(a, i);
        }
        store.set(target, 0);
        return () => store.get(target);
      }),
    ),
    ...[2, 3, 4, 5].map((n) =>
      add(`write atoms=${10 ** n}`, () => {
        const store = createStore();
        const target = atom(0);
        for (let i = 0; i < 10 ** n; ++i) {
          const a = atom(i);
          store.set(a, i);
        }
        store.set(target, 0);
        return () => {
          store.set(target, (c) => c + 1);
        };
      }),
    ),
    ...[2, 3, 4, 5].map((n) =>
      add(`write atoms=${10 ** n} [with logger]`, () => {
        const store = createLoggedStore(createStore(), {
          synchronous: true,
          formatter: () => {},
        });
        const target = atom(0);
        for (let i = 0; i < 10 ** n; ++i) {
          const a = atom(i);
          store.set(a, i);
        }
        store.set(target, 0);
        return () => {
          store.set(target, (c) => c + 1);
        };
      }),
    ),
    ...[2, 3, 4, 5].map((n) =>
      add(`write atoms=${10 ** n} [with console formatter]`, () => {
        const store = createLoggedStore(createStore(), {
          synchronous: true,
          formatter: consoleFormatter({ logger: silentLogger }),
        });
        const target = atom(0);
        for (let i = 0; i < 10 ** n; ++i) {
          const a = atom(i);
          store.set(a, i);
        }
        store.set(target, 0);
        return () => {
          store.set(target, (c) => c + 1);
        };
      }),
    ),
    cycle(),
    complete(),
    save({
      folder: import.meta.dirname,
      file: 'store-size-scaling',
      format: 'json',
    }),
    save({
      folder: import.meta.dirname,
      file: 'store-size-scaling',
      format: 'chart.html',
    }),
  );
};

void main();
