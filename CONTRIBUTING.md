# Contributing

## Risky Operations Policy

Commands that perform risky operations must gate execution behind user confirmation using `confirmOrExit()` from `src/utils.ts`. All such commands must expose a `--yes` flag.

### Risk Tiers

**Tier 1 — Irreversible**
Operations that cannot be undone (e.g. deleting an application, deleting a lambda). Recovery requires significant manual effort.

**Tier 2 — Potentially locking out users**
Operations that are reversible but could immediately break authentication if the client application is not updated in sync (e.g. enabling PKCE on an existing application, changing grant types, rotating a client secret).

Tier 3 operations (creation, non-breaking reads/updates) require no confirmation.

### Implementation

Add `--yes` to the command's options:

```typescript
.option('--yes', 'Skip confirmation prompt', false)
```

Call `confirmOrExit()` before the destructive action:

```typescript
await confirmOrExit('This will permanently delete the application. This cannot be undone.', yes);
```

For Tier 1, the message must describe what will be permanently lost. For Tier 2, use a specific message describing what could break and for whom. A placeholder is acceptable during initial implementation but should be replaced before release:

```typescript
// TODO: replace with specific message describing what could break
await confirmOrExit('This change may prevent users from authenticating.', yes);
```

### Rules

- Always use `--yes`. Do not use `--force` or `--confirm`.
- Do not add `--yes` to Tier 3 operations.
