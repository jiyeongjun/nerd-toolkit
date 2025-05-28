import { describe, it, expect, vi } from 'vitest';

import { createTestDep } from '../get-default-dep';

describe('의존성 생성 함수들', () => {
  describe('createTestDep', () => {
    it('테스트용 의존성 맵을 생성해야 함', async () => {
      const testDeps = await createTestDep();

      expect(testDeps).toHaveProperty('db');
      expect(testDeps).toHaveProperty('logger');
      expect(testDeps).toHaveProperty('cache');
      expect(testDeps).toHaveProperty('http');

      // 로거 테스트
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      testDeps.logger.info('테스트 로그');
      expect(logSpy).toHaveBeenCalledWith('[INFO]', '테스트 로그');
      logSpy.mockRestore();
    });

    it('모의 Redis 클라이언트가 작동해야 함', async () => {
      const testDeps = await createTestDep();

      // 캐시 설정
      const setResult = await (testDeps.cache as any).set('test_key', 'test_value');
      expect(setResult).toBe('OK');

      // 캐시 조회
      const getValue = await (testDeps.cache as any).get('test_key');
      expect(getValue).toBe('test_value');

      // 존재하지 않는 키
      const nullValue = await (testDeps.cache as any).get('nonexistent_key');
      expect(nullValue).toBeNull();
    });

    it('모의 Redis의 삭제 기능이 작동해야 함', async () => {
      const testDeps = await createTestDep();

      // 데이터 설정
      await (testDeps.cache as any).set('key1', 'value1');
      await (testDeps.cache as any).set('key2', 'value2');

      // 단일 키 삭제
      const deleteCount = await (testDeps.cache as any).del('key1');
      expect(deleteCount).toBe(1);

      // 삭제된 키 확인
      const deletedValue = await (testDeps.cache as any).get('key1');
      expect(deletedValue).toBeNull();

      // 여전히 존재하는 키 확인
      const remainingValue = await (testDeps.cache as any).get('key2');
      expect(remainingValue).toBe('value2');
    });
  });
});
