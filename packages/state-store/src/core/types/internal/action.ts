import type { ActionsDef, AsyncActionsDef, AsyncResult, ComputedDef } from '../public-types';

import type { StoreInternal } from './store';

/**
 * 액션 메타데이터 타입
 */
export interface ActionMeta {
  originalActionType?: string;
  originalActionPayload?: NonNullable<unknown>[];

  [key: string]: unknown;
}

/**
 * 기본 액션 인터페이스
 * @template TPayload 액션 페이로드 타입
 */
export interface Action<TPayload = NonNullable<unknown>> {
  type: string;
  payload?: TPayload | undefined;
  meta?: ActionMeta | undefined;
}

/**
 * 액션 API 타입
 * @template TState 스토어 상태 타입
 * @template TActions 액션 정의 타입
 * @template TComputed 계산된 속성 정의 타입
 * @template TAsyncActions 비동기 액션 정의 타입
 */
export type ActionsApi<
  TState extends Record<string, NonNullable<unknown>>,
  TActions extends ActionsDef<TState>,
  TComputed extends ComputedDef<TState>,
  TAsyncActions extends AsyncActionsDef<TState> = NonNullable<unknown>,
> = {
  [K in keyof TActions]: (
    ...args: Parameters<TActions[K]>
    // eslint-disable-next-line no-use-before-define
  ) => StoreInternal<TState, TComputed, TActions, TAsyncActions>;
};

/**
 * 비동기 액션 API 타입
 * @template TState 스토어 상태 타입
 * @template TAsyncActions 비동기 액션 정의 타입
 */
export type AsyncActionsApi<
  TState extends Record<string, NonNullable<unknown>>,
  TAsyncActions extends AsyncActionsDef<TState>,
> = {
  [K in keyof TAsyncActions]: (
    ...args: Parameters<TAsyncActions[K]>
  ) => Promise<AsyncResult<Partial<TState>>>;
};
