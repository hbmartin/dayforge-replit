# Working Guide
- After adding any code or functionality, write thorough unit tests and check coverage.
- After making any changes always execute `pnpm format && pnpm dupes && pnpm test` to verify
- Fix any pnpm format issues (even if they are unrelated)
- Never edit migration fiels directly - instead run drizzle `pnpm db:generate` to create migrations

# Practical Principles
- One file = one purpose (no 800-line “service.ts”).
- No “utils” without a namespace (e.g., shared/transport/httpErrors.ts, not utils.ts).
- Explicit exports per module (modules/users/index.ts) to prevent random deep imports.
- Keep route handlers thin (validation → use case → mapping)

# Architecture

## Goals
- Easy to swap implementations (test doubles, different providers)
- Explicit contracts at boundaries
- No business rules in services.
- Map domain errors → HTTP errors at API layer
- Keeping Next.js at the edge
- Centralize boundary validation + error mapping. Add zod DTOs for all HTTP entrypoints.
- Always use Zod for parsing types from external sources (including form data)

## Implementations
- Make side effects explicit. DB writes, network calls, queues, emails, payments: wrap behind interfaces (“ports”).
- Keep domain types stable and meaningful. Use real types (`User`, `Event`, `Message`) and parse/validate at the edges. Validate at the boundaries, normalize once.
- Errors are part of the design. Use a consistent error model: domain errors vs system errors; map to HTTP/status/logging in one place.

# TypeScript
- **Type everything**: params, returns, config objects, and external integrations; avoid `any` 
- **Use interfaces**: for complex types and objects, including ports and DTOs
- **Make Illegal States Unrepresentable**: If something should never happen, encode that rule in the type system instead of comments or runtime checks.
  - Discriminated unions instead of flags + nullable fields
  - Narrowed constructors / factory functions
- **Avoid using bare string types** - prefer Branded domain types instead of primitives
  - Brand types especially for strings e.g. phone, email, ID
  - e.g. NormalizedEmail, UserId, ChatId
- **Avoid Type Assertions (as)**: Every as is a potential runtime crash hidden from the compiler.
  - Replace with: Narrowing functions or Exhaustive pattern matching or Refined input types
  - ` as const` is very useful and should be used
- **Prefer Union Types Over Boolean Flags**: Boolean flags destroy invariants.
- **Separate Pure Logic from Side Effects**: Functions that return void hide meaning from the compiler.
  - Prefer Pure functions with explicit inputs/outputs.
- **Use a single params object for a function argument when there are optional arguments or arguments of the same type**: this enables safe, name-based destructuring.
- **Prefer undefined over null** - except at outer boundaries where it's necessary to communicate absence of a value.
- Always add a `type` attribute to Button component.
- **Never use multiple set(State) calls consecutively**: prefer a single setState call with an object containing all updates.
- **Avoid uninformative method names** - don't use words like "handle" or "process" in names, use descriptive verbs
- **Avoid type guard functions** - prefer Zod (e.g. for cache policy)
- **Avoid creating duplicative types** - prefer to use typescript's `Pick` or `Omit` (if using Zod use `.extend`)
- **Never use Parameters<typeof ...>** - prefer destructuring or param object typing (only allowed in tests)
- **Prefer well typed dispatch objects to switch statements**
- Zod v4 z.record requires both key and value schemas (e.g., z.record(z.string(), z.string()))

# Composition & Dependency Injection

The codebase uses a three-layer factory pattern for dependency injection without a DI container.

## Layer 1: Module Factories (`modules/*/factory.ts`)

Pure functions that accept all required dependencies and create use cases. No defaults, no caching.

**Rules:**
- Accept instances, not factory functions (no `getMessenger: () => Messenger`)
- No default values - all required deps must be provided
- No caching - always returns a fresh instance

## Layer 2: Composition Roots (`app/composition/*.ts`)

Wrap module factories with defaults and override handling. All fields in override interface are optional.

**Rules:**
- Override interfaces have all fields optional
- Use `??` to apply defaults (never `||`)
- For complex modules, group related deps into resolver functions by concern type

### Resolver Function Guidelines

Use the **hybrid approach**: extract resolvers only when they earn their complexity.

**Extract a resolver when:**
- 3+ dependencies of the same type (e.g., 3+ repositories), OR
- Shared config needed to create multiple deps (e.g., clock used by messenger and aiResponder)

**Inline when:**
- 1-2 deps of a type with independent creation

**Example (from WhatsApp composition):**
```typescript
function createWhatsAppUseCasesWithDefaults(overrides = {}) {
  // RESOLVER: shared config (clock, edgeConfig) + 3 repositories
  const core = resolveCore(overrides);

  // INLINE: aiResponder uses core deps (single dep, but needs shared config)
  const aiResponder = overrides.aiResponder ??
    createWhatsAppAiResponder({ clock: core.clock, edgeConfig: core.edgeConfig });

  // INLINE: simple single deps
  return createWhatsAppUseCases({
    ...core,
    aiResponder,
    messenger: overrides.messenger ?? createWhatsAppMessenger({ clock: core.clock }),
    logger: overrides.logger ?? createWhatsAppLogger(),
    idGenerator: overrides.idGenerator ?? getDefaultIdGenerator(),
    // ...
  });
}
```

## Layer 3: Cached Factory (`createCachedFactory`)

Wraps composition roots to cache singletons when no overrides are provided.

**Behavior:**
- No overrides → returns cached singleton
- Any override provided → creates fresh instance (for testing)

## Key Principles

1. **Override means instance, not factory**: Pass `messenger?: Messenger`, not `getMessenger?: () => Messenger`
2. **Partial overrides are fine**: Only provide what you want to change; defaults fill the rest
3. **Caching is opt-out**: Tests pass overrides to get fresh instances; production uses singletons
   - Any override triggers fresh instance creation to ensure test isolation
   - Even a single override like `{ clock: testClock }` bypasses the cache entirely
4. **Resolver granularity by concern**: Group by what the deps do, not one resolver per dep

# Cross-cutting backend concerns

- **Never use `new Error(...)`**: Throw domain/application specific errors (e.g. `DomainError`, `NotFoundError`), then map them to HTTP responses in a global error handler.
- **Configuration**: Expose a typed `config` module; never access `process.env` all over the codebase.
- **Testing**: Unit-test domain/services in isolation using in-memory mocks of ports; integration-test adapters (DB, external APIs) and a few end-to-end flows.
  - avoid instanceof checks when using vi.resetModules (module class identity changes); prefer property-based assertions like name/code.
