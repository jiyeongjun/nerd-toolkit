import type { PrismaClient } from '@prisma/client';
import type { RedisClientType } from 'redis';

/**
 * 데이터베이스 클라이언트 (Prisma)
 */
export type Database = PrismaClient;

/**
 * 캐시 클라이언트 (Redis)
 */
export type CacheClient = RedisClientType;

/**
 * 로거 인터페이스
 * 다양한 로거 라이브러리와 호환 가능하도록 추상화
 */
export interface Logger {
  info(message: string, ...arguments_: unknown[]): void;
  warn(message: string, ...arguments_: unknown[]): void;
  error(message: string, ...arguments_: unknown[]): void;
  debug(message: string, ...arguments_: unknown[]): void;
}

/**
 * HTTP 클라이언트 (Fetch API 기반)
 */
export interface HttpClient {
  get<T = unknown>(url: string, config?: RequestInit): Promise<T>;
  post<T = unknown>(url: string, data?: unknown, config?: RequestInit): Promise<T>;
  put<T = unknown>(url: string, data?: unknown, config?: RequestInit): Promise<T>;
  delete<T = unknown>(url: string, config?: RequestInit): Promise<T>;
}
