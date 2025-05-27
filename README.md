🔗 Functional Effect chaining
- 💉 Type-safe dependency injection
- 🔄 Composable Effects (transform, chain)
- ⚡ Parallel processing (all, race, sequence)
- 🛡️ Phantom types for compile-time safety
- 🗄️ Built-in Prisma & Redis support

**Quick Example:**
```typescript
import { withDB, withCache, withLogger, getDefaultDep } from '@nerd-toolkit/effect-chain';

const getUserWithCache = (userId: string) =>
  withCache(cache => cache.get(`user:${userId}`))
    .chain(cached => {
      if (cached) return pure(JSON.parse(cached));
      
      return withDB(db => db.user.findUnique({ where: { id: userId } }))
        .chain(user => 
          withCache(cache => {
            cache.set(`user:${userId}`, JSON.stringify(user), 3600);
            return user;
          })
        );
    })
    .chain(user =>
      withLogger(logger => {
        logger.info(`User ${userId} accessed`);
        return user;
      })
    );

// Usage
const deps = await getDefaultDep();
const user = await getUserWithCache('123').run(deps);
```


## Architecture

### Monorepo Structure

```
nerd-toolkit/
├── packages/
│   ├── state-store/           # State management library
│   │   ├── src/
│   │   │   ├── core/          # Core functionality
│   │   │   ├── types/         # Type definitions
│   │   │   ├── middlewares/   # Middleware implementations
│   │   │   └── utils/         # Utility functions
│   │   └── package.json
│   └── effect-chain/          # Effect system library
│       ├── src/
│       │   ├── Effect.ts      # Core Effect class
│       │   ├── creators.ts    # Effect creator functions
│       │   ├── types.ts       # Type definitions
│       │   └── depsTypes.ts   # Dependency type definitions
│       ├── prisma/
│       │   └── schema.prisma  # Database schema
│       └── package.json
├── .changeset/                # Changeset configuration
├── package.json               # Root package.json
└── pnpm-workspace.yaml       # Workspace configuration
```

### Design Principles

1. **Type Safety First**: Every API is designed with TypeScript's type system in mind
2. **Functional Programming**: Embrace immutability and pure functions where possible
3. **Composability**: Build complex functionality from simple, composable pieces
4. **Developer Experience**: Intuitive APIs with excellent TypeScript IntelliSense
5. **Performance**: Efficient implementations with minimal runtime overhead

## Examples

### State Management with Effect System

Combining both libraries for powerful state management with side effects:

```typescript
import { createStore } from '@nerd-toolkit/state-store';
import { withDB, withCache, Effect, getDefaultDep } from '@nerd-toolkit/effect-chain';

interface UserState {
  users: Record<string, User>;
  loading: boolean;
  error: string | null;
}

const userStore = createStore<UserState>()
  .initialState({ users: {}, loading: false, error: null })
  .actions({
    setLoading: (loading: boolean) => ({ loading }),
    setError: (error: string | null) => ({ error }),
    setUsers: (users: Record<string, User>) => ({ users }),
  })
  .build();

// Effect to load users with caching
const loadUsers = () =>
  Effect.all([
    withCache(cache => cache.get('users:all')),
    withDB(db => db.user.findMany()),
  ])
  .transform(([cached, dbUsers]) => {
    if (cached) return JSON.parse(cached);
    return dbUsers;
  })
  .chain(users =>
    withCache(cache => {
      cache.set('users:all', JSON.stringify(users), 300);
      return users;
    })
  );

// Usage
async function fetchUsers() {
  userStore.actions.setLoading(true);
  userStore.actions.setError(null);
  
  try {
    const deps = await getDefaultDep();
    const users = await loadUsers().run(deps);
    
    const userMap = users.reduce((acc, user) => {
      acc[user.id] = user;
      return acc;
    }, {} as Record<string, User>);
    
    userStore.actions.setUsers(userMap);
  } catch (error) {
    userStore.actions.setError(error.message);
  } finally {
    userStore.actions.setLoading(false);
  }
}
```

### Real-world Application Structure

```typescript
// stores/userStore.ts
export const userStore = createStore<UserState>()
  .initialState(initialUserState)
  .computed({
    activeUsers: (state) => Object.values(state.users).filter(u => u.active),
    userCount: (state) => Object.keys(state.users).length,
  })
  .actions({
    // ... user actions
  })
  .build();

// effects/userEffects.ts
export const createUser = (userData: CreateUserData) =>
  withDB(async db => {
    const user = await db.user.create({ data: userData });
    return user;
  })
  .chain(user =>
    withCache(cache => {
      cache.del('users:all'); // Invalidate cache
      return user;
    })
  )
  .chain(user =>
    withLogger(logger => {
      logger.info('User created', { userId: user.id });
      return user;
    })
  );

// services/userService.ts
export class UserService {
  private deps: DependencyMap;
  
  constructor(deps: DependencyMap) {
    this.deps = deps;
  }
  
  async createUser(userData: CreateUserData) {
    const user = await createUser(userData).run(this.deps);
    
    // Update store
    userStore.actions.addUser(user);
    
    return user;
  }
}
```

