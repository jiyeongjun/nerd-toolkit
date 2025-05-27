import { Middleware } from '../types/internal/store';

export function createLogger<TState extends Record<string, any>>(): Middleware<TState> {
  return (store) => {
    return (next) => (action: any) => {
      const startTime = performance.now();
      
      console.group(`[Logger] Action: ${action.type || 'Unknown'}`);
      console.log('%c Prev State:', 'color: #9E9E9E; font-weight: bold;', store.getState());
      console.log('%c Action:', 'color: #03A9F4; font-weight: bold;', action);
      
      const result = next(action);
      
      const executionTime = performance.now() - startTime;
      console.log('%c Next State:', 'color: #4CAF50; font-weight: bold;', store.getState());
      console.log('%c Execution time:', 'color: #FF5722; font-weight: bold;', `${executionTime.toFixed(2)}ms`);
      console.groupEnd();
      
      return result;
    };
  };
}
