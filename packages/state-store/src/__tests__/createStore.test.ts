import { describe, it, expect, vi } from 'vitest';
import { createStore, getSingletonStore } from '../index';

interface CounterState {
  count: number;
  name: string;
}

describe('createStore', () => {
  it('should create a basic store', () => {
    const store = createStore<CounterState>()
      .initialState({ count: 0, name: 'counter' })
      .build();

    expect(store.getState()).toEqual({ count: 0, name: 'counter' });
    expect(store.count).toBe(0);
    expect(store.name).toBe('counter');
  });

  it('should handle computed properties', () => {
    const store = createStore<CounterState>()
      .initialState({ count: 5, name: 'test' })
      .computed({
        doubled: (state) => state.count * 2,
        isEven: (state) => state.count % 2 === 0,
        displayName: (state) => `Counter: ${state.name}`,
      })
      .build();

    expect(store.computed.doubled).toBe(10);
    expect(store.computed.isEven).toBe(false);
    expect(store.computed.displayName).toBe('Counter: test');
  });

  it('should handle subscriptions', () => {
    const store = createStore<CounterState>()
      .initialState({ count: 0, name: 'test' })
      .build();

    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store._setState({ count: 1 });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store._setState({ count: 2 });
    expect(listener).toHaveBeenCalledTimes(1); // Should not be called after unsubscribe
  });

  it('should handle selective subscriptions', () => {
    const store = createStore<CounterState>()
      .initialState({ count: 0, name: 'test' })
      .build();

    const countListener = vi.fn();
    const nameListener = vi.fn();

    store.subscribeState(
      (state) => state.count,
      countListener
    );

    store.subscribeState(
      (state) => state.name,
      nameListener
    );

    // Change count - only count listener should be called
    store._setState({ count: 1 });
    expect(countListener).toHaveBeenCalledWith(1, 0);
    expect(nameListener).not.toHaveBeenCalled();

    // Change name - only name listener should be called
    countListener.mockClear();
    store._setState({ name: 'updated' });
    expect(nameListener).toHaveBeenCalledWith('updated', 'test');
    expect(countListener).not.toHaveBeenCalled();
  });
});

describe('getSingletonStore', () => {
  it('should return the same instance for the same key', () => {
    const createCounter = () => createStore<CounterState>()
      .initialState({ count: 0, name: 'singleton' })
      .build();

    const store1 = getSingletonStore('test-counter', createCounter);
    const store2 = getSingletonStore('test-counter', createCounter);

    // In server environment, should be different instances
    // In client environment, should be the same instance
    if (typeof window === 'undefined') {
      expect(store1).not.toBe(store2);
    } else {
      expect(store1).toBe(store2);
    }
  });
});
