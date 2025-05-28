import { Effect } from './effect';
import type { DependencyMap } from './types';

export function pure<TResult>(value: TResult): Effect<TResult> {
  return Effect.pure(value);
}

export function fromPromise<TResult>(promiseFn: () => Promise<TResult>): Effect<TResult> {
  return Effect.fromPromise(promiseFn);
}

export function withDB<TResult>(
  fn: (db: DependencyMap['db']) => Promise<TResult>,
): Effect<TResult> {
  return Effect.withSingleDep<'db', TResult, DependencyMap['db']>('db', fn);
}

export function withLogger<TResult = void>(
  fn: (logger: DependencyMap['logger']) => Promise<TResult> | TResult,
): Effect<TResult> {
  return Effect.withSingleDep<'logger', TResult, DependencyMap['logger']>('logger', async logger =>
    fn(logger),
  );
}

export function withCache<TResult>(
  fn: (cache: DependencyMap['cache']) => Promise<TResult>,
): Effect<TResult> {
  return Effect.withSingleDep<'cache', TResult, DependencyMap['cache']>('cache', fn);
}

export function withHttp<TResult>(
  fn: (http: DependencyMap['http']) => Promise<TResult>,
): Effect<TResult> {
  return Effect.withSingleDep<'http', TResult, DependencyMap['http']>('http', fn);
}

export function withDeps<TResult>(
  fn: (deps: DependencyMap) => Promise<TResult>,
): Effect<TResult> {
  return Effect.withDeps(fn);
}
