# Supabase Configuration Notes

## Edge Function: `check-email-status`

- Requires the standard service-role credentials:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Uses Deno KV for per-IP rate limiting. No extra environment variables are needed, but Supabase projects must have KV enabled (default for Edge Functions).

## Deployment

```bash
supabase functions deploy check-email-status \
  --project-ref "$SUPABASE_PROJECT_REF" \
  --no-verify-jwt
```

## Testing

- Run unit tests with Deno permissions:

  ```bash
  deno test --allow-env supabase/functions/check-email-status/index.test.ts
  ```

- Local rate limiting logic relies on Deno KV. The test suite injects an in-memory mock, no additional setup required.
