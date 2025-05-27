import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import { DependencyMap, Logger, HttpClient } from './depsTypes';

// 간단한 콘솔 로거 구현
const consoleLogger: Logger = {
  info: (message: string, ...args: any[]) => console.log('[INFO]', message, ...args),
  warn: (message: string, ...args: any[]) => console.warn('[WARN]', message, ...args),
  error: (message: string, ...args: any[]) => console.error('[ERROR]', message, ...args),
  debug: (message: string, ...args: any[]) => console.debug('[DEBUG]', message, ...args),
};

// Fetch 기반 HTTP 클라이언트 구현
const fetchHttpClient: HttpClient = {
  async get<T = any>(url: string, config?: RequestInit): Promise<T> {
    const response = await fetch(url, { ...config, method: 'GET' });
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  },

  async post<T = any>(url: string, data?: any, config?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...config,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  },

  async put<T = any>(url: string, data?: any, config?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...config,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...config?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  },

  async delete<T = any>(url: string, config?: RequestInit): Promise<T> {
    const response = await fetch(url, { ...config, method: 'DELETE' });
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  },
};

// 의존성 인스턴스들을 생성하는 함수들
export async function createPrismaClient(): Promise<PrismaClient> {
  const prisma = new PrismaClient({
    log: ['error', 'warn'],
  });
  
  await prisma.$connect();
  return prisma;
}

export async function createRedisClient() {
  const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  });
  
  await client.connect();
  return client;
}

// 기본 의존성 맵
let defaultDependencies: DependencyMap | null = null;

export async function getDefaultDep(): Promise<DependencyMap> {
  if (!defaultDependencies) {
    const [db, cache] = await Promise.all([
      createPrismaClient(),
      createRedisClient(),
    ]);

    defaultDependencies = Object.freeze({
      db,
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
  const testDb = new PrismaClient({
    datasources: {
      db: {
        url: process.env.TEST_DATABASE_URL || 'file::memory:?cache=shared',
      },
    },
  });

  await testDb.$connect();

  // 테스트용 Redis는 실제 Redis 대신 메모리 맵 사용
  const testCache = createMockRedis();

  return {
    db: testDb,
    logger: consoleLogger,
    cache: testCache as any,
    http: fetchHttpClient,
  };
}

// 테스트용 모의 Redis 클라이언트
function createMockRedis() {
  const store = new Map<string, { value: string; expiry?: number }>();

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
    async set(key: string, value: string, options?: any): Promise<string> {
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
  };
}
