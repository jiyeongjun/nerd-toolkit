# @nerd-toolkit/effect-chain

타입 안전한 의존성 주입이 가능한 함수형 Effect 시스템

## 핵심 특징

- **타입 안전성**: 컴파일 타임에 의존성 검증 및 타입 추론
- **함수형 프로그래밍**: Effect 체이닝과 합성을 통한 선언적 코드 작성
- **모나드 패턴**: Reader + IO 모나드의 결합으로 의존성 자동 전파
- **테스트 용이성**: 순수 함수와 의존성 주입으로 완벽한 격리 테스트
- **의존성 역전**: 로직이 구체적 구현체를 몰라도 됨
- **비동기 처리**: Promise 기반 비동기 작업 완벽 지원
- **병렬/경쟁 실행**: Effect.all, Effect.race, Effect.sequence 지원
- **다양한 의존성**: DB(Prisma), 캐시(Redis), 로거, HTTP 클라이언트

## 기본 사용법

```typescript
import { Effect, pure, fromPromise, getDefaultDep } from '@nerd-toolkit/effect-chain';

// 1. 순수 값
const pureEffect = pure(42);

// 2. 비동기 작업
const asyncEffect = fromPromise(async () => {
  const response = await fetch('/api/data');
  return response.json();
});

// 3. 의존성과 함께 실행 - 모든 의존성 필수!
const dependencies = await getDefaultDep(); // 기본 의존성 맵 생성

const result = await pureEffect.run(dependencies);
const data = await asyncEffect.run(dependencies);
```

## 의존성 맵 구성

```typescript
import { 
  createPrismaClient, 
  createRedisClient,
  getDefaultDep,
  createTestDep 
} from '@nerd-toolkit/effect-chain';

// 1. 기본 의존성 (프로덕션)
const prodDependencies = await getDefaultDep();
// 포함: DB(Prisma), Cache(Redis), Logger(Console), HTTP(Fetch)

// 2. 커스텀 의존성
const customDependencies = {
  db: await createPrismaClient(),
  logger: {
    info: (msg: string) => winston.info(msg),
    warn: (msg: string) => winston.warn(msg),
    error: (msg: string) => winston.error(msg),
    debug: (msg: string) => winston.debug(msg),
  },
  cache: await createRedisClient(),
  http: {
    async get<T>(url: string): Promise<T> {
      const response = await axios.get(url);
      return response.data;
    },
    async post<T>(url: string, data?: unknown): Promise<T> {
      const response = await axios.post(url, data);
      return response.data;
    },
    // ... 다른 HTTP 메서드들
  }
};

// 3. 테스트용 의존성
const testDependencies = await createTestDep();
// 포함: In-memory DB, Mock Cache, Console Logger, Mock HTTP
```

## 개별 의존성 사용

```typescript
import { withDB, withLogger, withCache, withHttp } from '@nerd-toolkit/effect-chain';

// 1. 데이터베이스 사용
const getUserEffect = withDB(async (db) => {
  return await db.user.findUnique({
    where: { id: 'user-123' }
  });
});

// 2. 로거 사용
const logEffect = withLogger((logger) => {
  logger.info('작업을 시작합니다');
  return '로깅 완료';
});

// 3. 캐시 사용
const cacheEffect = withCache(async (cache) => {
  const cached = await cache.get('key');
  if (cached) return JSON.parse(cached);
  
  const data = { message: 'Hello World' };
  await cache.set('key', JSON.stringify(data), 3600); // TTL: 1시간
  return data;
});

// 4. HTTP 클라이언트 사용
const apiEffect = withHttp(async (http) => {
  return await http.get('/api/external-data');
});

// 모든 의존성과 함께 실행
const dependencies = await getDefaultDep();
const user = await getUserEffect.run(dependencies);
const logResult = await logEffect.run(dependencies);
const cachedData = await cacheEffect.run(dependencies);
const apiData = await apiEffect.run(dependencies);
```

## Effect 체이닝과 모나드 합성

```typescript
import { pure, withDB, withLogger, withCache } from '@nerd-toolkit/effect-chain';

// 복합적인 비즈니스 로직
const createUserWorkflow = (userData: { name: string; email: string }) => {
  return pure(userData)
    // 1. 데이터 검증
    .transform(data => {
      if (!data.email || !data.name) {
        throw new Error('이메일과 이름은 필수입니다');
      }
      return data;
    })
    // 2. 사용자 생성
    .chain(data => withDB(async (db) => {
      return await db.user.create({ data });
    }))
    // 3. 캐시에 저장
    .chain(user => withCache(async (cache) => {
      await cache.set(`user:${user.id}`, JSON.stringify(user));
      return user;
    }))
    // 4. 로깅
    .chain(user => withLogger((logger) => {
      logger.info(`새 사용자 생성: ${user.name} (${user.email})`);
      return user;
    }));
};

// 실행
const dependencies = await getDefaultDep();
const newUser = await createUserWorkflow({
  name: 'John Doe',
  email: 'john@example.com'
}).run(dependencies);
```

## 병렬 및 경쟁 실행

```typescript
import { Effect, withDB, withHttp, withCache } from '@nerd-toolkit/effect-chain';

// 1. 병렬 실행 (모든 작업이 완료될 때까지 대기)
const parallelEffect = Effect.all([
  withDB(async (db) => db.user.count()),
  withDB(async (db) => db.post.count()),
  withHttp(async (http) => http.get('/api/stats'))
]);

const dependencies = await getDefaultDep();
const [userCount, postCount, apiStats] = await parallelEffect.run(dependencies);

// 2. 경쟁 실행 (가장 빠른 결과만 사용)
const raceEffect = Effect.race([
  withHttp(async (http) => http.get('/api/server1/data')),
  withHttp(async (http) => http.get('/api/server2/data')),
  withCache(async (cache) => {
    const cached = await cache.get('fallback-data');
    return cached ? JSON.parse(cached) : null;
  })
]);

const fastestResult = await raceEffect.run(dependencies);

// 3. 순차 실행 (순서대로 하나씩 실행)
const sequenceEffect = Effect.sequence([
  withDB(async (db) => db.user.findFirst()),
  withCache(async (cache) => cache.set('last-user', 'found')),
  withLogger((logger) => { logger.info('순차 처리 완료'); return 'done'; })
]);

const [user, cacheResult, logResult] = await sequenceEffect.run(dependencies);
```


## 에러 처리

```typescript
import { withDB, withLogger } from '@nerd-toolkit/effect-chain';

const safeUserFetchEffect = withDB(async (db) => {
  try {
    const user = await db.user.findUnique({ where: { id: 'user-123' } });
    
    if (!user) {
      return { success: false, error: '사용자를 찾을 수 없습니다', data: null };
    }
    
    return { success: true, error: null, data: user };
  } catch (error) {
    return { success: false, error: error.message, data: null };
  }
});

// 사용
const dependencies = await getDefaultDep();
const result = await safeUserFetchEffect.run(dependencies);

if (result.success) {
  console.log('사용자:', result.data);
} else {
  console.error('에러:', result.error);
}
```

## 모나드 법칙 준수

Effect-chain은 모나드 법칙을 완전히 준수합니다:

```typescript
// 1. Left Identity: pure(x).chain(f) === f(x)
Effect.pure(42).chain(x => withLogger(logger => x * 2))
// === withLogger(logger => 42 * 2)

// 2. Right Identity: m.chain(pure) === m  
effect.chain(x => Effect.pure(x)) // === effect

// 3. Associativity: 결합법칙
effect.chain(f).chain(g) // === effect.chain(x => f(x).chain(g))
```

## 환경별 설정

```typescript
// 개발 환경
const devDependencies = {
  db: await createPrismaClient(),
  logger: console,
  cache: await createRedisClient('redis://localhost:6379'),
  http: fetchHttpClient
};

// 프로덕션 환경
const prodDependencies = {
  db: await createPrismaClient(),
  logger: winstonLogger,
  cache: await createRedisClient(process.env.REDIS_URL),
  http: axiosHttpClient
};

// 테스트 환경
const testDependencies = await createTestDep();

// 같은 Effect 코드로 다른 환경에서 실행
const effect = withDB(async (db) => db.user.findMany());
const devResult = await effect.run(devDependencies);
const prodResult = await effect.run(prodDependencies);
const testResult = await effect.run(testDependencies);
```