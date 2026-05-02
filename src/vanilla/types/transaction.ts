import type { AnyAtom, AtomId, AtomsLoggerEvent } from './event.js';

export const AtomsLoggerTransactionTypes = {
  unknown: 1,
  storeGet: 2,
  storeSet: 3,
  storeSubscribe: 4,
  storeUnsubscribe: 5,
  promiseResolved: 6,
  promiseRejected: 7,
} as const;

export type AtomsLoggerTransactionTypes = typeof AtomsLoggerTransactionTypes;

export type AtomsLoggerTransactionType =
  AtomsLoggerTransactionTypes[keyof AtomsLoggerTransactionTypes];

/**
 * Fields common to all transaction types.
 */
export interface AtomsLoggerTransactionBase {
  /** The atom that triggered the transaction, if any. */
  atom: AnyAtom | AtomId | undefined;
  /** Monotonically increasing counter identifying this transaction. */
  transactionNumber: number;
  /** React owner stack captured at the time the transaction started (experimental). */
  ownerStack?: string | null | undefined;
  /** Display name of the React component that triggered the transaction (experimental). */
  componentDisplayName?: string | undefined;
  /** Ordered list of events recorded during this transaction. */
  events: (AtomsLoggerEvent | undefined)[];
  /** Number of events in this transaction. */
  eventsCount: number;
  /** `performance.now()` timestamp when the transaction started. */
  startTimestamp: ReturnType<typeof performance.now>;
  /** `performance.now()` timestamp when the transaction ended. */
  endTimestamp: ReturnType<typeof performance.now>;
}

/** Transaction produced when the origin of the state change cannot be determined. */
export interface AtomsLoggerTransactionUnknown extends AtomsLoggerTransactionBase {
  type: AtomsLoggerTransactionTypes['unknown'];
}

/** Transaction produced by a `store.get` call. */
export interface AtomsLoggerTransactionStoreGet extends AtomsLoggerTransactionBase {
  type: AtomsLoggerTransactionTypes['storeGet'];
}

/** Transaction produced by a `store.set` call. */
export interface AtomsLoggerTransactionStoreSet extends AtomsLoggerTransactionBase {
  type: AtomsLoggerTransactionTypes['storeSet'];
  /** Arguments passed to `store.set`. */
  args: unknown[];
  /** Return value of the atom's write function, if any. */
  result: unknown;
}

/** Transaction produced by a `store.sub` call (subscription started). */
export interface AtomsLoggerTransactionStoreSubscribe extends AtomsLoggerTransactionBase {
  type: AtomsLoggerTransactionTypes['storeSubscribe'];
  /** The listener function registered with `store.sub`. */
  listener: () => void;
}

/** Transaction produced when a subscription created by `store.sub` is unsubscribed. */
export interface AtomsLoggerTransactionStoreUnsubscribe extends AtomsLoggerTransactionBase {
  type: AtomsLoggerTransactionTypes['storeUnsubscribe'];
  /** The listener function that was unsubscribed. */
  listener: () => void;
}

/** Transaction produced when a pending promise atom resolves. */
export interface AtomsLoggerTransactionPromiseResolved extends AtomsLoggerTransactionBase {
  type: AtomsLoggerTransactionTypes['promiseResolved'];
}

/** Transaction produced when a pending promise atom rejects. */
export interface AtomsLoggerTransactionPromiseRejected extends AtomsLoggerTransactionBase {
  type: AtomsLoggerTransactionTypes['promiseRejected'];
}

/**
 * Map from transaction type number to its concrete transaction shape.
 * Used for discriminated union lookup.
 */
export interface AtomsLoggerTransactionMap {
  [AtomsLoggerTransactionTypes.unknown]: AtomsLoggerTransactionUnknown;
  [AtomsLoggerTransactionTypes.storeGet]: AtomsLoggerTransactionStoreGet;
  [AtomsLoggerTransactionTypes.storeSet]: AtomsLoggerTransactionStoreSet;
  [AtomsLoggerTransactionTypes.storeSubscribe]: AtomsLoggerTransactionStoreSubscribe;
  [AtomsLoggerTransactionTypes.storeUnsubscribe]: AtomsLoggerTransactionStoreUnsubscribe;
  [AtomsLoggerTransactionTypes.promiseResolved]: AtomsLoggerTransactionPromiseResolved;
  [AtomsLoggerTransactionTypes.promiseRejected]: AtomsLoggerTransactionPromiseRejected;
}

/** Union of all concrete transaction types. */
export type AtomsLoggerTransaction = AtomsLoggerTransactionMap[keyof AtomsLoggerTransactionMap];
