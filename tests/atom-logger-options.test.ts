import { createStore } from 'jotai/vanilla';
import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type AtomLoggerOptions, createLoggedStore } from '../src/index.js';

let mockDate: MockInstance;

beforeEach(() => {
  vi.useFakeTimers({ now: 0 });
  vi.stubEnv('TZ', 'UTC');
  mockDate = vi
    .spyOn(Date.prototype, 'toLocaleTimeString')
    .mockImplementation(function toLocaleTimeStringMock(this: Date) {
      return this.toISOString().split('T')[1]!.split('.')[0]!; // 14:39:27
    });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  mockDate.mockRestore();
});

describe('options', () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should respect custom options', () => {
    const options: AtomLoggerOptions = {
      enabled: false,
      shouldShowPrivateAtoms: true,
    };

    store = createLoggedStore(store, options);

    // Only core options are stored in logger state
    expect(options.enabled).toBe(false);
    expect(options.shouldShowPrivateAtoms).toBe(true);
  });
});
