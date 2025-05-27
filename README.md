# Nerd Toolkit

현대적 TypeScript 개발을 위한 멀티패러다임 툴킷

## 비전

**Nerd Toolkit**은 TypeScript의 강력한 타입 시스템을 기반으로, 함수형·객체지향·절차적 프로그래밍 패러다임을 자유롭게 조합할 수 있는 실용적 라이브러리 모음입니다. 개발자가 문제에 가장 적합한 패러다임을 선택하고 조합할 수 있도록 지원합니다.

## 설계 철학

### 🎯 **타입 안전성 우선**
- 런타임 에러를 컴파일 타임에 미리 발견
- TypeScript의 타입 시스템을 최대한 활용
- 타입 추론을 통한 자연스러운 개발 경험

### 🔀 **멀티패러다임 지원**
- 함수형: 불변성, 순수 함수, 모나드 패턴
- 객체지향: 클래스, 캡슐화, 상속
- 절차적: 직관적인 단계별 처리
- 패러다임 간 자연스러운 조합과 전환

### 🧪 **테스트 주도 설계**
- 격리된 단위 테스트가 자연스럽게 작성되는 구조
- Mock과 Stub이 쉬워지는 의존성 주입
- 각 패러다임에 맞는 테스트 전략 지원

### ⚡ **개발자 경험 최적화**
- 직관적이고 일관된 API 설계
- 뛰어난 IDE 지원과 자동완성
- 명확한 에러 메시지와 디버깅 경험

## 패키지 생태계

### 📦 **@nerd-toolkit/state-store**
*타입 안전한 상태 관리*

```typescript
// 빌더 패턴 + 불변성
const store = createStore<AppState>()
  .initialState(initialState)
  .computed({ /* 함수형 */ })
  .actions({ /* 절차적 */ })
  .build();
```

### ⚡ **@nerd-toolkit/effect-chain**
*의존성 주입 & Effect 시스템*

```typescript
// 함수형 모나드 + 절차적 플로우
const workflow = withDB(loadUser)
  .chain(user => updateCache(user))
  .transform(result => processResult(result));
```

### 🔮 **향후 계획**
- **@nerd-toolkit/validation**: 스키마 검증 & 타입 가드
- **@nerd-toolkit/async**: 비동기 작업 관리 & 동시성 제어
- **@nerd-toolkit/collections**: 타입 안전한 자료구조 & 알고리즘
- **@nerd-toolkit/http**: 타입 안전한 HTTP 클라이언트
- **@nerd-toolkit/config**: 환경 설정 & 구성 관리

## 핵심 가치

### 🎨 **실용주의**
이론적 순수성보다는 실제 문제 해결에 집중합니다. 각 패러다임의 장점을 취하고 단점을 보완하는 현실적 접근을 추구합니다.

### 🌱 **점진적 도입**
기존 코드베이스에 부담 없이 점진적으로 도입할 수 있습니다. 전체를 한 번에 바꿀 필요 없이 필요한 부분부터 적용 가능합니다.

### 🔧 **생산성 향상**
반복적인 보일러플레이트를 줄이고, 타입 안전성을 통해 리팩토링과 유지보수를 쉽게 만듭니다.


## 사용 예시

### 전통적 객체지향 + 현대적 함수형
```typescript
class UserService {
  constructor(private deps: Dependencies) {}

  async registerUser(data: UserData) {
    // 함수형 검증
    const validated = pipe(
      data,
      validateEmail,
      validatePassword,
      validateRequired
    );

    // Effect 체인으로 비즈니스 로직
    return withDB(db => db.user.create({ data: validated }))
      .chain(user => withEmail(email => email.sendWelcome(user)))
      .chain(user => withCache(cache => cache.set(`user:${user.id}`, user)))
      .run(this.deps);
  }
}
```

### 순수 함수형 접근
```typescript
const registerUserWorkflow = (userData: UserData) =>
  pure(userData)
    .transform(validateUserData)
    .chain(saveUser)
    .chain(sendWelcomeEmail)
    .chain(cacheUser);

// 의존성 주입으로 실행
const result = await registerUserWorkflow(data).run(dependencies);
```

### 절차적 플로우
```typescript
async function processOrder(orderId: string) {
  const store = getOrderStore();
  
  // 1. 주문 조회
  store.actions.setLoading(true);
  const order = await fetchOrder(orderId);
  
  // 2. 결제 처리
  const payment = await processPayment(order);
  
  // 3. 상태 업데이트
  store.actions.updateOrder({ orderId, status: 'paid' });
  
  return { order, payment };
}
```

## 라이센스

MIT License - 자유롭게 사용, 수정, 배포 가능합니다.

---

*"좋은 도구는 사고를 제한하지 않고 확장한다"*