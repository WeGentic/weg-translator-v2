# check-email-status Edge Function

## Deploy

```bash
supabase functions deploy check-email-status \
  --project-ref "$SUPABASE_PROJECT_REF" \
  --no-verify-jwt
```

> **Note:** `supabase/config.toml` also declares `[functions.check-email-status] verify_jwt = false` so the function remains accessible if deployment scripts omit `--no-verify-jwt`.

## Environment

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Both variables must be present before the function can service requests. Locally, run tests with:

```bash
deno test --allow-env supabase/functions/check-email-status/index.test.ts
```
