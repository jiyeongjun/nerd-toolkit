import { describe, it, expect } from 'vitest';

import { Effect, pure, withDB, withLogger, withCache, withHttp } from '../index';
import type { DependencyMap } from '../types';

describe('통합 테스트', () => {
  const createMockDependencies = (): DependencyMap => ({
    db: {
      user: {
        create: async (data: any) => ({ id: '1', ...data.data }),
        findUnique: async ({ where }: any) =>
          where.id === '1' ? { id: '1', name: 'Test User', email: 'test@test.com' } : null,
        findMany: async () => [
          { id: '1', name: 'User 1' },
          { id: '2', name: 'User 2' },
        ],
      },
      post: {
        findMany: async () => [
          { id: '1', title: 'Post 1', userId: '1' },
          { id: '2', title: 'Post 2', userId: '2' },
        ],
      },
    } as any,
    logger: {
      info: (msg: string) => console.log(`[INFO] ${msg}`),
      warn: (msg: string) => console.warn(`[WARN] ${msg}`),
      error: (msg: string) => console.error(`[ERROR] ${msg}`),
      debug: (msg: string) => console.debug(`[DEBUG] ${msg}`),
    },
    cache: {
      data: new Map<string, { value: string; expiry?: number }>(),
      async get(key: string) {
        const item = this.data.get(key);
        if (!item) return null;
        if (item.expiry && Date.now() > item.expiry) {
          this.data.delete(key);
          return null;
        }
        return item.value;
      },
      async set(key: string, value: string, ttl?: number) {
        const expiry = ttl ? Date.now() + ttl * 1000 : undefined;
        this.data.set(key, { value, expiry });
        return 'OK';
      },
      async del(key: string | string[]) {
        const keys = Array.isArray(key) ? key : [key];
        let deleted = 0;
        for (const k of keys) {
          if (this.data.delete(k)) deleted++;
        }
        return deleted;
      },
    } as any,
    http: {
      async get<T>(url: string): Promise<T> {
        if (url.includes('/users/1')) {
          return { id: '1', name: 'External User' } as T;
        }
        return { data: 'mock response' } as T;
      },
      async post<T>(_: string, data?: unknown): Promise<T> {
        return { success: true, data } as T;
      },
      async put<T>(_: string, data?: unknown): Promise<T> {
        return { updated: true, data } as T;
      },
      async delete<T>(_: string): Promise<T> {
        return { deleted: true } as T;
      },
    },
  });

  describe('사용자 등록 워크플로우', () => {
    it('완전한 사용자 등록 프로세스가 작동해야 함', async () => {
      const deps = createMockDependencies();

      const registerUser = (userData: { name: string; email: string }) => {
        // 1. 사용자 생성
        const createUserEffect = withDB(async db => {
          return db.user.create({ data: userData });
        });

        // 2. 외부 프로필 정보 가져오기
        const fetchProfileEffect = (user: any) =>
          withHttp(async http => {
            const profile = await http.get(`/api/users/${user.id}`);
            return { ...user, profile };
          });

        // 3. 캐시에 저장
        const cacheUserEffect = (user: any) =>
          withCache(async cache => {
            await cache.set(`user:${user.id}`, JSON.stringify(user));
            return user;
          });

        // 4. 로깅
        const logEffect = (user: any) =>
          withLogger(logger => {
            logger.info(`사용자 등록 완료: ${user.name}`);
            return user;
          });

        return createUserEffect.chain(fetchProfileEffect).chain(cacheUserEffect).chain(logEffect);
      };

      const result = await registerUser({
        name: 'John Doe',
        email: 'john@example.com',
      }).run(deps);

      expect(result.name).toBe('John Doe');
      expect(result.email).toBe('john@example.com');
      expect(result.profile).toEqual({ id: '1', name: 'External User' });

      // 캐시에 저장되었는지 확인
      const cached = await deps.cache.get('user:1');
      expect(cached).toBeTruthy();
      expect(JSON.parse(cached!)).toEqual(result);
    });
  });

  describe('병렬 처리 워크플로우', () => {
    it('여러 데이터를 병렬로 가져와야 함', async () => {
      const deps = createMockDependencies();

      const fetchAllDataEffect = Effect.all([
        withDB(async db => db.user.findMany()),
        withDB(async db => db.post.findMany()),
        withHttp(async http => http.get('/api/stats')),
      ]);

      const [users, posts, stats] = await fetchAllDataEffect.run(deps);

      expect(users).toHaveLength(2);
      expect(posts).toHaveLength(2);
      expect(stats).toEqual({ data: 'mock response' });
    });

    it('경쟁 실행에서 가장 빠른 결과를 반환해야 함', async () => {
      const deps = createMockDependencies();

      const raceEffect = Effect.race([
        withCache(async cache => {
          // 빠른 캐시 작업
          await cache.set('fast', 'cached_result');
          return await cache.get('fast');
        }),
        withHttp(async http => {
          // 느린 HTTP 요청 시뮬레이션
          await new Promise(resolve => setTimeout(resolve, 100));
          return await http.get('/slow-api');
        }),
      ]);

      const result = await raceEffect.run(deps);
      expect(result).toBe('cached_result');
    });
  });

  describe('에러 처리', () => {
    it('체인 중간에 에러가 발생하면 전체가 실패해야 함', async () => {
      const deps = createMockDependencies();

      const failingWorkflow = pure('test')
        .chain(() =>
          withDB(async db => {
            // 성공하는 작업
            return db.user.findUnique({ where: { id: '1' } });
          }),
        )
        .chain(() => {
          // 실패하는 작업
          throw new Error('의도적인 실패');
        })
        .chain(() =>
          withLogger(logger => {
            // 이 부분은 실행되지 않아야 함
            logger.info('이 로그는 출력되지 않아야 함');
            return 'should not reach here';
          }),
        );

      await expect(failingWorkflow.run(deps)).rejects.toThrow('의도적인 실패');
    });
  });
});
