import { describe, it, expect, vi, beforeEach } from 'vitest';

import { pure, fromPromise, withDB, withLogger, withCache, withHttp, withDeps } from '../index';
import type { DependencyMap } from '../types';

describe('Creator 함수들', () => {
  let mockDependencies: DependencyMap;

  beforeEach(() => {
    mockDependencies = {
      db: {
        user: {
          findUnique: vi.fn(),
          create: vi.fn(),
          findMany: vi.fn(),
        },
        post: {
          findMany: vi.fn(),
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
      } as any,
      http: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
      },
    };
  });

  describe('pure', () => {
    it('순수 값을 Effect로 감싸야 함', async () => {
      const effect = pure('hello');
      const result = await effect.run(mockDependencies);
      expect(result).toBe('hello');
    });
  });

  describe('fromPromise', () => {
    it('Promise 함수를 Effect로 변환해야 함', async () => {
      const promiseFn = async () => 'async result';
      const effect = fromPromise(promiseFn);
      const result = await effect.run(mockDependencies);
      expect(result).toBe('async result');
    });
  });

  describe('withDB', () => {
    it('데이터베이스 의존성을 사용해야 함', async () => {
      const mockUser = { id: '1', name: 'John Doe' };
      (mockDependencies.db.user.findUnique as any).mockResolvedValue(mockUser);

      const effect = withDB(async db => {
        return db.user.findUnique({ where: { id: '1' } });
      });

      const result = await effect.run(mockDependencies);
      expect(result).toEqual(mockUser);
      expect(mockDependencies.db.user.findUnique).toHaveBeenCalledWith({ where: { id: '1' } });
    });
  });

  describe('withLogger', () => {
    it('로거 의존성을 사용해야 함', async () => {
      const effect = withLogger(logger => {
        logger.info('테스트 메시지');
        return 'logged';
      });

      const result = await effect.run(mockDependencies);
      expect(result).toBe('logged');
      expect(mockDependencies.logger.info).toHaveBeenCalledWith('테스트 메시지');
    });

    it('비동기 로거 함수도 처리해야 함', async () => {
      const effect = withLogger(async logger => {
        logger.warn('비동기 경고');
        await new Promise(resolve => setTimeout(resolve, 1));
        return 'async logged';
      });

      const result = await effect.run(mockDependencies);
      expect(result).toBe('async logged');
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith('비동기 경고');
    });
  });

  describe('withCache', () => {
    it('캐시 의존성을 사용해야 함', async () => {
      (mockDependencies.cache.get as any).mockResolvedValue('cached_value');

      const effect = withCache(async cache => {
        return await cache.get('test_key');
      });

      const result = await effect.run(mockDependencies);
      expect(result).toBe('cached_value');
      expect(mockDependencies.cache.get).toHaveBeenCalledWith('test_key');
    });

    it('캐시 설정 기능도 테스트해야 함', async () => {
      (mockDependencies.cache.set as any).mockResolvedValue('OK');

      const effect = withCache(async cache => {
        return await cache.set('key', 'value');
      });

      const result = await effect.run(mockDependencies);
      expect(result).toBe('OK');
      expect(mockDependencies.cache.set).toHaveBeenCalledWith('key', 'value');
    });
  });

  describe('withHttp', () => {
    it('HTTP 클라이언트 의존성을 사용해야 함', async () => {
      const mockResponse = { data: 'api response' };
      (mockDependencies.http.get as any).mockResolvedValue(mockResponse);

      const effect = withHttp(async http => {
        return await http.get('https://api.example.com/data');
      });

      const result = await effect.run(mockDependencies);
      expect(result).toEqual(mockResponse);
      expect(mockDependencies.http.get).toHaveBeenCalledWith('https://api.example.com/data');
    });

    it('POST 요청도 처리해야 함', async () => {
      const mockResponse = { success: true };
      (mockDependencies.http.post as any).mockResolvedValue(mockResponse);

      const effect = withHttp(async http => {
        return await http.post('https://api.example.com/create', { name: 'test' });
      });

      const result = await effect.run(mockDependencies);
      expect(result).toEqual(mockResponse);
      expect(mockDependencies.http.post).toHaveBeenCalledWith('https://api.example.com/create', {
        name: 'test',
      });
    });
  });

  describe('withDeps', () => {
    it('전체 의존성 맵을 사용해야 함', async () => {
      const mockUser = { id: '1', name: 'John' };
      (mockDependencies.db.user.create as any).mockResolvedValue(mockUser);
      (mockDependencies.cache.set as any).mockResolvedValue('OK');

      const effect = withDeps(async deps => {
        const user = await deps.db.user.create({
          data: { name: 'John', email: 'john@example.com' },
        });
        await deps.cache.set(`user:${user.id}`, JSON.stringify(user));
        deps.logger.info(`사용자 생성: ${user.name}`);
        return user;
      });

      const result = await effect.run(mockDependencies);
      expect(result).toEqual(mockUser);
      expect(mockDependencies.db.user.create).toHaveBeenCalledWith({ data: { name: 'John' } });
      expect(mockDependencies.cache.set).toHaveBeenCalledWith('user:1', JSON.stringify(mockUser));
      expect(mockDependencies.logger.info).toHaveBeenCalledWith('사용자 생성: John');
    });
  });

  describe('복잡한 워크플로우', () => {
    it('여러 의존성을 체이닝하여 사용해야 함', async () => {
      const mockUser = { id: '1', name: 'Jane Doe' };
      (mockDependencies.db.user.findUnique as any).mockResolvedValue(mockUser);
      (mockDependencies.cache.get as any).mockResolvedValue(null);
      (mockDependencies.cache.set as any).mockResolvedValue('OK');

      const workflow = pure('1')
        .chain(userId => withDB(async db => await db.user.findUnique({ where: { id: userId } })))
        .chain(user =>
          withCache(async cache => {
            const cached = await cache.get(`user:${user?.id}`);
            if (!cached) {
              await cache.set(`user:${user?.id}`, JSON.stringify(user));
            }
            return user;
          }),
        )
        .chain(user =>
          withLogger(logger => {
            logger.info(`사용자 처리 완료: ${user?.name}`);
            return user;
          }),
        );

      const result = await workflow.run(mockDependencies);
      expect(result).toEqual(mockUser);
      expect(mockDependencies.db.user.findUnique).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(mockDependencies.cache.get).toHaveBeenCalledWith('user:1');
      expect(mockDependencies.cache.set).toHaveBeenCalledWith('user:1', JSON.stringify(mockUser));
      expect(mockDependencies.logger.info).toHaveBeenCalledWith('사용자 처리 완료: Jane Doe');
    });
  });
});
