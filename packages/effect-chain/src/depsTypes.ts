import { PrismaClient } from '@prisma/client';
import { RedisClientType } from 'redis';

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
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

/**
 * HTTP 클라이언트 (Fetch API 기반)
 */
export interface HttpClient {
  get<T = any>(url: string, config?: RequestInit): Promise<T>;
  post<T = any>(url: string, data?: any, config?: RequestInit): Promise<T>;
  put<T = any>(url: string, data?: any, config?: RequestInit): Promise<T>;
  delete<T = any>(url: string, config?: RequestInit): Promise<T>;
}
