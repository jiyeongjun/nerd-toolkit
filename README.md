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

## Installation

```bash
# Install individual packages
npm install @nerd-toolkit/state-store
npm install @nerd-toolkit/effect-chain

# Or install all packages
npm install @nerd-toolkit/state-store @nerd-toolkit/effect-chain
```

## Development

This project uses [pnpm](https://pnpm.io/) workspaces for monorepo management.

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Lint all packages
pnpm lint

# Format code
pnpm format
```

### Database Setup (for effect-chain)

```bash
# Generate Prisma client
pnpm db:generate

# Push schema to database
pnpm db:push

# Run migrations
pnpm db:migrate
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Adding a Changeset

When making changes, please add a changeset to describe your changes:

```bash
pnpm changeset
```

This will prompt you to describe your changes and indicate which packages are affected.

## Publishing

```bash
# Create version bump and changelog
pnpm version-packages

# Build and publish to npm
pnpm release
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

## Roadmap

- [ ] **State Store Enhancements**
  - [ ] Time-travel debugging
  - [ ] Persistence adapters
  - [ ] React hooks integration
  - [ ] Vue composition API integration

- [ ] **Effect Chain Extensions**
  - [ ] Retry and circuit breaker patterns
  - [ ] Metrics and observability
  - [ ] Streaming support
  - [ ] More dependency adapters (MongoDB, GraphQL, etc.)

- [ ] **New Packages**
  - [ ] **@nerd-toolkit/validation** - Schema validation with Effect integration
  - [ ] **@nerd-toolkit/router** - Type-safe routing
  - [ ] **@nerd-toolkit/testing** - Testing utilities for the ecosystem
  - [ ] **@nerd-toolkit/devtools** - Development and debugging tools

## License

MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](https://github.com/your-username/nerd-toolkit/tree/main/docs)
- 🐛 [Issue Tracker](https://github.com/your-username/nerd-toolkit/issues)
- 💬 [Discussions](https://github.com/your-username/nerd-toolkit/discussions)

---

Built with ❤️ by the Nerd Toolkit team.
