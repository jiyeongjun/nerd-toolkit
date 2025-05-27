import { ComputedDef, ActionsDef, AsyncActionsDef } from '../../types/public-types';
import { StoreConfig, StoreInternal } from '../../types/internal/store';

export class StoreBuilder<TState extends Record<string, any>> {
  initialState(initialState: TState): StoreConfigBuilder<TState> {
    return new StoreConfigBuilder({ initialState });
  }
}

class StoreConfigBuilder<
  TState extends Record<string, any>,
  TComputed extends ComputedDef<TState> = {},
  TActions extends ActionsDef<TState> = {},
  TAsyncActions extends AsyncActionsDef<TState> = {}
> {
  constructor(
    private config: StoreConfig<TState, TComputed, TActions, TAsyncActions>
  ) {}

  computed<NewComputed extends ComputedDef<TState>>(
    computedDefs: NewComputed
  ): StoreConfigBuilder<TState, NewComputed, TActions, TAsyncActions> {
    return new StoreConfigBuilder({
      ...this.config,
      computed: computedDefs,
    });
  }

  actions<NewActions extends ActionsDef<TState>>(
    actionDefs: NewActions
  ): StoreConfigBuilder<TState, TComputed, NewActions, TAsyncActions> {
    return new StoreConfigBuilder({
      ...this.config,
      actions: actionDefs,
    });
  }

  asyncActions<NewAsyncActions extends AsyncActionsDef<TState>>(
    asyncActionDefs: NewAsyncActions
  ): StoreConfigBuilder<TState, TComputed, TActions, NewAsyncActions> {
    return new StoreConfigBuilder({
      ...this.config,
      asyncActions: asyncActionDefs,
    });
  }

  build(): StoreInternal<TState, TComputed, TActions, TAsyncActions> {
    return createStoreInternal(this.config);
  }
}

// 간단한 스토어 구현 (실제로는 더 복잡하지만 데모용)
function createStoreInternal<TState, TComputed, TActions, TAsyncActions>(
  config: StoreConfig<TState, TComputed, TActions, TAsyncActions>
): StoreInternal<TState, TComputed, TActions, TAsyncActions> {
  let state = config.initialState;
  const listeners = new Set<() => void>();

  const store = {
    getState: () => state,
    
    _setState: (partial: Partial<TState>) => {
      state = { ...state, ...partial };
      listeners.forEach(listener => listener());
    },

    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    subscribeState: <T>(
      selector: (state: TState) => T,
      listener: (newValue: T, oldValue: T) => void
    ) => {
      let lastValue = selector(state);
      const unsubscribe = store.subscribe(() => {
        const newValue = selector(state);
        if (newValue !== lastValue) {
          const oldValue = lastValue;
          lastValue = newValue;
          listener(newValue, oldValue);
        }
      });
      return unsubscribe;
    },

    computed: {} as any,
    actions: {} as any,
    asyncActions: {} as any,
    asyncState: {} as any,
    dispatch: () => {},
  } as StoreInternal<TState, TComputed, TActions, TAsyncActions>;

  // Add state properties
  Object.keys(config.initialState).forEach(key => {
    Object.defineProperty(store, key, {
      get: () => state[key as keyof TState],
      enumerable: true,
    });
  });

  return store;
}
