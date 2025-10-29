# User Input - Registration Edge Case Fix

## Project Name
`registration-edge-case-fix`

## User Request

Assess current Registration flow and evaluate if it correctly adheres to the following requirements. If not, fix/improve it:

### Edge Cases to Handle

1. **Registration Failure Scenarios**:
   - **Case 1.1**: User created but with Email NOT verified and with no database data
   - **Case 1.2**: User created with verified email but with no database data

2. **Edge Case Resolution**:

   **A. User Tries to Login (Cases 1.1 and 1.2)**:
   - Create an Edge function that can run WITH NO AUTH session
   - Delete the orphaned user
   - Redirect user to Registration Page
   - Notify the user of what is happening

   **B. User Tries to Register Again**:
   - When checking the admin email with current Edge function:
     - **Case 1.1**: Check if related user data exists in Supabase → IF NOT → proceed with Email verification and then with storage of newly entered data
     - **Case 1.2**: Check if related user data exists in Supabase → IF NOT → proceed with storage of newly entered data

## Key Objectives

1. Identify orphaned user accounts (users without complete registration data)
2. Provide automatic cleanup mechanism for orphaned accounts
3. Allow users to complete registration after initial failure
4. Ensure proper user experience with clear notifications
5. Maintain security (no auth session required for cleanup)

## Success Metrics

- No orphaned user accounts remain in the system
- Users can successfully retry registration after failure
- Clear user notifications during recovery process
- Secure cleanup process without requiring authentication

## Constraints

- Must work without authenticated session for cleanup
- Must integrate with existing Supabase authentication
- Must maintain data integrity
- Must provide good UX during error recovery
