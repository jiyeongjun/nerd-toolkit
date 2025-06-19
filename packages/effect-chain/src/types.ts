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

/**
 * 실행 가능한 Effect의 핵심 명세. 데이터 속성만 포함합니다.
 * 체이닝 메소드는 Effect 클래스에 구현됩니다.
 *
 * 모든 Effect는 완전한 의존성 맵을 요구합니다.
 */
export interface IEffect<T, TDeps extends DependencyMap = DependencyMap> {
  readonly run: (dependencies: TDeps) => Promise<T>;
}

// --- 유틸리티 타입 (Effect 배열용) ---

/** 여러 IEffect의 결과 타입을 튜플로 표현 */
export type EffectResults<Effects extends ReadonlyArray<IEffect<unknown>>> = {
  [K in keyof Effects]: Effects[K] extends IEffect<infer T> ? T : never;
};
