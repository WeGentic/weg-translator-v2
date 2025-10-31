# Requirements Document (CORRECT)

## Introduction

This document defines the requirements for implementing the B2B multi-tenant authentication system migration for the Tr-entic Desktop application. The goal is to adapt the existing Login/Registration code (both Backend and Frontend) to work with the deployed Supabase schema consisting of `public.accounts`, `public.users`, and `public.subscriptions` tables.

## Glossary

- **Account**: A company or organization entity in the system (stored in `public.accounts`)
- **User**: An individual user within an account (stored in `public.users`, layered on `auth.users`)
- **account_uuid**: Unique identifier for an account, included in JWT claims for RLS enforcement
- **user_role**: Role of a user within their account (owner, admin, member, viewer)
- **RLS**: Row Level Security - PostgreSQL feature enforcing data access policies at the database level
- **JWT**: JSON Web Token containing user identity and custom claims
- **create_account_with_admin**: Supabase function that atomically creates account + first user + subscription
- **Orphan Detection**: Process to verify users have valid account associations

## Requirements

### Requirement 1

**User Story:** As a new user, I want to register by providing company information and admin credentials so that an account is created for my organization with me as the owner.

#### Acceptance Criteria

1. WHEN a user submits the registration form, THE System SHALL call the create_account_with_admin() Supabase function with normalized company and admin data
2. WHEN account creation succeeds, THE System SHALL return account UUID, user UUID, subscription UUID, and user role in the response
3. WHEN account creation fails due to duplicate email, THE System SHALL display "This email is already registered with an account. Please log in."
4. WHEN account creation fails due to network error, THE System SHALL display "Connection error. Please check your internet and try again."
5. WHEN account creation succeeds, THE System SHALL automatically provision a 14-day trial subscription for the new account

### Requirement 2

**User Story:** As a returning user, I want to log in with my email and password so that I can access my company's account with proper role-based permissions.

#### Acceptance Criteria

1. WHEN a user logs in successfully, THE System SHALL extract account_uuid and user_role from JWT custom claims
2. WHEN account_uuid is missing from JWT claims, THE System SHALL block login and display "Unable to validate account information. Please contact support."
3. WHEN user_role is missing from JWT claims, THE System SHALL default to 'member' role and log a warning
4. WHEN JWT claims are valid, THE System SHALL update the auth context with accountUuid and userRole fields
5. WHEN login completes, THE System SHALL run orphan detection to verify the user has valid account association

### Requirement 3

**User Story:** As a system, I want to detect orphaned users during login so that I can prevent unauthorized access and guide users to recovery.

#### Acceptance Criteria

1. WHEN orphan detection runs, THE System SHALL query the public.users table filtering by the authenticated user ID
2. WHEN no user record is found, THE System SHALL classify the user as orphaned and redirect to recovery
3. WHEN user record exists but account_id doesn't match JWT claim, THE System SHALL throw a security violation error
4. WHEN orphan detection fails or times out, THE System SHALL block login with fail-closed policy
5. WHEN orphan detection succeeds, THE System SHALL allow login to proceed

### Requirement 4

**User Story:** As a developer, I want TypeScript types that match the deployed Supabase schema so that I have type safety across queries and mutations.

#### Acceptance Criteria

1. THE System SHALL define Account interface with fields: id, company_name, company_email, company_phone, company_address, timezone, is_active, settings, created_at, modified_at, deleted_at
2. THE System SHALL define User interface with fields: user_uuid, account_uuid, role, username, first_name, last_name, phone, user_email, avatar, is_active, last_login_at, invited_at, invited_by, created_at, modified_at, deleted_at
3. THE System SHALL define Subscription interface with fields: subscription_uuid, account_uuid, subscription_type, status, expires_at, trial_ends_at, cancelled_at, payment_type, payment_id, created_at, modified_at, deleted_at
4. THE System SHALL define MemberRole type as union: 'owner' | 'admin' | 'member' | 'viewer'
5. THE System SHALL export all types from shared/types/database.ts

### Requirement 5

**User Story:** As a system, I want to maintain backward compatibility with existing desktop features so that local SQLite profile sync continues to work.

#### Acceptance Criteria

1. WHEN user registration or login succeeds, THE System SHALL sync user profile data to local SQLite including account context
2. WHEN profile sync fails, THE System SHALL log the error but not block the authentication flow
3. WHEN profile data is synced, THE System SHALL include accountUuid and userRole fields for future use
4. WHEN existing desktop features query local profiles, THE System SHALL continue to work without modification
5. WHEN user logs out, THE System SHALL clear account context from both auth state and local profile