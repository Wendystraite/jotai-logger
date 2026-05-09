import type { AnyAtom, AtomId, AtomEvent } from './event.js';

export const AtomTransactionTypes = {
  unknown: 1,
  storeGet: 2,
  storeSet: 3,
  storeSubscribe: 4,
  storeUnsubscribe: 5,
  promiseResolved: 6,
  promiseRejected: 7,
} as const;

export type AtomTransactionTypes = typeof AtomTransactionTypes;

export type AtomTransactionType = AtomTransactionTypes[keyof AtomTransactionTypes];

/**
 * Fields common to all transaction types.
 */
export interface AtomTransactionBase {
  /**
   * The atom that triggered the transaction.
   * - Is the atom object itself for most events.
   * - Is an {@link AtomId} string for `destroyed` events since the atom object has been garbage collected by the time the event is emitted.
   * - Is `undefined` for events related to private atoms or ignored atoms (with `shouldShowAtom` returning false) to avoid exposing them to the logger.
   */
  atom: AnyAtom | AtomId | undefined;
  /** Monotonically increasing counter identifying this transaction. */
  transactionNumber: number;
  /** React owner stack captured at the time the transaction started (experimental). */
  ownerStack?: string | null | undefined;
  /** Display name of the React component that triggered the transaction (experimental). */
  componentDisplayName?: string | undefined;
  /** Ordered list of events recorded during this transaction. */
  events: AtomEvent[];
  /** `performance.now()` timestamp when the transaction started. */
  startTimestamp: ReturnType<typeof performance.now>;
  /** `performance.now()` timestamp when the transaction ended. */
  endTimestamp: ReturnType<typeof performance.now>;
}

/** Transaction produced when the origin of the state change cannot be determined. */
export interface AtomTransactionUnknown extends AtomTransactionBase {
  type: AtomTransactionTypes['unknown'];
}

/** Transaction produced by a `store.get` call. */
export interface AtomTransactionStoreGet extends AtomTransactionBase {
  type: AtomTransactionTypes['storeGet'];
}

/** Transaction produced by a `store.set` call. */
export interface AtomTransactionStoreSet extends AtomTransactionBase {
  type: AtomTransactionTypes['storeSet'];
  /** Arguments passed to `store.set`. */
  args: unknown[];
  /** Return value of the atom's write function, if any. */
  result: unknown;
}

/** Transaction produced by a `store.sub` call (subscription started). */
export interface AtomTransactionStoreSubscribe extends AtomTransactionBase {
  type: AtomTransactionTypes['storeSubscribe'];
  /** The listener function registered with `store.sub`. */
  listener: () => void;
}

/** Transaction produced when a subscription created by `store.sub` is unsubscribed. */
export interface AtomTransactionStoreUnsubscribe extends AtomTransactionBase {
  type: AtomTransactionTypes['storeUnsubscribe'];
  /** The listener function that was unsubscribed. */
  listener: () => void;
}

/** Transaction produced when a pending promise atom resolves. */
export interface AtomTransactionPromiseResolved extends AtomTransactionBase {
  type: AtomTransactionTypes['promiseResolved'];
}

/** Transaction produced when a pending promise atom rejects. */
export interface AtomTransactionPromiseRejected extends AtomTransactionBase {
  type: AtomTransactionTypes['promiseRejected'];
}

/**
 * Map from transaction type number to its concrete transaction shape.
 * Used for discriminated union lookup.
 */
export interface AtomTransactionMap {
  [AtomTransactionTypes.unknown]: AtomTransactionUnknown;
  [AtomTransactionTypes.storeGet]: AtomTransactionStoreGet;
  [AtomTransactionTypes.storeSet]: AtomTransactionStoreSet;
  [AtomTransactionTypes.storeSubscribe]: AtomTransactionStoreSubscribe;
  [AtomTransactionTypes.storeUnsubscribe]: AtomTransactionStoreUnsubscribe;
  [AtomTransactionTypes.promiseResolved]: AtomTransactionPromiseResolved;
  [AtomTransactionTypes.promiseRejected]: AtomTransactionPromiseRejected;
}

/** Union of all concrete transaction types. */
export type AtomTransaction = AtomTransactionMap[keyof AtomTransactionMap];
