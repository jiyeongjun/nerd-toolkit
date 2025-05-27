import type { Database, Logger, CacheClient, HttpClient } from './deps-types';

/**
 * 의존성 키를 문자열 리터럴 타입으로 제한
 */
export type DependencyKey = 'db' | 'logger' | 'cache' | 'http';

/**
 * 의존성 맵 타입 - 실제 구현체와 매핑
 */
export interface DependencyMap {
  db: Database;
  logger: Logger;
  cache: CacheClient;
  http: HttpClient;
}

export type PartialDeps<K extends DependencyKey> = Pick<DependencyMap, K>;

/**
 * 실행 가능한 Effect의 핵심 명세. 데이터 속성만 포함합니다.
 * 체이닝 메소드는 Effect 클래스에 구현됩니다.
 */
export interface IEffect<T, D_KEYS extends DependencyKey = never> {
  readonly _D: D_KEYS; // 팬텀 타입으로 의존성 키 추적
  readonly run: (dependencies: PartialDeps<D_KEYS>) => Promise<T>;
}

// --- 유틸리티 타입 (Effect 배열용) ---

/** 여러 IEffect의 결과 타입을 튜플로 표현 */
export type EffectResults<Effects extends ReadonlyArray<IEffect<unknown, DependencyKey>>> = {
  [K in keyof Effects]: Effects[K] extends IEffect<infer T, any> ? T : never;
};

/** 여러 IEffect의 모든 의존성 키들의 유니온 타입 */
export type EffectDeps<Effects extends ReadonlyArray<IEffect<unknown, DependencyKey>>> =
  Effects[number] extends IEffect<unknown, infer D> ? D : never;
