import type { DependencyKey, DependencyMap, EffectResults, IEffect } from './types';

export class Effect<T> implements IEffect<T> {
  private readonly _internalRun: (dependencies: DependencyMap) => Promise<T>;

  private constructor(runFn: (dependencies: DependencyMap) => Promise<T>) {
    this._internalRun = runFn;
  }

  public static pure<TResult>(value: TResult): Effect<TResult> {
    return new Effect(async () => value);
  }

  public static fromPromise<TResult>(promiseFn: () => Promise<TResult>): Effect<TResult> {
    return new Effect(async () => promiseFn());
  }

  public static withSingleDep<
    TDepKey extends DependencyKey,
    TResult,
    TDepType = DependencyMap[TDepKey],
  >(depKey: TDepKey, fn: (dep: TDepType) => Promise<TResult>): Effect<TResult> {
    return new Effect(async (dependencies: DependencyMap) => fn(dependencies[depKey] as TDepType));
  }

  public static withDeps<TResult>(fn: (deps: DependencyMap) => Promise<TResult>): Effect<TResult> {
    return new Effect(fn);
  }

  public static all<const Effects extends ReadonlyArray<IEffect<unknown>>>(
    effects: Effects,
  ): Effect<EffectResults<Effects>> {
    type _Results = EffectResults<Effects>;

    return new Effect(async (dependencies: DependencyMap): Promise<_Results> => {
      const promises = effects.map(eff => {
        return eff.run(dependencies);
      });

      const results = await Promise.all(promises);
      return results as _Results;
    });
  }

  public static race<const Effects extends ReadonlyArray<IEffect<unknown>>>(
    effects: Effects,
  ): Effect<EffectResults<Effects>[number]> {
    type _Result = EffectResults<Effects>[number];

    return new Effect(async (dependencies: DependencyMap): Promise<_Result> => {
      const promises = effects.map(eff => {
        return eff.run(dependencies);
      });

      const result = await Promise.race(promises);
      return result as _Result;
    });
  }

  public static sequence<const Effects extends ReadonlyArray<IEffect<unknown>>>(
    effects: Effects,
  ): Effect<EffectResults<Effects>> {
    type Results = EffectResults<Effects>;

    return new Effect(async (dependencies: DependencyMap): Promise<Results> => {
      const resultsArray: unknown[] = [];
      for (const eff of effects) {
        const result = await eff.run(dependencies);
        resultsArray.push(result);
      }
      return resultsArray as Results;
    });
  }

  public transform<TResult>(fn: (value: T) => TResult): Effect<TResult> {
    return new Effect(async dependencies => {
      const prevResult = await this._internalRun(dependencies);
      return fn(prevResult);
    });
  }

  public chain<TResult>(fn: (value: T) => Effect<TResult>): Effect<TResult> {
    return new Effect(async (dependencies: DependencyMap): Promise<TResult> => {
      const prevResult = await this._internalRun(dependencies);
      const nextEffectInstance = fn(prevResult);
      return nextEffectInstance.run(dependencies);
    });
  }

  public run<TDeps extends DependencyMap = DependencyMap>(dependencies: TDeps): Promise<T> {
    return this._internalRun(dependencies);
  }
}
