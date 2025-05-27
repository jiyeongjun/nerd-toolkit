import type { PrismaClient } from '@prisma/client';
import type { RedisClientType } from 'redis';

import type { HttpClient, Logger } from './deps-types';
import type { DependencyMap } from './types';

// 간단한 콘솔 로거 구현
const consoleLogger: Logger = {
  info: (message: string, ...arguments_: unknown[]) => {
    // eslint-disable-next-line no-console
    console.log('[INFO]', message, ...arguments_);
  },
  warn: (message: string, ...arguments_: unknown[]) => {
    // eslint-disable-next-line no-console
    console.warn('[WARN]', message, ...arguments_);
  },
  error: (message: string, ...arguments_: unknown[]) => {
    // eslint-disable-next-line no-console
    console.error('[ERROR]', message, ...arguments_);
  },
  debug: (message: string, ...arguments_: unknown[]) => {
    // eslint-disable-next-line no-console
    console.debug('[DEBUG]', message, ...arguments_);
  },
};

// Fetch 기반 HTTP 클라이언트 구현
const fetchHttpClient: HttpClient = {
  async get<T = unknown>(url: string, config?: RequestInit): Promise<T> {
    const response = await fetch(url, { ...config, method: 'GET' });
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  },

  async post<T = unknown>(
    url: string,
    data?: unknown,
    config?: RequestInit,
  ): Promise<T> {
    const requestBody = data ? JSON.stringify(data) : null;
    const response = await fetch(url, {
      ...config,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ...config?.headers,
      },
      body: requestBody,
    });
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  },

  async put<T = unknown>(
    url: string,
    data?: unknown,
    config?: RequestInit,
  ): Promise<T> {
    const requestBody = data ? JSON.stringify(data) : null;
    const response = await fetch(url, {
      ...config,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ...config?.headers,
      },
      body: requestBody,
    });
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  },

  async delete<T = unknown>(url: string, config?: RequestInit): Promise<T> {
    const response = await fetch(url, { ...config, method: 'DELETE' });
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  },
};

// 의존성 인스턴스들을 생성하는 함수들
export async function createPrismaClient(): Promise<PrismaClient> {
  const { PrismaClient: PrismaClientClass } = await import('@prisma/client');
  const prisma = new PrismaClientClass({
    log: ['error', 'warn'],
  });

  await prisma.$connect();
  return prisma;
}

export async function createRedisClient(): Promise<RedisClientType> {
  const { createClient } = await import('redis');
  const client = createClient({
    url: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
  }) as RedisClientType;

  await client.connect();
  return client;
}

// 기본 의존성 맵
let defaultDependencies: DependencyMap | null = null;

export async function getDefaultDep(): Promise<DependencyMap> {
  if (!defaultDependencies) {
    const [database, cache] = await Promise.all([
      createPrismaClient(),
      createRedisClient(),
    ]);

    defaultDependencies = Object.freeze({
      db: database,
      logger: consoleLogger,
      cache,
      http: fetchHttpClient,
    });
  }

  return defaultDependencies;
}

// 테스트용 의존성 생성 함수
export async function createTestDep(): Promise<DependencyMap> {
  // 테스트용으로는 in-memory SQLite 사용
  const { PrismaClient: PrismaClientClass } = await import('@prisma/client');
  const testDatabase = new PrismaClientClass({
    datasources: {
      db: {
        url: process.env['TEST_DATABASE_URL'] ?? 'file::memory:?cache=shared',
      },
    },
  });

  await testDatabase.$connect();

  // 테스트용 Redis는 실제 Redis 대신 메모리 맵 사용
  const testCache = createMockRedis();

  return {
    db: testDatabase,
    logger: consoleLogger,
    cache: testCache as unknown as RedisClientType,
    http: fetchHttpClient,
  };
}

// 테스트용 모의 Redis 클라이언트의 타입 정의
interface MockRedisItem {
  value: string;
  expiry?: number | undefined;
}

interface MockRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: number): Promise<string>;
  del(key: string | string[]): Promise<number>;
  disconnect(): Promise<void>;
  quit(): Promise<void>;
}

// 테스트용 모의 Redis 클라이언트
function createMockRedis(): MockRedisClient {
  const store = new Map<string, MockRedisItem>();

  return {
    async get(key: string): Promise<string | null> {
      const item = store.get(key);
      if (!item) return null;
      if (item.expiry && Date.now() > item.expiry) {
        store.delete(key);
        return null;
      }
      return item.value;
    },
    async set(key: string, value: string, options?: number): Promise<string> {
      const expiry = options ? Date.now() + options * 1000 : undefined;
      store.set(key, { value, expiry });
      return 'OK';
    },
    async del(key: string | string[]): Promise<number> {
      const keys = Array.isArray(key) ? key : [key];
      let deleted = 0;
      for (const k of keys) {
        if (store.delete(k)) deleted++;
      }
      return deleted;
    },
    async disconnect(): Promise<void> {
      store.clear();
    },
    async quit(): Promise<void> {
      store.clear();
    },
  };
}
