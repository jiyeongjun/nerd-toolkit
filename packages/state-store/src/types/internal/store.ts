import { ComputedDef, ActionsDef, AsyncActionsDef } from '../public-types';

export interface Store<TState, TComputed, TActions, TAsyncActions> {
  // State access
  getState(): TState;
  [K in keyof TState]: TState[K];
  
  // Computed properties
  computed: ComputedState<TState, TComputed>;
  
  // Actions
  actions: ActionsAPI<TActions>;
  dispatch: (action: any) => void;
  
  // Async actions
  asyncActions: AsyncActionsAPI<TAsyncActions>;
  asyncState: AsyncState<TAsyncActions>;
  
  // Subscriptions
  subscribe(listener: () => void): () => void;
  subscribeState<T>(
    selector: (state: TState) => T,
    listener: (newValue: T, oldValue: T) => void
  ): () => void;
}

export type StoreInternal<TState, TComputed, TActions, TAsyncActions> = 
  Store<TState, TComputed, TActions, TAsyncActions> & {
    _setState: (partial: Partial<TState>) => void;
  };

export type ComputedState<TState, TComputed> = {
  [K in keyof TComputed]: TComputed[K] extends (state: TState) => infer R ? R : never;
};

export type ActionsAPI<TActions> = {
  [K in keyof TActions]: TActions[K];
};

export type AsyncActionsAPI<TAsyncActions> = {
  [K in keyof TAsyncActions]: TAsyncActions[K];
};

export type AsyncState<TAsyncActions> = {
  [K in keyof TAsyncActions]: {
    pending: boolean;
    error: Error | null;
    loaded: boolean;
  };
};

export interface Middleware<TState> {
  (store: { getState: () => TState }): (next: (action: any) => any) => (action: any) => any;
}

export interface StoreConfig<TState, TComputed, TActions, TAsyncActions> {
  initialState: TState;
  computed?: TComputed;
  actions?: TActions;
  asyncActions?: TAsyncActions;
}
