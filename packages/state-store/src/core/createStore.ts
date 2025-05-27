import { StoreBuilder } from './internal/StoreBuilder';

/**
 * 스토어 생성을 시작하는 함수 (빌더 패턴 진입점)
 * @template TState 스토어의 상태(State) 타입 (객체여야 함)
 *
 * @warning 서버 사이드 렌더링(SSR) 환경에서 사용 시 주의사항:
 * 이 스토어를 서버에서 싱글톤으로 사용하지 마세요.
 * 서버에서 생성된 스토어를 다수의 요청에서 공유하면 상태가 요청 간에 섞여서
 * 데이터 유출이나 예기치 않은 동작이 발생할 수 있습니다.
 *
 * @example
 * // ✅ 올바른 사용법
 * const store = createStore<{ count: number }>()
 *   .initialState({ count: 0 })
 *   .actions({
 *     increment: () => (state) => ({ count: state.count + 1 })
 *   })
 *   .build();
 */
export function createStore<TState extends Record<string, any>>(): StoreBuilder<TState> {
  return new StoreBuilder<TState>();
}
