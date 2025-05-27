# @nerd-toolkit/state-store

타입 안전한 상태 관리 라이브러리 (빌더 패턴)

## 핵심 특징

- **타입 안전**: TypeScript 완전 지원
- **빌더 패턴**: 직관적이고 체이닝 가능한 API
- **불변성**: Immer 기반 상태 업데이트
- **함수형**: FxTS 활용
- **SSR 안전**: 서버/클라이언트 환경 분리

## 기본 사용법

```typescript
import { createStore } from '@nerd-toolkit/state-store';

// 간단한 카운터 스토어
const counterStore = createStore<{ count: number }>()
  .initialState({ count: 0 })
  .computed({
    doubleCount: (state) => state.count * 2,
    isEven: (state) => state.count % 2 === 0
  })
  .actions({
    increment: () => ({ count }) => ({ count: count + 1 }),
    decrement: () => ({ count }) => ({ count: count - 1 }),
    reset: () => ({ count: 0 }),
    setCount: (newCount: number) => ({ count: newCount })
  })
  .build();

// 상태 구독
const unsubscribe = counterStore.subscribe((state) => {
  console.log('Count:', state.count, 'Double:', state.doubleCount);
});

// 액션 실행
counterStore.actions.increment();
counterStore.actions.setCount(10);

// 구독 해제
unsubscribe();
```

## 비동기 액션

```typescript
interface UserState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

const userStore = createStore<UserState>()
  .initialState({ 
    user: null, 
    loading: false, 
    error: null 
  })
  .computed({
    isLoggedIn: (state) => state.user !== null,
    userName: (state) => state.user?.name || 'Guest'
  })
  .actions({
    setLoading: (loading: boolean) => ({ loading }),
    clearError: () => ({ error: null })
  })
  .asyncActions({
    // 사용자 로그인
    login: async (credentials: LoginCredentials) => {
      try {
        const user = await authAPI.login(credentials);
        return { 
          data: { user, loading: false, error: null }
        };
      } catch (error) {
        return { 
          data: { loading: false, error: error.message }
        };
      }
    },
    
    // 사용자 정보 가져오기
    fetchUser: async (id: string) => {
      const user = await userAPI.getUser(id);
      return { data: { user } };
    },
    
    // 사용자 로그아웃
    logout: async () => {
      await authAPI.logout();
      return { 
        data: { user: null, error: null }
      };
    }
  })
  .build();

// 비동기 액션 사용
await userStore.asyncActions.login({ email, password });
console.log('로그인 상태:', userStore.getState().isLoggedIn);
```

## 싱글톤 헬퍼

```typescript
import { getSingletonStore } from '@nerd-toolkit/state-store';

// 싱글톤 스토어 생성 (클라이언트 전용)
const appStore = getSingletonStore('app', () =>
  createStore<AppState>()
    .initialState({ theme: 'light' })
    .build()
);
```

## SSR 주의사항

서버 환경에서는 싱글톤 패턴을 피하고 매 요청마다 새 스토어 인스턴스를 생성하세요.

```typescript
// ❌ 서버에서 위험
let globalStore = createStore()...

// ✅ 서버에서 안전
function createAppStore(initialData) {
  return createStore()
    .initialState(initialData)
    .build();
}
```

## 개발도구 및 미들웨어

```typescript
import { createStore, createLogger } from '@nerd-toolkit/state-store';

const store = createStore<AppState>()
  .initialState(initialState)
  .computed({ /* ... */ })
  .actions({ /* ... */ })
  .asyncActions({ /* ... */ })
  // 로깅 미들웨어 추가
  .middlewares([
    createLogger() // 모든 액션과 상태 변화를 콘솔에 로깅
  ])
  // Redux DevTools 연결 (개발 환경에서만)
  .devTools({ 
    name: 'My App Store',
    trace: true,
    traceLimit: 25
  })
  .build();
```

## 복잡한 상태 관리 예시

```typescript
interface ShoppingCartState {
  items: CartItem[];
  coupon: Coupon | null;
  shipping: ShippingInfo | null;
  loading: boolean;
}

const cartStore = createStore<ShoppingCartState>()
  .initialState({
    items: [],
    coupon: null,
    shipping: null,
    loading: false
  })
  .computed({
    // 총 가격 계산
    totalPrice: (state) => {
      const subtotal = state.items.reduce((sum, item) => 
        sum + (item.price * item.quantity), 0
      );
      const discount = state.coupon?.discount || 0;
      const shippingCost = state.shipping?.cost || 0;
      return subtotal - discount + shippingCost;
    },
    
    // 상품 개수
    itemCount: (state) => state.items.reduce((sum, item) => 
      sum + item.quantity, 0
    ),
    
    // 장바구니 비어있는지 확인
    isEmpty: (state) => state.items.length === 0
  })
  .actions({
    // 상품 추가
    addItem: (product: Product, quantity = 1) => (state) => {
      const existingItem = state.items.find(item => item.id === product.id);
      if (existingItem) {
        return {
          items: state.items.map(item =>
            item.id === product.id 
              ? { ...item, quantity: item.quantity + quantity }
              : item
          )
        };
      }
      return {
        items: [...state.items, { ...product, quantity }]
      };
    },
    
    // 상품 제거
    removeItem: (productId: string) => (state) => ({
      items: state.items.filter(item => item.id !== productId)
    }),
    
    // 수량 변경
    updateQuantity: (productId: string, quantity: number) => (state) => ({
      items: state.items.map(item =>
        item.id === productId ? { ...item, quantity } : item
      )
    }),
    
    // 쿠폰 적용
    applyCoupon: (coupon: Coupon) => ({ coupon }),
    
    // 장바구니 비우기
    clearCart: () => ({ items: [], coupon: null })
  })
  .asyncActions({
    // 쿠폰 검증
    validateCoupon: async (couponCode: string) => {
      try {
        const coupon = await couponAPI.validate(couponCode);
        return { data: { coupon } };
      } catch (error) {
        throw new Error('유효하지 않은 쿠폰입니다');
      }
    },
    
    // 배송비 계산
    calculateShipping: async (address: Address) => {
      const shipping = await shippingAPI.calculate(address);
      return { data: { shipping } };
    },
    
    // 주문 처리
    checkout: async (paymentInfo: PaymentInfo) => {
      const order = await orderAPI.create({
        items: cartStore.getState().items,
        coupon: cartStore.getState().coupon,
        shipping: cartStore.getState().shipping,
        payment: paymentInfo
      });
      
      return { 
        data: { 
          items: [], 
          coupon: null, 
          shipping: null, 
          loading: false 
        }
      };
    }
  })
  .middlewares([createLogger()])
  .devTools({ name: 'Shopping Cart' })
  .build();

// 사용 예시
cartStore.actions.addItem(product, 2);
cartStore.actions.updateQuantity(product.id, 5);
await cartStore.asyncActions.validateCoupon('SAVE20');
console.log('총 가격:', cartStore.getState().totalPrice);
```


