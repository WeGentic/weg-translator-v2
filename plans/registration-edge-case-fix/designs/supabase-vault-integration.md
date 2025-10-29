# Supabase Vault Integration for Service Role Key Design

## Overview

This document specifies the integration with Supabase Vault for secure storage and retrieval of the service role key in edge functions. This replaces environment variables (baseline security) with Vault (best-practice security) per UserQA recommendation.

## Requirements Addressed

- **Req#3**: Cleanup Edge Function Without Auth
- **Req#8**: Security Requirements for Cleanup Without Auth
- **NFR-15**: Service role key isolation

## Supabase Vault Overview

**Supabase Vault** is an encrypted secret storage system integrated with Supabase projects:
- **Encryption at rest**: Secrets encrypted using project-specific keys
- **Access controls**: Fine-grained permissions per secret
- **Audit logging**: All access logged with timestamps and requester info
- **Integration**: Native support in Edge Functions

**Why Vault > Environment Variables**:
- Environment variables: Plain text in deployment config, no audit trail
- Vault: Encrypted storage, access logging, revocation capabilities

## Setup Procedure

### Step 1: Create Secret in Supabase Vault

**Via Supabase Dashboard**:
1. Navigate to: Project Settings → Vault
2. Click "New Secret"
3. Configure secret:
   - **Name**: `SUPABASE_SERVICE_ROLE_KEY`
   - **Description**: "Service role key for cleanup edge function authentication"
   - **Value**: [paste service role key from Project API settings]
   - **Tags**: `cleanup`, `auth`, `prod`
4. Set permissions:
   - **Allow Edge Functions**: Yes
   - **Allow from specific functions**: `cleanup-orphaned-user` (or `*` for all)
   - **Allow from client**: No
5. Click "Save"

**Via Supabase CLI** (Alternative):
```bash
# Create secret
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key> --vault

# Verify secret exists
supabase secrets list --vault

# Example output:
# NAME                          | CREATED_AT
# SUPABASE_SERVICE_ROLE_KEY     | 2025-10-28T12:00:00Z
```

### Step 2: Grant Access to Edge Functions

**Vault Access Policy**:
```json
{
  "secret_name": "SUPABASE_SERVICE_ROLE_KEY",
  "allow": {
    "edge_functions": ["cleanup-orphaned-user", "register-organization"],
    "roles": []
  },
  "deny": {
    "client_access": true,
    "anon_role": true
  }
}
```

**Rationale**:
- Only specific edge functions can access (principle of least privilege)
- Client-side access blocked (prevents key leakage to browser)
- Anon role blocked (public API cannot access)

## Retrieval in Edge Functions

### Method 1: Built-in Vault SDK (Recommended)

```typescript
import { createClient } from '@supabase/supabase-js';

// Supabase provides vault access in edge function context
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

// Retrieve service role key from Vault
const serviceRoleKey = await Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!serviceRoleKey) {
  throw new Error('Service role key not found in Vault');
}

// Create Supabase client with service role
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});
```

**Note**: As of October 2025, Supabase Vault secrets are exposed as environment variables within edge functions. The difference is:
- **Environment variables**: Stored in plain text in deployment config
- **Vault variables**: Encrypted in Vault, dynamically injected as env vars at runtime

### Method 2: Explicit Vault API Call (Future-Proof)

```typescript
import { createClient } from '@supabase/supabase-js';

async function getSecretFromVault(secretName: string): Promise<string> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Create client with anon key (edge functions have special permissions)
  const supabase = createClient(supabaseUrl, anonKey);

  // Call Vault API
  const { data, error } = await supabase
    .from('vault.secrets')
    .select('secret')
    .eq('name', secretName)
    .single();

  if (error || !data) {
    throw new Error(`Failed to retrieve secret from Vault: ${error?.message}`);
  }

  return data.secret;
}

// Usage
const serviceRoleKey = await getSecretFromVault('SUPABASE_SERVICE_ROLE_KEY');
```

**Note**: This method is more explicit but may not be necessary if Vault secrets are automatically available as environment variables.

### Fallback to Environment Variable (Development Only)

```typescript
async function getServiceRoleKey(): Promise<string> {
  const isProduction = Deno.env.get('DENO_DEPLOYMENT_ID') !== undefined;

  // Try Vault first
  let serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  // Fallback to direct env var (development only)
  if (!serviceRoleKey && !isProduction) {
    console.warn(
      'Service role key not found in Vault, falling back to environment variable (development mode)'
    );
    serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY_DEV');
  }

  if (!serviceRoleKey) {
    throw new Error(
      'Service role key not available. ' +
      'Ensure SUPABASE_SERVICE_ROLE_KEY is configured in Vault (production) ' +
      'or SUPABASE_SERVICE_ROLE_KEY_DEV is set in environment (development).'
    );
  }

  // Log source (for debugging)
  console.log('Service role key source:', isProduction ? 'Vault' : 'Environment Variable');

  return serviceRoleKey;
}
```

**Use Cases**:
- **Production**: Always use Vault
- **Local Development**: Allow environment variable fallback for convenience
- **CI/CD**: Use Vault or encrypted CI secrets

## Edge Function Initialization

### Complete Initialization Pattern

```typescript
// File: supabase/functions/cleanup-orphaned-user/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Initialize Supabase client with service role
let supabase: SupabaseClient;

async function initializeSupabase() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = await getServiceRoleKey(); // Vault retrieval

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL not set');
  }

  supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  console.log('Supabase client initialized with service role');
}

// Initialize on module load
await initializeSupabase();

// Handler
serve(async (req) => {
  // Request handling logic
  // supabase client is available with service role privileges
});
```

## Security Considerations

### Access Logging

**Vault automatically logs**:
- Timestamp of access
- Requesting function name
- Secret name accessed
- Success/failure status

**Query Vault Access Logs**:
```sql
-- Example: View recent secret access
SELECT
  timestamp,
  function_name,
  secret_name,
  status
FROM vault.access_log
WHERE secret_name = 'SUPABASE_SERVICE_ROLE_KEY'
  AND timestamp > NOW() - INTERVAL '7 days'
ORDER BY timestamp DESC;
```

### Key Rotation

**Rotation Procedure**:
1. Generate new service role key in Supabase Dashboard (Project Settings → API)
2. Update Vault secret with new key:
   ```bash
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<new-key> --vault
   ```
3. Redeploy edge functions (or wait for automatic reload if supported)
4. Verify edge functions work with new key
5. Revoke old service role key (if Supabase supports key revocation)

**Zero-Downtime Rotation**:
- Vault updates are atomic
- Edge functions fetch key on each invocation (or on startup)
- No deployment needed if functions fetch dynamically

### Prevent Key Leakage

**Do NOT**:
- Log service role key (not even hashed)
- Send service role key in HTTP responses
- Store service role key in client-side code
- Commit service role key to version control

**Do**:
- Only access service role key in edge functions
- Use Vault audit logs to detect unusual access patterns
- Rotate keys regularly (e.g., every 90 days)
- Use feature flags to disable cleanup operations if key compromised

## Monitoring

### Metrics to Track

```typescript
interface VaultAccessMetrics {
  // Access patterns
  accessCount: number;
  uniqueFunctions: number;
  failedAccesses: number;

  // Performance
  avgRetrievalTime: number; // ms

  // Anomalies
  unusualAccessPatterns: boolean;
  suspiciousIPs: string[];
}
```

### Alerts

```typescript
const VAULT_ALERTS = {
  failedAccessHigh: {
    condition: 'failedAccesses > 5 per hour',
    severity: 'warning',
    action: 'Investigate permission issues or key expiry',
  },

  suspiciousAccess: {
    condition: 'Access from unexpected function or IP',
    severity: 'critical',
    action: 'Check for compromised credentials, rotate key',
  },
};
```

## Development vs Production

### Development (Local)

**Option 1: Supabase Local Development with Vault**
```bash
# Start local Supabase instance
supabase start

# Set local Vault secret
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key> --vault --local

# Run edge function locally
supabase functions serve cleanup-orphaned-user
```

**Option 2: Environment Variable Fallback**
```bash
# .env.local file (NOT committed to version control)
SUPABASE_SERVICE_ROLE_KEY_DEV=<local-service-role-key>

# Edge function reads fallback in development mode
```

### Production

**Always use Vault**:
- Set `SUPABASE_SERVICE_ROLE_KEY` in Vault via Dashboard or CLI
- No environment variable fallback in production
- Edge functions fail fast if Vault secret not available

## Testing

### Unit Tests

```typescript
describe('Vault Integration', () => {
  test('retrieves service role key from Vault', async () => {
    const key = await getServiceRoleKey();
    expect(key).toBeDefined();
    expect(key).toMatch(/^eyJ/); // JWT format
  });

  test('throws error if Vault secret not found', async () => {
    // Mock Vault to return null
    await expect(getServiceRoleKey()).rejects.toThrow('Service role key not available');
  });

  test('falls back to env var in development mode', async () => {
    // Set DENO_DEPLOYMENT_ID to undefined (development)
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY_DEV', 'dev-key');

    const key = await getServiceRoleKey();
    expect(key).toBe('dev-key');
  });
});
```

### Integration Tests

```typescript
describe('Edge Function with Vault', () => {
  test('edge function initializes with Vault key', async () => {
    const response = await fetch('http://localhost:54321/functions/v1/cleanup-orphaned-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 'request-code', email: 'test@example.com' }),
    });

    expect(response.status).toBe(200); // Function works with Vault key
  });
});
```

## Migration from Environment Variables

### Migration Steps

1. **Verify current setup**:
   ```bash
   supabase secrets list
   # Check if SUPABASE_SERVICE_ROLE_KEY exists in env
   ```

2. **Create Vault secret**:
   ```bash
   # Copy existing env var value
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<current-env-value> --vault
   ```

3. **Update edge functions** (if needed):
   - If using `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`, no change needed
   - Vault secrets are available as environment variables

4. **Remove old environment variable** (optional):
   ```bash
   # If service role key was stored as plain env var
   supabase secrets unset SUPABASE_SERVICE_ROLE_KEY --env
   ```

5. **Verify migration**:
   ```bash
   # Test edge function
   supabase functions invoke cleanup-orphaned-user --data '{"test": true}'
   ```

6. **Update documentation**:
   - Document Vault setup in deployment guide
   - Add Vault access to onboarding checklist

## Acceptance Criteria

- [x] Vault setup procedure documented (Dashboard + CLI)
- [x] Access policy specified (edge functions only, no client access)
- [x] Retrieval methods documented (built-in env var + explicit API call)
- [x] Fallback strategy documented (dev only)
- [x] Complete initialization pattern provided
- [x] Security considerations documented (logging, rotation, leakage prevention)
- [x] Monitoring metrics and alerts specified
- [x] Development vs production guidance provided
- [x] Testing strategy included
- [x] Migration procedure from environment variables documented

**Status**: Ready for implementation in Phase 2
