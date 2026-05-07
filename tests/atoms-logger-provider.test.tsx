// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { Provider, createStore, useStore } from 'jotai';
import React from 'react';
import { useEffect, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  AtomLoggerProvider,
  createLoggedStore,
  getLoggedStoreOptions,
  isLoggedStore,
  type AtomLoggerOptions,
} from '../src/index.js';
import type { Store } from '../src/vanilla/types/store.js';

describe('AtomLoggerProvider', () => {
  it('should provide a logged store to children', () => {
    let childStore: Store | undefined;

    function Child() {
      childStore = useStore();
      return null;
    }

    render(
      <AtomLoggerProvider>
        <Child />
      </AtomLoggerProvider>,
    );

    expect(isLoggedStore(childStore!)).toBeTruthy();
  });

  it('should use the parent store from context', () => {
    const parentStore = createStore();

    let childStore: Store | undefined;

    function Child() {
      childStore = useStore();
      return null;
    }

    render(
      <Provider store={parentStore}>
        <AtomLoggerProvider>
          <Child />
        </AtomLoggerProvider>
      </Provider>,
    );

    expect(isLoggedStore(childStore!)).toBeTruthy();
    expect(childStore).not.toBe(parentStore);
  });

  it('should not enable logging when disabled prop is passed', () => {
    let childStore: Store | undefined;

    function Child() {
      childStore = useStore();
      return null;
    }

    render(
      <AtomLoggerProvider enabled={false}>
        <Child />
      </AtomLoggerProvider>,
    );

    // Store is still a logged store but logging is disabled
    expect(isLoggedStore(childStore!)).toBeTruthy();
    expect(getLoggedStoreOptions(childStore!)?.enabled).toBe(false);
  });

  it('should propagate the parent store from context', () => {
    const parentStore = createStore();
    let childStore: Store | undefined;

    function Child() {
      childStore = useStore();
      return null;
    }

    render(
      <Provider store={parentStore}>
        <AtomLoggerProvider>
          <Child />
        </AtomLoggerProvider>
      </Provider>,
    );

    expect(isLoggedStore(childStore!)).toBeTruthy();
    expect(childStore).not.toBe(parentStore);
  });

  it('should apply a custom formatter when provided', () => {
    const customFormatter = vi.fn();
    let childStore: Store | undefined;

    function Child() {
      childStore = useStore();
      return null;
    }

    render(
      <AtomLoggerProvider formatter={customFormatter}>
        <Child />
      </AtomLoggerProvider>,
    );

    expect(getLoggedStoreOptions(childStore!)?.formatter).toBe(customFormatter);
  });

  it('should update logger options when props change', () => {
    let childStore: Store | undefined;

    function Child() {
      childStore = useStore();
      return null;
    }

    function Parent() {
      const [options, setOptions] = useState<AtomLoggerOptions>({
        shouldShowPrivateAtoms: false,
        synchronous: false,
      });

      useEffect(() => {
        setOptions({
          shouldShowPrivateAtoms: true,
          synchronous: true,
        });
      }, []);

      return (
        <AtomLoggerProvider {...options}>
          <Child />
        </AtomLoggerProvider>
      );
    }

    render(<Parent />);

    expect(getLoggedStoreOptions(childStore!)).toEqual(
      expect.objectContaining({
        shouldShowPrivateAtoms: true,
      }),
    );
  });

  it('should recreate the logged store when the parent store changes', () => {
    const stores: Store[] = [];

    function Child() {
      const store = useStore();
      stores.push(store);
      return null;
    }

    const parentStore1 = createStore();
    const parentStore2 = createStore();

    function Parent() {
      const [parentStore, setParentStore] = useState<Store>(parentStore1);

      useEffect(() => {
        setParentStore(parentStore2);
      }, []);

      return (
        <Provider store={parentStore}>
          <AtomLoggerProvider>
            <Child />
          </AtomLoggerProvider>
        </Provider>
      );
    }

    render(<Parent />);

    expect(stores.length).toBeGreaterThanOrEqual(2);
    const firstLoggedStore = stores[0]!;
    const lastLoggedStore = stores[stores.length - 1]!;
    expect(firstLoggedStore).not.toBe(lastLoggedStore);
    expect(isLoggedStore(firstLoggedStore)).toBeTruthy();
    expect(isLoggedStore(lastLoggedStore)).toBeTruthy();
  });

  it('should use default options when none provided', () => {
    let childStore: Store | undefined;

    function Child() {
      childStore = useStore();
      return null;
    }

    render(
      <AtomLoggerProvider>
        <Child />
      </AtomLoggerProvider>,
    );

    expect(isLoggedStore(childStore!)).toBeTruthy();
    expect(getLoggedStoreOptions(childStore!)).toEqual(
      expect.objectContaining({
        enabled: true,
        shouldShowPrivateAtoms: false,
        transactionDebounceMs: 250,
        requestIdleCallbackTimeoutMs: 250,
        maxProcessingTimeMs: 16,
        synchronous: false,
      }),
    );
  });

  it('should keep the parent store unmodified', () => {
    const parentStore = createStore();
    const originalGet = parentStore.get;
    const originalSet = parentStore.set;
    const originalSub = parentStore.sub;

    render(
      <Provider store={parentStore}>
        <AtomLoggerProvider>
          <div />
        </AtomLoggerProvider>
      </Provider>,
    );

    expect(parentStore.get).toBe(originalGet);
    expect(parentStore.set).toBe(originalSet);
    expect(parentStore.sub).toBe(originalSub);
    expect(isLoggedStore(parentStore)).toBeFalsy();
  });
});

describe('createLoggedStore', () => {
  it('should throw when given a store without jotai internals', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fakeStore: Store = {
      get() {
        throw new Error('Function not implemented.');
      },
      set() {
        throw new Error('Function not implemented.');
      },
      sub() {
        throw new Error('Function not implemented.');
      },
    };
    expect(() => createLoggedStore(fakeStore)).toThrow(
      'Store must be created by buildStore to read its building blocks',
    );
    consoleErrorSpy.mockRestore();
  });

  it('should return a new store with different get/set/sub methods', () => {
    const parentStore = createStore();
    const loggedStore = createLoggedStore(parentStore);

    expect(loggedStore.get).not.toBe(parentStore.get);
    expect(loggedStore.set).not.toBe(parentStore.set);
    expect(loggedStore.sub).not.toBe(parentStore.sub);
  });

  it('should leave the parent store unmodified', () => {
    const parentStore = createStore();
    const originalGet = parentStore.get;
    const originalSet = parentStore.set;
    const originalSub = parentStore.sub;

    createLoggedStore(parentStore);

    expect(parentStore.get).toBe(originalGet);
    expect(parentStore.set).toBe(originalSet);
    expect(parentStore.sub).toBe(originalSub);
    expect(isLoggedStore(parentStore)).toBeFalsy();
  });
});
