import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Effect, pure, fromPromise, withDB, withLogger, withCache, createTestDep } from '../index';
import type { DependencyMap } from '../types';

describe('Effect', () => {
  let deps: DependencyMap;

  beforeEach(async () => {
    deps = await createTestDep();
  });

  afterEach(async () => {
    await deps.db.$disconnect();
    // Redis cleanup is handled by mock
  });

  describe('pure', () => {
    it('should wrap a value in an Effect', async () => {
      const effect = pure(42);
      const result = await effect.run({});
      expect(result).toBe(42);
    });

    it('should work with complex objects', async () => {
      const data = { name: 'John', age: 30 };
      const effect = pure(data);
      const result = await effect.run({});
      expect(result).toEqual(data);
    });
  });

  describe('fromPromise', () => {
    it('should wrap a Promise in an Effect', async () => {
      const effect = fromPromise(() => Promise.resolve('hello'));
      const result = await effect.run({});
      expect(result).toBe('hello');
    });

    it('should handle Promise rejection', async () => {
      const effect = fromPromise(() => Promise.reject(new Error('test error')));
      await expect(effect.run({})).rejects.toThrow('test error');
    });
  });

  describe('transform', () => {
    it('should transform the value inside an Effect', async () => {
      const effect = pure(5).transform(x => x * 2);
      const result = await effect.run({});
      expect(result).toBe(10);
    });

    it('should chain multiple transformations', async () => {
      const effect = pure(2)
        .transform(x => x + 3)
        .transform(x => x * 2);
      const result = await effect.run({});
      expect(result).toBe(10); // (2 + 3) * 2
    });
  });

  describe('chain', () => {
    it('should chain Effects together', async () => {
      const effect = pure(5)
        .chain(x => pure(x * 2))
        .chain(x => pure(x + 1));
      
      const result = await effect.run({});
      expect(result).toBe(11); // (5 * 2) + 1
    });

    it('should combine dependencies from chained Effects', async () => {
      const effect = withLogger(logger => {
        logger.info('First effect');
        return 'logged';
      }).chain(() => 
        withCache(cache => cache.set('key', 'value'))
      );

      const result = await effect.run(deps);
      expect(result).toBe('OK');
    });
  });

  describe('withDB', () => {
    it('should provide database dependency', async () => {
      const effect = withDB(async (db) => {
        // Create a test user
        const user = await db.user.create({
          data: {
            email: 'test@example.com',
            name: 'Test User',
          },
        });
        return user;
      });

      const result = await effect.run(deps);
      expect(result.email).toBe('test@example.com');
      expect(result.name).toBe('Test User');
    });
  });

  describe('withLogger', () => {
    it('should provide logger dependency', async () => {
      const messages: string[] = [];
      const testLogger = {
        info: (msg: string) => messages.push(`INFO: ${msg}`),
        warn: (msg: string) => messages.push(`WARN: ${msg}`),
        error: (msg: string) => messages.push(`ERROR: ${msg}`),
        debug: (msg: string) => messages.push(`DEBUG: ${msg}`),
      };

      const effect = withLogger(logger => {
        logger.info('Test message');
        return 'logged';
      });

      const result = await effect.run({ logger: testLogger });
      expect(result).toBe('logged');
      expect(messages).toContain('INFO: Test message');
    });
  });

  describe('withCache', () => {
    it('should provide cache dependency', async () => {
      const effect = withCache(async (cache) => {
        await cache.set('test-key', 'test-value');
        return cache.get('test-key');
      });

      const result = await effect.run(deps);
      expect(result).toBe('test-value');
    });
  });

  describe('Effect.all', () => {
    it('should run multiple Effects in parallel', async () => {
      const effect1 = pure(1);
      const effect2 = pure(2);
      const effect3 = pure(3);

      const combined = Effect.all([effect1, effect2, effect3]);
      const result = await combined.run({});

      expect(result).toEqual([1, 2, 3]);
    });

    it('should combine dependencies from all Effects', async () => {
      const loggerEffect = withLogger(logger => {
        logger.info('Logger effect');
        return 'logged';
      });

      const cacheEffect = withCache(cache => {
        cache.set('key', 'value');
        return 'cached';
      });

      const combined = Effect.all([loggerEffect, cacheEffect]);
      const result = await combined.run(deps);

      expect(result).toEqual(['logged', 'cached']);
    });
  });

  describe('Effect.race', () => {
    it('should return the first completed Effect', async () => {
      const fast = pure('fast');
      const slow = fromPromise(() => 
        new Promise(resolve => setTimeout(() => resolve('slow'), 100))
      );

      const raced = Effect.race([fast, slow]);
      const result = await raced.run({});

      expect(result).toBe('fast');
    });
  });

  describe('Effect.sequence', () => {
    it('should run Effects sequentially', async () => {
      const effects = [
        pure(1),
        pure(2),
        pure(3),
      ];

      const sequenced = Effect.sequence(effects);
      const result = await sequenced.run({});

      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('complex example', () => {
    it('should handle a realistic user creation workflow', async () => {
      const createUser = (email: string, name: string) =>
        withDB(async (db) => {
          // Check if user exists
          const existing = await db.user.findUnique({ where: { email } });
          if (existing) {
            throw new Error('User already exists');
          }

          // Create user
          return db.user.create({
            data: { email, name },
          });
        })
        .chain(user =>
          withLogger(logger => {
            logger.info(`User created: ${user.email}`);
            return user;
          })
        )
        .chain(user =>
          withCache(async (cache) => {
            await cache.set(`user:${user.id}`, JSON.stringify(user));
            return user;
          })
        );

      const result = await createUser('jane@example.com', 'Jane Doe').run(deps);
      
      expect(result.email).toBe('jane@example.com');
      expect(result.name).toBe('Jane Doe');
      
      // Verify user was cached
      const cached = await deps.cache.get(`user:${result.id}`);
      expect(cached).toBeTruthy();
      expect(JSON.parse(cached!).email).toBe('jane@example.com');
    });
  });
});
