import { describe, it, expect, vi, beforeEach } from 'vitest';

import { Effect, pure, withDB, withLogger } from '../index';
import type { DependencyMap } from '../types';

describe('Effect 클래스', () => {
  let mockDependencies: DependencyMap;

  beforeEach(() => {
    mockDependencies = {
      db: {
        user: {
          findUnique: vi.fn(),
          create: vi.fn(),
          count: vi.fn(),
        },
        $connect: vi.fn(),
        $disconnect: vi.fn(),
      } as any,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
      cache: {
        get: vi.fn(),
        set: vi.fn(),
        del: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      } as any,
      http: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
      },
    };
  });

  describe('정적 메서드', () => {
    describe('pure', () => {
      it('순수 값을 Effect로 감싸야 함', async () => {
        const effect = Effect.pure(42);
        const result = await effect.run(mockDependencies);
        expect(result).toBe(42);
      });

      it('객체도 순수하게 감싸야 함', async () => {
        const testObject = { name: 'test', value: 123 };
        const effect = Effect.pure(testObject);
        const result = await effect.run(mockDependencies);
        expect(result).toEqual(testObject);
      });
    });

    describe('fromPromise', () => {
      it('Promise를 Effect로 변환해야 함', async () => {
        const promiseFn = async () => 'hello world';
        const effect = Effect.fromPromise(promiseFn);
        const result = await effect.run(mockDependencies);
        expect(result).toBe('hello world');
      });

      it('Promise 에러를 전파해야 함', async () => {
        const promiseFn = async () => {
          throw new Error('Promise 에러');
        };
        const effect = Effect.fromPromise(promiseFn);

        await expect(effect.run(mockDependencies)).rejects.toThrow('Promise 에러');
      });
    });

    describe('withSingleDep', () => {
      it('단일 의존성을 사용하는 Effect를 생성해야 함', async () => {
        const mockUser = { id: '1', name: 'Test User' };
        (mockDependencies.db.user.findUnique as any).mockResolvedValue(mockUser);

        const effect = Effect.withSingleDep('db', async db => {
          return await db.user.findUnique({ where: { id: '1' } });
        });

        const result = await effect.run(mockDependencies);
        expect(result).toEqual(mockUser);
        expect(mockDependencies.db.user.findUnique).toHaveBeenCalledWith({ where: { id: '1' } });
      });
    });

    describe('withDeps', () => {
      it('전체 의존성 맵을 사용하는 Effect를 생성해야 함', async () => {
        const effect = Effect.withDeps(async deps => {
          deps.logger.info('테스트 로그');
          return 'dependencies used';
        });

        const result = await effect.run(mockDependencies);
        expect(result).toBe('dependencies used');
        expect(mockDependencies.logger.info).toHaveBeenCalledWith('테스트 로그');
      });
    });

    describe('all (병렬 실행)', () => {
      it('여러 Effect를 병렬로 실행해야 함', async () => {
        const effect1 = Effect.pure(1);
        const effect2 = Effect.pure(2);
        const effect3 = Effect.pure(3);

        const combinedEffect = Effect.all([effect1, effect2, effect3]);
        const result = await combinedEffect.run(mockDependencies);

        expect(result).toEqual([1, 2, 3]);
      });

      it('병렬 실행에서 하나라도 실패하면 전체가 실패해야 함', async () => {
        const effect1 = Effect.pure(1);
        const effect2 = Effect.fromPromise(async () => {
          throw new Error('Effect2 실패');
        });
        const effect3 = Effect.pure(3);

        const combinedEffect = Effect.all([effect1, effect2, effect3]);

        await expect(combinedEffect.run(mockDependencies)).rejects.toThrow('Effect2 실패');
      });
    });

    describe('race (경쟁 실행)', () => {
      it('가장 빠른 Effect의 결과를 반환해야 함', async () => {
        const fastEffect = Effect.fromPromise(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'fast';
        });

        const slowEffect = Effect.fromPromise(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return 'slow';
        });

        const raceEffect = Effect.race([fastEffect, slowEffect]);
        const result = await raceEffect.run(mockDependencies);

        expect(result).toBe('fast');
      });
    });

    describe('sequence (순차 실행)', () => {
      it('여러 Effect를 순차적으로 실행해야 함', async () => {
        const executionOrder: number[] = [];

        const effect1 = Effect.fromPromise(async () => {
          executionOrder.push(1);
          return 'first';
        });

        const effect2 = Effect.fromPromise(async () => {
          executionOrder.push(2);
          return 'second';
        });

        const effect3 = Effect.fromPromise(async () => {
          executionOrder.push(3);
          return 'third';
        });

        const sequenceEffect = Effect.sequence([effect1, effect2, effect3]);
        const result = await sequenceEffect.run(mockDependencies);

        expect(result).toEqual(['first', 'second', 'third']);
        expect(executionOrder).toEqual([1, 2, 3]);
      });

      it('순차 실행에서 실패 시 이후 Effect는 실행되지 않아야 함', async () => {
        const executionOrder: number[] = [];

        const effect1 = Effect.fromPromise(async () => {
          executionOrder.push(1);
          return 'first';
        });

        const effect2 = Effect.fromPromise(async () => {
          executionOrder.push(2);
          throw new Error('두 번째에서 실패');
        });

        const effect3 = Effect.fromPromise(async () => {
          executionOrder.push(3);
          return 'third';
        });

        const sequenceEffect = Effect.sequence([effect1, effect2, effect3]);

        await expect(sequenceEffect.run(mockDependencies)).rejects.toThrow('두 번째에서 실패');
        expect(executionOrder).toEqual([1, 2]); // 3은 실행되지 않음
      });
    });
  });

  describe('인스턴스 메서드', () => {
    describe('transform (Functor)', () => {
      it('Effect의 결과를 변환해야 함', async () => {
        const effect = Effect.pure(10)
          .transform(x => x * 2)
          .transform(x => x.toString());

        const result = await effect.run(mockDependencies);
        expect(result).toBe('20');
      });

      it('변환 함수에서 에러가 발생하면 전파해야 함', async () => {
        const effect = Effect.pure(10).transform(() => {
          throw new Error('변환 에러');
        });

        await expect(effect.run(mockDependencies)).rejects.toThrow('변환 에러');
      });
    });

    describe('chain (Monad)', () => {
      it('Effect를 체이닝해야 함', async () => {
        const mockUser = { id: '1', name: 'Test User' };
        (mockDependencies.db.user.findUnique as any).mockResolvedValue(mockUser);

        const effect = pure('1')
          .chain(id => withDB(db => db.user.findUnique({ where: { id } })))
          .chain(user =>
            withLogger(logger => {
              logger.info(`사용자 조회: ${user?.name}`);
              return user;
            }),
          );

        const result = await effect.run(mockDependencies);
        expect(result).toEqual(mockUser);
        expect(mockDependencies.db.user.findUnique).toHaveBeenCalledWith({ where: { id: '1' } });
        expect(mockDependencies.logger.info).toHaveBeenCalledWith('사용자 조회: Test User');
      });

      it('체인 중간에 에러가 발생하면 전체가 실패해야 함', async () => {
        const effect = pure(10)
          .chain(x => pure(x * 2))
          .chain(() => {
            throw new Error('체인 에러');
          });

        await expect(effect.run(mockDependencies)).rejects.toThrow('체인 에러');
      });
    });

    describe('run', () => {
      it('모든 의존성이 제공되어야 실행되어야 함', async () => {
        const effect = Effect.withDeps(async deps => {
          deps.logger.info('의존성 확인');
          return 'success';
        });

        const result = await effect.run(mockDependencies);
        expect(result).toBe('success');
        expect(mockDependencies.logger.info).toHaveBeenCalledWith('의존성 확인');
      });
    });
  });
});
