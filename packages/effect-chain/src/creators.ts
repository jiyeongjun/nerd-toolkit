import { Effect } from './effect';
import type { DependencyMap, DependencyKey, PartialDeps } from './types';

export function pure<TResult>(value: TResult): Effect<TResult> {
  return Effect.pure(value);
}

export function fromPromise<TResult>(promiseFn: () => Promise<TResult>): Effect<TResult> {
  return Effect.fromPromise(promiseFn);
}

export function withDB<TResult>(
  fn: (db: DependencyMap['db']) => Promise<TResult>,
): Effect<TResult, 'db'> {
  return Effect.withSingleDep<'db', TResult, DependencyMap['db']>('db', fn);
}

export function withLogger<TResult = void>(
  fn: (logger: DependencyMap['logger']) => Promise<TResult> | TResult,
): Effect<TResult, 'logger'> {
  return Effect.withSingleDep<'logger', TResult, DependencyMap['logger']>('logger', async logger =>
    fn(logger),
  );
}

export function withCache<TResult>(
  fn: (cache: DependencyMap['cache']) => Promise<TResult>,
): Effect<TResult, 'cache'> {
  return Effect.withSingleDep<'cache', TResult, DependencyMap['cache']>('cache', fn);
}

export function withHttp<TResult>(
  fn: (http: DependencyMap['http']) => Promise<TResult>,
): Effect<TResult, 'http'> {
  return Effect.withSingleDep<'http', TResult, DependencyMap['http']>('http', fn);
}

export function withDeps<TResult, TDeps extends DependencyKey>(
  fn: (deps: PartialDeps<TDeps>) => Promise<TResult>,
): Effect<TResult, TDeps> {
  return Effect.withDeps(fn);
}
