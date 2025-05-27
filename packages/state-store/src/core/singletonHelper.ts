import { isClient } from '../utils/env';

const SINGLETON_INSTANCES_HELPER = isClient ? new Map<string, any>() : null;

export function getSingletonStore<TStoreInstance>(
  key: string,
  createInstanceFn: () => TStoreInstance,
): TStoreInstance {
  if (!SINGLETON_INSTANCES_HELPER) {
    return createInstanceFn();
  }

  if (!SINGLETON_INSTANCES_HELPER.has(key)) {
    const instance = createInstanceFn();
    SINGLETON_INSTANCES_HELPER.set(key, instance);
  }

  return SINGLETON_INSTANCES_HELPER.get(key) as TStoreInstance;
}

export function cleanupSingletonStoreHelper(key: string): void {
  if (SINGLETON_INSTANCES_HELPER) {
    SINGLETON_INSTANCES_HELPER.delete(key);
  }
}

export function cleanupAllSingletonStoresHelper(): void {
  if (SINGLETON_INSTANCES_HELPER) {
    SINGLETON_INSTANCES_HELPER.clear();
  }
}
