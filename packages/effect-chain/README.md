# @nerd-toolkit/effect-chain

타입 안전한 의존성 주입이 가능한 함수형 Effect 시스템

## 핵심 특징

- **타입 안전 의존성 주입**: 컴파일 타임에 의존성 검증
- **함수형 프로그래밍**: Effect 체이닝과 합성 지원
- **모나드 패턴**: Reader + IO 모나드의 결합으로 의존성 자동 전파
- **테스트 용이성**: 순수 함수와 의존성 주입으로 완벽한 격리 테스트
- **의존성 역전**: 로직이 구체적 구현을 알 필요 없음
- **비동기 처리**: Promise 기반 비동기 작업 지원
- **병렬/경쟁 실행**: Effect.all, Effect.race 지원
- **다양한 의존성**: DB(Prisma), 캐시(Redis), 로거, HTTP 클라이언트

## 테스트 용이성과 의존성 역전

### 전통적인 DI 프레임워크의 문제점

```typescript
// ❌ 전통적인 Service-Repository 패턴
class UserService {
  constructor(
    private userRepository: UserRepository,  // 구체적 구현을 알아야 함
    private emailService: EmailService,     // 강결합
    private logger: Logger
  ) {}

  async createUser(data: CreateUserDto) {
    // 비즈니스 로직이 구현체와 강결합
    const user = await this.userRepository.create(data);
    await this.emailService.sendWelcome(user.email);
    this.logger.info(`User created: ${user.id}`);
    return user;
  }
}

// 테스트 시 모든 의존성을 Mock해야 함
const mockRepository = jest.fn() as jest.Mocked<UserRepository>;
const mockEmailService = jest.fn() as jest.Mocked<EmailService>;
const mockLogger = jest.fn() as jest.Mocked<Logger>;
const service = new UserService(mockRepository, mockEmailService, mockLogger);
```

### Effect-chain의 해결책

```typescript
// ✅ Effect-chain: 순수 함수로 비즈니스 로직 분리
const createUserWorkflow = (userData: CreateUserDto) => {
  const validateUserEffect = pure(userData).transform(data => {
    if (!data.email || !data.name) {
      throw new Error('이메일과 이름은 필수입니다');
    }
    return data;
  });

  const saveUserEffect = (data: CreateUserDto) => withDB(async (db) => 
    await db.user.create({ data })
  );

  const sendWelcomeEmailEffect = (user: User) => withHttp(async (http) => 
    await http.post('/api/email/welcome', { email: user.email })
  );

  const logUserCreationEffect = (user: User) => withLogger((logger) => {
    logger.info(`사용자 생성됨: ${user.id}`);
    return user;
  });

  // 순수한 비즈니스 로직 조합
  return validateUserEffect
    .chain(saveUserEffect)
    .chain(sendWelcomeEmailEffect) 
    .chain(logUserCreationEffect);
};

// 로직 자체는 의존성을 몰라도 됨! 
// 실행 시점에서만 의존성 주입
```

### 완벽한 테스트 격리

```typescript
// 1. 순수 로직 테스트 (의존성 없음)
describe('사용자 검증 로직', () => {
  it('유효하지 않은 데이터를 거부해야 함', async () => {
    const invalidData = { email: '', name: '' };
    
    try {
      await pure(invalidData)
        .transform(data => {
          if (!data.email || !data.name) {
            throw new Error('이메일과 이름은 필수입니다');
          }
          return data;
        })
        .run({});
    } catch (error) {
      expect(error.message).toBe('이메일과 이름은 필수입니다');
    }
  });
});

// 2. 개별 Effect 테스트 (Mock 의존성)
describe('사용자 저장 Effect', () => {
  it('데이터베이스에 사용자를 저장해야 함', async () => {
    const mockDb = {
      user: {
        create: jest.fn().mockResolvedValue({ id: '123', email: 'test@test.com' })
      }
    };

    const saveEffect = withDB(async (db) => 
      await db.user.create({ data: { email: 'test@test.com' } })
    );

    const result = await saveEffect.run({ db: mockDb });
    
    expect(mockDb.user.create).toHaveBeenCalledWith({
      data: { email: 'test@test.com' }
    });
    expect(result).toEqual({ id: '123', email: 'test@test.com' });
  });
});

// 3. 전체 워크플로우 테스트 (통합 테스트)
describe('사용자 생성 워크플로우', () => {
  it('완전한 사용자 생성 플로우가 작동해야 함', async () => {
    const mockDependencies = {
      db: { user: { create: jest.fn().mockResolvedValue({ id: '123' }) }},
      http: { post: jest.fn().mockResolvedValue({ success: true }) },
      logger: { info: jest.fn() }
    };

    const workflow = createUserWorkflow({ 
      email: 'test@test.com', 
      name: 'Test User' 
    });

    const result = await workflow.run(mockDependencies);

    // 각 단계별 호출 검증
    expect(mockDependencies.db.user.create).toHaveBeenCalled();
    expect(mockDependencies.http.post).toHaveBeenCalledWith('/api/email/welcome', 
      { email: 'test@test.com' });
    expect(mockDependencies.logger.info).toHaveBeenCalledWith('사용자 생성됨: 123');
  });

  it('데이터베이스 오류 시 적절히 실패해야 함', async () => {
    const mockDependencies = {
      db: { user: { create: jest.fn().mockRejectedValue(new Error('DB 오류')) }},
      http: { post: jest.fn() },
      logger: { info: jest.fn() }
    };

    const workflow = createUserWorkflow({ 
      email: 'test@test.com', 
      name: 'Test User' 
    });

    await expect(workflow.run(mockDependencies))
      .rejects.toThrow('DB 오류');
    
    // 실패 후 후속 작업이 실행되지 않았는지 확인
    expect(mockDependencies.http.post).not.toHaveBeenCalled();
  });
});

// 4. 실제 의존성으로 E2E 테스트
describe('E2E 사용자 생성', () => {
  it('실제 의존성으로 전체 플로우 테스트', async () => {
    const realDependencies = {
      db: testPrismaClient,
      http: testHttpClient,
      logger: testLogger
    };

    const workflow = createUserWorkflow({ 
      email: 'e2e@test.com', 
      name: 'E2E User' 
    });

    const result = await workflow.run(realDependencies);
    expect(result.email).toBe('e2e@test.com');
  });
});
```

### 의존성 역전의 장점

```typescript
// 비즈니스 로직은 "무엇을 할지"만 정의
const businessLogic = (orderId: string) => 
  withDB(async (db) => db.order.findUnique({ where: { id: orderId } }))
    .chain(order => withCache(async (cache) => {
      if (!order) throw new Error('주문을 찾을 수 없습니다');
      await cache.set(`order:${orderId}`, JSON.stringify(order));
      return order;
    }))
    .chain(order => withLogger(logger => {
      logger.info(`주문 조회됨: ${order.id}`);
      return order;
    }));

// 프로덕션에서는 실제 구현체 주입
const prodResult = await businessLogic('order-123').run({
  db: prismaClient,
  cache: redisClient,
  logger: console
});

// 테스트에서는 Mock 주입
const testResult = await businessLogic('order-123').run({
  db: mockPrismaClient,
  cache: mockRedisClient,
  logger: mockLogger
});

// 개발 환경에서는 다른 구현체 주입 가능
const devResult = await businessLogic('order-123').run({
  db: devPrismaClient,
  cache: inMemoryCache,  // Redis 대신 메모리 캐시
  logger: consoleLogger
});
```

이렇게 **로직과 구현체가 완벽히 분리**되어 테스트하기 쉽고, 유연한 아키텍처를 만들 수 있습니다.

## 함수형 프로그래밍과 모나드

Effect-chain은 **Reader 모나드**와 **IO 모나드**를 결합한 패턴을 사용합니다.

### Reader 모나드 (의존성 주입)
```typescript
// 전통적인 Reader 모나드: (Environment) => Result
// Effect-chain: (Dependencies) => Promise<Result>

const getUserEffect = withDB(async (db) => {
  return await db.user.findUnique({ where: { id: 'user-123' } });
});
// Effect<User, 'db'> - DB 의존성을 요구하는 Effect
```

### 모나드 법칙 준수
```typescript
// 1. Left Identity: pure(x).chain(f) === f(x)
Effect.pure(42).chain(x => withLogger(logger => x * 2))
// === withLogger(logger => 42 * 2)

// 2. Right Identity: m.chain(pure) === m  
effect.chain(x => Effect.pure(x)) // === effect

// 3. Associativity: 결합법칙
effect.chain(f).chain(g) // === effect.chain(x => f(x).chain(g))
```

### 의존성 자동 전파
chain을 통해 의존성이 자동으로 전파되고 타입 시스템이 이를 추적합니다.

```typescript
const workflow = withDB(getUserById)           // Effect<User, 'db'>
  .chain(user => withLogger(logger => {        // Effect<User, 'db' | 'logger'>
    logger.info(`User: ${user.name}`);
    return user;
  }))
  .chain(user => withCache(cache =>            // Effect<User, 'db' | 'logger' | 'cache'>
    cache.set(`user:${user.id}`, user)
  ));

// 최종 타입: Effect<User, 'db' | 'logger' | 'cache'>
// 필요한 모든 의존성이 타입으로 추적됨
```

## 기본 사용법

```typescript
import { Effect, pure, fromPromise } from '@nerd-toolkit/effect-chain';

// 순수 값
const pureEffect = pure(42);

// 비동기 작업
const asyncEffect = fromPromise(async () => {
  const response = await fetch('/api/data');
  return response.json();
});

// 실행
const result = await pureEffect.run({});
const data = await asyncEffect.run({});
```

## 의존성 주입

```typescript
import { withDB, withLogger, withCache } from '@nerd-toolkit/effect-chain';

// 데이터베이스 사용
const getUserEffect = withDB(async (db) => {
  return await db.user.findUnique({
    where: { id: 'user-123' }
  });
});

// 로거 사용
const logEffect = withLogger((logger) => {
  logger.info('작업을 시작합니다');
  return '로깅 완료';
});

// 캐시 사용
const cacheEffect = withCache(async (cache) => {
  const cached = await cache.get('key');
  if (cached) return JSON.parse(cached);
  
  const data = { message: 'Hello World' };
  await cache.set('key', JSON.stringify(data), { EX: 3600 });
  return data;
});

// 의존성과 함께 실행
const dependencies = {
  db: prismaClient,
  logger: console,
  cache: redisClient
};

const user = await getUserEffect.run(dependencies);
const logResult = await logEffect.run(dependencies);
const cachedData = await cacheEffect.run(dependencies);
```

## Effect 체이닝과 모나드 합성

```typescript
import { withDB, withLogger } from '@nerd-toolkit/effect-chain';

// 사용자 생성 Effect
const createUserEffect = withDB(async (db) => {
  return await db.user.create({
    data: {
      email: 'user@example.com',
      name: 'John Doe'
    }
  });
});

// 로깅 Effect
const logUserCreatedEffect = withLogger((logger) => {
  logger.info('새 사용자가 생성되었습니다');
});

// 모나드 체이닝: 의존성이 자동으로 합성됨
const createAndLogEffect = createUserEffect
  .chain((user) => 
    withLogger((logger) => {
      logger.info(`사용자 생성됨: ${user.name} (${user.email})`);
      return user;
    })
  );
// 타입: Effect<User, 'db' | 'logger'>

// Functor 패턴 (transform/map)
const userEmailEffect = createUserEffect
  .transform(user => user.email); // User -> string
// 타입: Effect<string, 'db'>

// 실행: 모든 의존성을 한 번에 주입
const newUser = await createAndLogEffect.run({ 
  db: prismaClient, 
  logger: console 
});
```

## 복잡한 비즈니스 로직 예시

```typescript
import { Effect, withDB, withLogger, withCache, withHttp } from '@nerd-toolkit/effect-chain';

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

interface NotificationService {
  sendWelcomeEmail(user: User): Promise<void>;
}

// 사용자 등록 워크플로우
const registerUserWorkflow = (userData: { email: string; name: string }) => {
  // 1. 이메일 중복 확인
  const checkDuplicateEffect = withDB(async (db) => {
    const existing = await db.user.findUnique({
      where: { email: userData.email }
    });
    if (existing) {
      throw new Error('이미 사용 중인 이메일입니다');
    }
    return true;
  });

  // 2. 사용자 생성
  const createUserEffect = withDB(async (db) => {
    return await db.user.create({
      data: {
        email: userData.email,
        name: userData.name,
        createdAt: new Date()
      }
    });
  });

  // 3. 아바타 이미지 생성 (외부 API)
  const generateAvatarEffect = withHttp(async (http) => {
    const avatarUrl = await http.post<{ url: string }>('/api/avatar/generate', {
      name: userData.name
    });
    return avatarUrl.url;
  });

  // 4. 사용자 정보 캐시
  const cacheUserEffect = (user: User) => withCache(async (cache) => {
    await cache.set(`user:${user.id}`, JSON.stringify(user), { EX: 3600 });
    return user;
  });

  // 5. 환영 이메일 발송 (외부 서비스)
  const sendWelcomeEmailEffect = (user: User) => withHttp(async (http) => {
    await http.post('/api/notifications/welcome', {
      userId: user.id,
      email: user.email,
      name: user.name
    });
    return user;
  });

  // 6. 로깅
  const logUserRegistrationEffect = (user: User) => withLogger((logger) => {
    logger.info(`새 사용자 등록 완료: ${user.name} (${user.email})`);
    return user;
  });

  // 워크플로우 조합
  return checkDuplicateEffect
    .chain(() => createUserEffect)
    .chain((user) => 
      // 아바타 생성과 사용자 정보는 병렬 처리
      Effect.all([
        generateAvatarEffect,
        pure(user)
      ]).map(([avatarUrl, userData]) => ({
        ...userData,
        avatar: avatarUrl
      }))
    )
    .chain(cacheUserEffect)
    .chain(sendWelcomeEmailEffect)
    .chain(logUserRegistrationEffect);
};

// 사용법
const dependencies = {
  db: prismaClient,
  cache: redisClient,
  http: httpClient,
  logger: console
};

try {
  const newUser = await registerUserWorkflow({
    email: 'john@example.com',
    name: 'John Doe'
  }).run(dependencies);
  
  console.log('등록 완료:', newUser);
} catch (error) {
  console.error('등록 실패:', error.message);
}
```

## 병렬 실행과 경쟁 실행 (Applicative 패턴)

```typescript
import { Effect, withDB, withHttp } from '@nerd-toolkit/effect-chain';

// Applicative 패턴: 독립적인 Effects를 병렬로 실행
const parallelEffect = Effect.all([
  withDB(async (db) => db.user.count()),           // Effect<number, 'db'>
  withDB(async (db) => db.post.count()),           // Effect<number, 'db'>  
  withHttp(async (http) => http.get('/api/stats')) // Effect<Stats, 'http'>
]);
// 타입: Effect<[number, number, Stats], 'db' | 'http'>

// 모든 의존성이 병합되어 추적됨
const [userCount, postCount, apiStats] = await parallelEffect.run({
  db: prismaClient,
  http: httpClient
});

// 경쟁 실행: 가장 빠른 결과만 사용 (Alternative 패턴)
const raceEffect = Effect.race([
  withHttp(async (http) => http.get('/api/server1/data')),
  withHttp(async (http) => http.get('/api/server2/data')),
  withCache(async (cache) => {
    const cached = await cache.get('fallback-data');
    return cached ? JSON.parse(cached) : null;
  })
]);
// 타입: Effect<Data, 'http' | 'cache'>

const fastestResult = await raceEffect.run({ 
  http: httpClient, 
  cache: redisClient 
});

// 모나드 합성과 Applicative 결합
const complexWorkflow = withDB(async (db) => db.user.findMany())
  .chain(users => 
    Effect.all(
      users.map(user => 
        withHttp(async (http) => 
          http.get(`/api/profile/${user.id}`)
        )
      )
    )
  );
// 각 사용자의 프로필을 병렬로 가져오기
// 타입: Effect<Profile[], 'db' | 'http'>
```

## 의존성 설정

```typescript
import { 
  createPrismaClient, 
  createRedisClient, 
  getDefaultDep 
} from '@nerd-toolkit/effect-chain';

// 프로덕션 의존성
const dependencies = {
  db: createPrismaClient(),
  cache: createRedisClient('redis://localhost:6379'),
  logger: console,
  http: {
    async get<T>(url: string): Promise<T> {
      const response = await fetch(url);
      return response.json();
    },
    async post<T>(url: string, data: unknown): Promise<T> {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return response.json();
    }
    // ... 다른 HTTP 메서드들
  }
};

// 테스트용 Mock 의존성
const testDependencies = {
  db: createTestDep('db'), // Mock Prisma 클라이언트
  cache: createTestDep('cache'), // Mock Redis 클라이언트  
  logger: createTestDep('logger'), // Mock 로거
  http: createTestDep('http') // Mock HTTP 클라이언트
};
```

## 에러 처리

```typescript
import { withDB, withLogger } from '@nerd-toolkit/effect-chain';

const userFetchEffect = withDB(async (db) => {
  const user = await db.user.findUnique({
    where: { id: 'user-123' }
  });
  
  if (!user) {
    throw new Error('사용자를 찾을 수 없습니다');
  }
  
  return user;
});

// 일반적인 try-catch 사용
const dependencies = { db: prismaClient, logger: console };

try {
  const user = await userFetchEffect.run(dependencies);
  console.log('사용자:', user);
} catch (error) {
  console.error('에러 발생:', error.message);
  // 로깅
  await withLogger((logger) => {
    logger.error('사용자 조회 실패:', error.message);
  }).run(dependencies);
}

// 에러 처리를 포함한 Effect 생성
const safeUserFetchEffect = withDB(async (db) => {
  try {
    const user = await db.user.findUnique({
      where: { id: 'user-123' }
    });
    
    if (!user) {
      return { success: false, error: '사용자를 찾을 수 없습니다', data: null };
    }
    
    return { success: true, error: null, data: user };
  } catch (error) {
    return { success: false, error: error.message, data: null };
  }
});

const result = await safeUserFetchEffect.run(dependencies);
if (result.success) {
  console.log('사용자:', result.data);
} else {
  console.error('에러:', result.error);
}
```

## SSR 주의사항

서버 환경에서는 의존성을 요청별로 독립적으로 관리하세요.

```typescript
// ❌ 서버에서 위험 - 요청 간 상태 공유
let globalDependencies = { db: prismaClient };

// ✅ 서버에서 안전 - 요청별 독립적인 의존성
function createRequestDependencies(requestId: string) {
  return {
    db: prismaClient,
    logger: createRequestLogger(requestId),
    cache: redisClient
  };
}
```
