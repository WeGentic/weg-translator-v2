# Registration Recovery API Documentation

## Overview

This document describes the enhanced API endpoints and data structures used in the Tr-entic Desktop registration recovery flow. The system provides robust mechanisms for detecting and cleaning up orphaned Supabase Auth users through a two-step verification process.

**Last Updated**: 2025-10-27
**Version**: 1.0.0
**Status**: Phase 2 Complete

---

## Table of Contents

1. [Enhanced check-email-status Endpoint](#enhanced-check-email-status-endpoint)
2. [cleanup-orphaned-user Endpoint](#cleanup-orphaned-user-endpoint)
3. [State Matrix](#state-matrix)
4. [Error Codes](#error-codes)
5. [Security Considerations](#security-considerations)

---

## Enhanced check-email-status Endpoint

### Endpoint Details

**URL**: `https://[project-ref].supabase.co/functions/v1/check-email-status`
**Method**: `POST`
**Authentication**: Not required (unauthenticated endpoint)
**Content-Type**: `application/json`

### Purpose

The `check-email-status` endpoint determines if an email address is registered in the Supabase Auth system and provides extended information about the user's registration state, including whether they are "orphaned" (verified in auth but missing company data).

### Request Schema

```json
{
  "email": "user@example.com"
}
```

**Field Definitions**:
- `email` (string, required): Email address to check (case-insensitive)

### Response Schema (Enhanced - Phase 2)

```json
{
  "data": {
    "status": "not_registered" | "registered_unverified" | "registered_verified",
    "verifiedAt": "2025-10-27T10:00:00Z" | null,
    "lastSignInAt": "2025-10-27T09:00:00Z" | null,
    "hasCompanyData": true | false | null,
    "isOrphaned": true | false | null,
    "correlationId": "uuid-string"
  }
}
```

**Field Definitions**:
- `status` (string, required): User registration status in auth.users
  - `not_registered`: Email not found in auth.users
  - `registered_unverified`: User exists but has not confirmed email
  - `registered_verified`: User exists and has confirmed email
- `verifiedAt` (string | null, optional): ISO 8601 timestamp of email verification
- `lastSignInAt` (string | null, optional): ISO 8601 timestamp of last sign-in
- `hasCompanyData` (boolean | null, optional): **Phase 2 Enhancement**
  - `true`: User has company data (owner_admin_uuid exists in companies table)
  - `false`: User has no company data (orphaned state)
  - `null`: Database query failed/timed out (graceful degradation)
- `isOrphaned` (boolean | null, optional): **Phase 2 Enhancement**
  - `true`: User is orphaned (verified in auth but no company data)
  - `false`: User is not orphaned (not registered OR has company data)
  - `null`: Cannot determine (hasCompanyData is null)
- `correlationId` (string, required): Request correlation ID for tracing

### State Matrix

The following table defines all possible states and their corresponding field values:

| Status | Email Verified | Has Company Data | Is Orphaned | Classification | Description |
|--------|----------------|------------------|-------------|----------------|-------------|
| `not_registered` | N/A | false | false | Normal | Email not found in auth.users |
| `registered_unverified` | No | false | **true** | **Case 1.1** | User started registration but never verified email (orphaned) |
| `registered_unverified` | No | true | false | Unexpected | User has company data but email not verified (should not occur) |
| `registered_verified` | Yes | false | **true** | **Case 1.2** | User verified email but registration flow interrupted (orphaned) |
| `registered_verified` | Yes | true | false | Normal | Fully registered user with complete data |
| Any | Any | null | null | Degraded | Database query failed or timed out (graceful degradation) |

**Key Orphan States**:
- **Case 1.1 (Orphaned Unverified)**: User registered but never verified email. No company data created.
- **Case 1.2 (Orphaned Verified)**: User verified email but registration flow was interrupted before company data creation.

### Example Responses

#### Example 1: Not Registered

**Request**:
```json
{
  "email": "newuser@example.com"
}
```

**Response**:
```json
{
  "data": {
    "status": "not_registered",
    "verifiedAt": null,
    "lastSignInAt": null,
    "hasCompanyData": false,
    "isOrphaned": false,
    "correlationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
}
```

#### Example 2: Case 1.1 - Orphaned Unverified User

**Request**:
```json
{
  "email": "unverified@example.com"
}
```

**Response**:
```json
{
  "data": {
    "status": "registered_unverified",
    "verifiedAt": null,
    "lastSignInAt": null,
    "hasCompanyData": false,
    "isOrphaned": true,
    "correlationId": "b2c3d4e5-f6a7-8901-bcde-f12345678901"
  }
}
```

**Interpretation**: User started registration but never verified their email. The cleanup flow should be initiated to allow re-registration.

#### Example 3: Case 1.2 - Orphaned Verified User

**Request**:
```json
{
  "email": "verified@example.com"
}
```

**Response**:
```json
{
  "data": {
    "status": "registered_verified",
    "verifiedAt": "2025-10-20T14:30:00.000Z",
    "lastSignInAt": null,
    "hasCompanyData": false,
    "isOrphaned": true,
    "correlationId": "c3d4e5f6-a7b8-9012-cdef-123456789012"
  }
}
```

**Interpretation**: User verified their email but the registration flow was interrupted before company data was created. The cleanup flow should be initiated.

#### Example 4: Fully Registered User

**Request**:
```json
{
  "email": "active@example.com"
}
```

**Response**:
```json
{
  "data": {
    "status": "registered_verified",
    "verifiedAt": "2025-10-15T10:00:00.000Z",
    "lastSignInAt": "2025-10-27T08:45:00.000Z",
    "hasCompanyData": true,
    "isOrphaned": false,
    "correlationId": "d4e5f6a7-b8c9-0123-def1-234567890123"
  }
}
```

**Interpretation**: User has completed full registration with company data. No cleanup needed.

#### Example 5: Graceful Degradation (Database Query Timeout)

**Request**:
```json
{
  "email": "user@example.com"
}
```

**Response**:
```json
{
  "data": {
    "status": "registered_verified",
    "verifiedAt": "2025-10-25T12:00:00.000Z",
    "lastSignInAt": "2025-10-26T18:30:00.000Z",
    "hasCompanyData": null,
    "isOrphaned": null,
    "correlationId": "e5f6a7b8-c9d0-1234-ef12-345678901234"
  }
}
```

**Interpretation**: Database query for company data timed out after 100ms. Cannot determine orphan state. Frontend should treat as "unknown" and allow user to proceed with standard flows.

### Performance Characteristics

- **Target Response Time**: <200ms at p95
- **Company Query Timeout**: 100ms maximum
- **Expected Query Time**: <50ms at p95 (indexed column lookup)
- **Graceful Degradation**: Returns null values on timeout/error to prevent blocking

### Backward Compatibility

All Phase 2 enhancements (hasCompanyData, isOrphaned) are **backward compatible**:
- New fields are optional in the response schema
- Existing clients that only check `status` field continue to work without changes
- Graceful degradation ensures function never fails due to new fields
- Frontend code can safely access new fields with optional chaining

---

## cleanup-orphaned-user Endpoint

### Endpoint Details

**URL**: `https://[project-ref].supabase.co/functions/v1/cleanup-orphaned-user`
**Method**: `POST`
**Authentication**: Not required (unauthenticated endpoint with verification code)
**Content-Type**: `application/json`

### Purpose

The `cleanup-orphaned-user` endpoint provides a two-step flow for securely deleting orphaned Supabase Auth users:
1. **Step 1 (request-code)**: Validates orphan state and sends verification code via email
2. **Step 2 (validate-and-cleanup)**: Validates verification code and deletes auth user

### Security Features

- **Hash-based verification codes**: Codes stored as SHA-256 hashes with random salt
- **Constant-time comparison**: Prevents timing attacks on code validation
- **Multi-tier rate limiting**: Global (1000/min), IP (5/min), Email (3/hour)
- **Distributed locking**: Prevents concurrent deletion race conditions
- **Constant-time responses**: 500ms ±50ms jitter for all responses
- **Comprehensive audit trail**: All operations logged to auth_cleanup_log table

### Step 1: Request Verification Code

#### Request Schema

```json
{
  "step": "request-code",
  "email": "orphaned@example.com"
}
```

**Field Definitions**:
- `step` (string, required): Must be `"request-code"`
- `email` (string, required): Email address of orphaned user (case-insensitive)

#### Response Schema (Success)

```json
{
  "success": true,
  "correlationId": "f6a7b8c9-d0e1-2345-f123-456789012345",
  "data": {
    "step": "code-sent",
    "message": "A verification code has been sent to your email address. Please check your inbox and enter the code to complete account cleanup."
  }
}
```

**Field Definitions**:
- `success` (boolean): Always `true` for successful requests
- `correlationId` (string): Request correlation ID for tracing
- `data.step` (string): Always `"code-sent"` for step 1 success
- `data.message` (string): User-friendly success message

#### Response Schema (Error)

```json
{
  "success": false,
  "correlationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "error": {
    "code": "ORPHAN_CLEANUP_005",
    "message": "User has associated data and cannot be deleted",
    "httpStatus": 400
  }
}
```

**Field Definitions**:
- `success` (boolean): Always `false` for errors
- `correlationId` (string): Request correlation ID for tracing
- `error.code` (string): Error code constant (see Error Codes section)
- `error.message` (string): User-friendly error message
- `error.httpStatus` (number): HTTP status code

#### Flow and Validations

1. **Rate Limit Check**: Enforces IP (5/min), Email (3/hour), Global (1000/min) limits
2. **Lock Acquisition**: Acquires distributed lock to prevent concurrent operations
3. **Auth User Lookup**: Queries Supabase Auth to verify user exists
4. **Orphan State Validation**: Queries `companies` and `company_admins` tables to confirm no data exists
5. **Code Generation**: Generates 6-digit CSPRNG code
6. **Code Storage**: Stores hashed code in Deno KV with 10-minute TTL
7. **Email Delivery**: Sends verification email via Resend or SendGrid
8. **Audit Logging**: Inserts record to `auth_cleanup_log` table
9. **Lock Release**: Releases distributed lock
10. **Constant-Time Response**: Enforces 500ms ±50ms response time

### Step 2: Validate Code and Delete User

#### Request Schema

```json
{
  "step": "validate-and-cleanup",
  "email": "orphaned@example.com",
  "verificationCode": "123456"
}
```

**Field Definitions**:
- `step` (string, required): Must be `"validate-and-cleanup"`
- `email` (string, required): Email address of orphaned user (case-insensitive)
- `verificationCode` (string, required): 6-digit numeric code from email

#### Response Schema (Success)

```json
{
  "success": true,
  "correlationId": "g7h8i9j0-k1l2-3456-m789-012345678901",
  "data": {
    "step": "user-deleted",
    "deletedUserId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "orphanClassification": "case_1_2",
    "message": "Your account has been successfully deleted. You can now register again with the same email address."
  }
}
```

**Field Definitions**:
- `success` (boolean): Always `true` for successful deletions
- `correlationId` (string): Request correlation ID for tracing
- `data.step` (string): Always `"user-deleted"` for step 2 success
- `data.deletedUserId` (string): UUID of deleted auth user
- `data.orphanClassification` (string): `"case_1_1"` or `"case_1_2"`
- `data.message` (string): User-friendly success message

#### Response Schema (Error)

Same error format as Step 1.

#### Flow and Validations

1. **Rate Limit Check**: Enforces IP (5/min), Email (3/hour), Global (1000/min) limits
2. **Lock Acquisition**: Acquires distributed lock to prevent concurrent operations
3. **Code Validation**: Retrieves hashed code from Deno KV and uses constant-time comparison
4. **Auth User Lookup**: Queries Supabase Auth to verify user still exists
5. **Orphan State Re-verification**: Re-checks `companies` and `company_admins` tables (prevents race condition)
6. **User Deletion**: Deletes auth user via `supabase.auth.admin.deleteUser()`
7. **Audit Logging**: Updates `auth_cleanup_log` entry with completion timestamp
8. **Code Deletion**: Deletes verification code from Deno KV (single-use enforcement)
9. **Lock Release**: Releases distributed lock
10. **Constant-Time Response**: Enforces 500ms ±50ms response time

### Rate Limiting

The cleanup endpoint enforces three-tier hierarchical rate limiting:

| Tier | Window | Limit | Scope |
|------|--------|-------|-------|
| Global | 60 seconds | 1000 requests | All requests to endpoint |
| IP | 60 seconds | 5 requests | Per client IP address |
| Email | 60 minutes | 3 requests | Per email address (request-code only) |

**Rate Limit Headers**:
- `X-RateLimit-Limit`: Maximum requests allowed in window
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when window resets
- `Retry-After`: Seconds to wait before retry (only in 429 responses)

**Example Rate Limit Exceeded Response**:
```json
{
  "success": false,
  "correlationId": "h8i9j0k1-l2m3-4567-n890-123456789012",
  "error": {
    "code": "ORPHAN_CLEANUP_003",
    "message": "Rate limit exceeded. Too many requests from this IP address. Please try again later.",
    "httpStatus": 429
  }
}
```

**HTTP Response Headers**:
```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1730040000
Retry-After: 45
```

### Distributed Locking

The endpoint uses Deno KV atomic operations for distributed locking:
- **Lock Key**: `['cleanup-lock', email.toLowerCase()]`
- **Lock TTL**: 30 seconds (automatic expiration)
- **Lock Strategy**: Fail-fast (returns error if lock held)
- **Concurrent Operations**: Returns `ORPHAN_CLEANUP_009` if another operation in progress

---

## Error Codes

All error responses follow the same structure:

```json
{
  "success": false,
  "correlationId": "uuid-string",
  "error": {
    "code": "ORPHAN_CLEANUP_XXX",
    "message": "User-friendly error message",
    "httpStatus": 400
  }
}
```

### Error Code Reference

| Code | HTTP Status | Message | Description |
|------|-------------|---------|-------------|
| `ORPHAN_CLEANUP_001` | 400 | Invalid request body. Please check your input and try again. | Request body failed Zod validation |
| `ORPHAN_CLEANUP_002` | 400 | Invalid verification code. Please check the code and try again. | Submitted code doesn't match stored hash |
| `ORPHAN_CLEANUP_003` | 429 | Rate limit exceeded. Too many requests from this IP address. Please try again later. | Rate limit exceeded on IP, Email, or Global tier |
| `ORPHAN_CLEANUP_004` | 404 | User not found. The account may have been deleted already. | Email not found in auth.users |
| `ORPHAN_CLEANUP_005` | 400 | User has associated data and cannot be deleted. | User has company data (not orphaned) |
| `ORPHAN_CLEANUP_006` | 500 | An unexpected error occurred. Please try again later. | Database error, timeout, or unexpected exception |
| `ORPHAN_CLEANUP_007` | 400 | Invalid request body. Please check your input and try again. | Missing required fields or invalid format |
| `ORPHAN_CLEANUP_008` | 500 | Failed to send verification email. Please try again later. | Email delivery failed after 3 retries |
| `ORPHAN_CLEANUP_009` | 409 | Operation already in progress for this email. Please wait and try again. | Distributed lock held by another request |

---

## Security Considerations

### Email Enumeration Prevention

Both endpoints implement constant-time response patterns (500ms ±50ms jitter) to prevent attackers from determining:
- Whether an email exists in auth.users
- Whether a submitted verification code is closer to the correct value
- Orphan state classification based on query execution times

### Hash-Based Verification Codes

Verification codes are stored as SHA-256 hashes with random salt:
- **CSPRNG**: Codes generated using `crypto.getRandomValues()` for cryptographic security
- **Random Salt**: 16-byte salt ensures unique hashes even for same code
- **Constant-Time Comparison**: `constantTimeEquals()` prevents timing attacks on code validation
- **Single-Use**: Codes deleted from Deno KV after successful validation
- **TTL**: Codes automatically expire after 10 minutes

### Privacy Protection

All personally identifiable information is hashed before logging:
- **Email Addresses**: SHA-256 hash stored in audit logs
- **IP Addresses**: SHA-256 hash stored in audit logs
- **Correlation IDs**: UUID-based for request tracing without PII

### Audit Trail

All operations are logged to the `auth_cleanup_log` table:
- Request initiation (step 1)
- Verification code validation (step 2)
- User deletion success/failure
- Error conditions and messages
- Correlation IDs for end-to-end tracing

### Rate Limiting Security

Multi-tier rate limiting prevents abuse:
- **Global Tier**: Protects edge function from DoS attacks
- **IP Tier**: Prevents individual clients from overwhelming system
- **Email Tier**: Prevents verification code spam to specific users

---

## Integration Guide

### Frontend Integration

#### Step 1: Check Email Status

```typescript
const response = await fetch('https://[project-ref].supabase.co/functions/v1/check-email-status', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com' })
});

const { data } = await response.json();

if (data.isOrphaned === true) {
  // User is orphaned - initiate cleanup flow
  console.log('Orphan detected:', data.status);
  // Proceed to Step 2: Request cleanup code
}
```

#### Step 2: Request Cleanup Code

```typescript
const response = await fetch('https://[project-ref].supabase.co/functions/v1/cleanup-orphaned-user', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    step: 'request-code',
    email: 'orphaned@example.com'
  })
});

const { success, correlationId, data, error } = await response.json();

if (success) {
  console.log('Verification code sent:', correlationId);
  // Show UI for user to enter code
} else {
  console.error('Error:', error.message);
  // Handle error (rate limit, user not found, etc.)
}
```

#### Step 3: Validate Code and Delete User

```typescript
const response = await fetch('https://[project-ref].supabase.co/functions/v1/cleanup-orphaned-user', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    step: 'validate-and-cleanup',
    email: 'orphaned@example.com',
    verificationCode: '123456'
  })
});

const { success, data, error } = await response.json();

if (success) {
  console.log('User deleted:', data.deletedUserId);
  // Allow user to re-register with same email
} else {
  console.error('Error:', error.message);
  // Handle error (invalid code, rate limit, etc.)
}
```

---

## Version History

### Version 1.0.0 (2025-10-27)

**Phase 1: Foundation - Database Schema and Core Edge Function**
- Created `auth_cleanup_log` table for audit trail
- Implemented `cleanup-orphaned-user` edge function with two-step flow
- Added hash-based verification code system with constant-time comparison
- Implemented multi-tier rate limiting with sliding window algorithm
- Added distributed locking for concurrent deletion prevention
- Implemented constant-time response pattern (500ms ±50ms jitter)
- Created retention policy for cleanup log (12-month retention)

**Phase 2: Enhanced Email Status Probe**
- Extended `check-email-status` endpoint with database queries
- Added `hasCompanyData` field to response (queries companies table)
- Added `isOrphaned` field to response (orphan state classification)
- Implemented state matrix for Case 1.1 and Case 1.2 detection
- Maintained backward compatibility with existing clients
- Added graceful degradation on database query timeout (100ms)

---

## Support

For questions or issues with the registration recovery API:
- **Documentation**: See `/docs/registration-recovery-api.md`
- **Architecture**: See `/plans/registration-flow-improvement/registration-flow-improvement_Design.md`
- **Task List**: See `/plans/registration-flow-improvement/registration-flow-improvement_TaskList.md`
- **Report**: See `/plans/registration-flow-improvement/registration-flow-improvement_Report.md`

---

**Document End**
