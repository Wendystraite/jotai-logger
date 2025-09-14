// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { createStore, getDefaultStore } from 'jotai';
import { useEffect, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { isAtomsLoggerBoundToStore } from '../src/bind-atoms-logger-to-store.js';
import * as bindAtomsLoggerToStoreModule from '../src/bind-atoms-logger-to-store.js';
import { ATOMS_LOGGER_SYMBOL } from '../src/consts/atom-logger-symbol.js';
import { bindAtomsLoggerToStore, useAtomsLogger } from '../src/index.js';
import {
  type AtomsLoggerOptions,
  type AtomsLoggerOptionsInState,
  type Store,
  type StoreWithAtomsLogger,
} from '../src/types/atoms-logger.js';

describe('useAtomsLogger', () => {
  it('should bind logger to store', () => {
    const store = createStore();
    expect(isAtomsLoggerBoundToStore(store)).toBeFalsy();
    renderHook(() => {
      useAtomsLogger({ store });
    });
    expect(isAtomsLoggerBoundToStore(store)).toBeTruthy();
  });

  it('should bind logger to default store if store is not provided', () => {
    expect(isAtomsLoggerBoundToStore(getDefaultStore())).toBeFalsy();
    renderHook(() => {
      useAtomsLogger();
    });
    expect(isAtomsLoggerBoundToStore(getDefaultStore())).toBeTruthy();
  });

  it('should not bind logger to store when disabled', () => {
    const store = createStore();
    expect(isAtomsLoggerBoundToStore(store)).toBeFalsy();
    renderHook(() => {
      useAtomsLogger({ store, enabled: false });
    });
    expect(isAtomsLoggerBoundToStore(store)).toBeFalsy();
  });

  it('should not bind logger to store when already bound', () => {
    const store = createStore();
    bindAtomsLoggerToStore(store);

    const bindAtomsLoggerToStoreSpy = vi.spyOn(
      bindAtomsLoggerToStoreModule,
      'bindAtomsLoggerToStore',
    );

    expect(isAtomsLoggerBoundToStore(store)).toBeTruthy();
    expect(bindAtomsLoggerToStoreSpy).not.toHaveBeenCalled();
    renderHook(() => {
      useAtomsLogger({ store });
    });
    expect(isAtomsLoggerBoundToStore(store)).toBeTruthy();
    expect(bindAtomsLoggerToStoreSpy).not.toHaveBeenCalled();
  });

  it('should update logger options when they change', () => {
    const store = createStore();
    renderHook(() => {
      const [options, setOptions] = useState<AtomsLoggerOptions>({
        groupTransactions: false,
        groupEvents: false,
        shouldShowPrivateAtoms: false,
        stringifyLimit: 50,
      });
      useAtomsLogger({ store, ...options });
      useEffect(() => {
        setOptions({
          groupTransactions: true,
          groupEvents: true,
          shouldShowPrivateAtoms: true,
          stringifyLimit: 100,
        });
      }, []);
    });
    expect(isAtomsLoggerBoundToStore(store)).toBeTruthy();
    expect((store as StoreWithAtomsLogger)[ATOMS_LOGGER_SYMBOL]).toEqual(
      expect.objectContaining({
        groupTransactions: true,
        groupEvents: true,
        shouldShowPrivateAtoms: true,
        stringifyLimit: 100,
      }),
    );
  });

  it('should disable previous store logger when store changes', () => {
    // const store = createStore();
    const stores: Store[] = [];
    renderHook(() => {
      const [store, setStore] = useState<Store>(() => createStore());
      stores.push(store);
      useAtomsLogger({ store });
      useEffect(() => {
        setStore(createStore());
      }, []);
    });

    expect(stores).toHaveLength(2);
    expect(stores[0]).not.toBe(stores[1]);
    expect(isAtomsLoggerBoundToStore(stores[0]!)).toBeTruthy();
    expect(isAtomsLoggerBoundToStore(stores[1]!)).toBeTruthy();

    expect((stores[0] as StoreWithAtomsLogger)[ATOMS_LOGGER_SYMBOL].enabled).toBe(false);
    expect((stores[1] as StoreWithAtomsLogger)[ATOMS_LOGGER_SYMBOL].enabled).toBe(true);
  });

  it('should use default options when none provided', () => {
    const store = createStore();
    renderHook(() => {
      useAtomsLogger({ store });
    });
    const expectedDefaultOptions: AtomsLoggerOptionsInState = {
      enabled: true,
      domain: undefined,
      shouldShowPrivateAtoms: false,
      shouldShowAtom: undefined,
      logger: console,
      groupTransactions: true,
      groupEvents: false,
      indentSpaces: 0,
      indentSpacesDepth1: '',
      indentSpacesDepth2: '',
      formattedOutput: true,
      colorScheme: 'default',
      stringifyLimit: 50,
      stringifyValues: true,
      stringify: undefined,
      showTransactionNumber: true,
      showTransactionEventsCount: true,
      showTransactionLocaleTime: false,
      showTransactionElapsedTime: true,
      collapseTransactions: false,
      collapseEvents: false,
      ownerStackLimit: 2,
      transactionDebounceMs: 250,
      requestIdleCallbackTimeoutMs: 250,
      maxProcessingTimeMs: 16,
    };
    expect(isAtomsLoggerBoundToStore(store)).toBeTruthy();
    expect((store as StoreWithAtomsLogger)[ATOMS_LOGGER_SYMBOL]).toEqual(
      expect.objectContaining(expectedDefaultOptions),
    );
  });
});
