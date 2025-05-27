import type { DependencyKey, DependencyMap, EffectDeps, EffectResults, IEffect, PartialDeps } from './types';

export class Effect<T, D_CURRENT extends DependencyKey = never> implements IEffect<T, D_CURRENT> {
  public readonly _D: D_CURRENT = undefined as any; // 팬텀 타입
  private readonly _internalRun: (dependencies: PartialDeps<D_CURRENT>) => Promise<T>;

  private constructor(runFn: (dependencies: PartialDeps<D_CURRENT>) => Promise<T>) {
    this._internalRun = runFn;
  }

  public static pure<TResult>(value: TResult): Effect<TResult, never> {
    return new Effect(async () => value);
  }

  public static fromPromise<TResult>(promiseFn: () => Promise<TResult>): Effect<TResult, never> {
    return new Effect(async () => promiseFn());
  }

  public static withSingleDep<TDepKey extends DependencyKey, TResult, TDepType = DependencyMap[TDepKey]>(
    depKey: TDepKey,
    fn: (dep: TDepType) => Promise<TResult>,
  ): Effect<TResult, TDepKey> {
    return new Effect(async (dependencies: PartialDeps<TDepKey>) => 
      fn(dependencies[depKey] as TDepType)
    );
  }

  public static withDeps<TResult, TDeps extends DependencyKey>(
    fn: (deps: PartialDeps<TDeps>) => Promise<TResult>,
  ): Effect<TResult, TDeps> {
    return new Effect(fn);
  }

  public static all<const Effects extends ReadonlyArray<IEffect<unknown, DependencyKey>>>(
    effects: Effects,
  ): Effect<EffectResults<Effects>, EffectDeps<Effects>> {
    type Results = EffectResults<Effects>;
    type Deps = EffectDeps<Effects>;

    return new Effect(async (dependencies: PartialDeps<Deps>): Promise<Results> => {
      const promises = effects.map((eff) => {
        return eff.run(dependencies as PartialDeps<typeof eff._D>);
      });

      const results = await Promise.all(promises);
      return results as Results;
    });
  }
  public static race<const Effects extends ReadonlyArray<IEffect<unknown, DependencyKey>>>(
    effects: Effects,
  ): Effect<EffectResults<Effects>[number], EffectDeps<Effects>> {
    type Result = EffectResults<Effects>[number];
    type Deps = EffectDeps<Effects>;

    return new Effect(async (dependencies: PartialDeps<Deps>): Promise<Result> => {
      const promises = effects.map((eff) => {
        return eff.run(dependencies as PartialDeps<typeof eff._D>);
      });

      const result = await Promise.race(promises);
      return result as Result;
    });
  }

  public static sequence<const Effects extends ReadonlyArray<IEffect<unknown, DependencyKey>>>(
    effects: Effects,
  ): Effect<EffectResults<Effects>, EffectDeps<Effects>> {
    type Results = EffectResults<Effects>;
    type Deps = EffectDeps<Effects>;

    return new Effect(async (dependencies: PartialDeps<Deps>): Promise<Results> => {
      const resultsArray: unknown[] = [];
      for (const eff of effects) {
        const result = await eff.run(dependencies as PartialDeps<typeof eff._D>);
        resultsArray.push(result);
      }
      return resultsArray as Results;
    });
  }

  public transform<TResult>(fn: (value: T) => TResult): Effect<TResult, D_CURRENT> {
    return new Effect(async (dependencies) => {
      const prevResult = await this._internalRun(dependencies);
      return fn(prevResult);
    });
  }

  public chain<TResult, TDeps extends DependencyKey>(
    fn: (value: T) => Effect<TResult, TDeps>,
  ): Effect<TResult, D_CURRENT | TDeps> {
    type CombinedDeps = D_CURRENT | TDeps;

    return new Effect(async (dependencies: PartialDeps<CombinedDeps>): Promise<TResult> => {
      const prevResult = await this._internalRun(dependencies);
      const nextEffectInstance = fn(prevResult);
      return nextEffectInstance.run(dependencies);
    });
  }

  public run(explicitDependencies: PartialDeps<D_CURRENT>): Promise<T> {
    return this._internalRun(explicitDependencies);
  }
}
