# Architecture Scaling TODO

## Current Reality Check

**What we have:** Single DO storing all todos
**What breaks:** Everything at scale

## Hard Limits (Cloudflare Durable Objects)

- **Storage per DO:** 128MB max
- **CPU per DO:** 30 seconds max execution time
- **Memory per DO:** 128MB RAM
- **Concurrent requests:** Throttled per DO instance
- **Cold start:** ~10-50ms
- **Cross-region latency:** 50-200ms

## Scaling Strategies (Pragmatic to Enterprise)

### 1. **User-based Sharding** (Immediate Next Step)
```
/api/{userId}/load
/api/{userId}/save
```
- **DO naming:** `user-${userId}`
- **Isolation:** Per-user data separation
- **Limits:** 128MB per user = ~100K todos/user
- **Implementation:** 30 min effort

### 2. **Organization-based Sharding** (SaaS Ready)
```
/api/{orgId}/users/{userId}/load
```
- **DO naming:** `org-${orgId}-user-${userId}`
- **Benefits:** Multi-tenant isolation, billing per org
- **Limits:** Unlimited orgs, 128MB per user per org
- **Implementation:** 2 hours

### 3. **Feature-based Sharding** (High Scale)
```
/api/{orgId}/todos/{shardId}/load
/api/{orgId}/users/{userId}/load
/api/{orgId}/analytics/load
```
- **DO types:** `todo-shard`, `user-profile`, `analytics`
- **Benefits:** Specialized DOs, different scaling patterns
- **Complexity:** Requires routing logic

### 4. **Hybrid: DO + D1 Database** (Enterprise)
```
DOs: Hot data, real-time ops
D1:  Cold storage, analytics, search
```
- **Pattern:** Write to DO → Async sync to D1
- **Benefits:** Unlimited storage, SQL queries
- **Complexity:** Eventually consistent

## Quick Wins (No Re-architecture)

### C. **Add Metrics** (20 min)
```javascript
// Log to console or external service
console.log(`Storage: ${dataSize}B, Users: ${userCount}, Todos: ${todoCount}`);
```

## Migration Strategies

### Option 1: **Big Bang** (Risky)
- Switch to sharded architecture overnight
- Requires data migration script
- High risk, fast reward

### Option 2: **Gradual** (Safe)
```javascript
// Check if user exists in new shard system
const newDO = env.TINYBASE_STORE.getByName(`user-${userId}`);
const newData = await newDO.fetch('/api/load');

if (newData.empty) {
  // Migrate from old single DO
  const oldDO = env.TINYBASE_STORE.getByName('default-store');
  // Copy user's data to new DO
}
```

### Option 3: **Feature Flag** (Recommended)
```javascript
const useSharding = env.FEATURE_SHARDING === 'true';
const doName = useSharding ? `user-${userId}` : 'default-store';
```

## Dependencies to Watch

1. **Cloudflare Regional Limits**
   - DOs are single-region (for now)
   - Cross-region = network latency

2. **TinyBase Memory Usage**
   - Large datasets = memory pressure
   - Consider pagination or virtualization

3. **Browser Storage Sync**
   - Currently no offline support
   - Large datasets = slow page loads

4. **No Backup Strategy**
   - DO dies = data gone
   - Need periodic backups to R2/D1

## Monitoring Strategy

### Add These Metrics:
```javascript
// Size monitoring
const dataSize = JSON.stringify(data).length;
const todoCount = Object.keys(todos).length;
const userCount = Object.keys(users).length;

// Performance monitoring
const startTime = Date.now();
// ... operation ...
const duration = Date.now() - startTime;

// Error tracking
try {
  await operation();
} catch (error) {
  console.error('Operation failed', { error, userId, operation });
}
```

### Alert Thresholds:
- **Storage > 100MB:** Critical
- **Response time > 1s:** Warning
- **Error rate > 1%:** Critical
- **User count > 1000:** Plan migration

## Recommended Implementation Order

1. **Week 1:** Add user-based sharding (immediate relief)
2. **Week 2:** Add monitoring and alerting
3. **Week 3:** Add rate limiting and basic auth
4. **Month 2:** Consider D1 integration for analytics
5. **Month 3:** Add backup/recovery strategy

## Quick Sharding Implementation

```typescript
// In worker.tsx
app.get('/:userId', async (c) => {
  const userId = c.req.param('userId');
  const obj = c.env.TINYBASE_STORE.getByName(`user-${userId}`);
  // ... rest same
});

app.all('/api/:userId/*', async (c) => {
  const userId = c.req.param('userId');
  const obj = c.env.TINYBASE_STORE.getByName(`user-${userId}`);
  return obj.fetch(c.req.raw);
});
```

**Result:** Instant 128MB → 128MB * users scaling with zero architecture changes.

---

*Remember: Premature optimization is evil, but ignoring scale is worse. Start with user sharding.*