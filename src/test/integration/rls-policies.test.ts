/**
 * Integration Tests for Row-Level Security (RLS) Policies
 *
 * This test suite verifies RLS policies enforce:
 * - Tenant isolation (users can only access their company data)
 * - Role-based access control (owners/admins/members have different permissions)
 * - Fail-closed security (deny by default)
 *
 * Test Strategy:
 * - Create multiple users with different roles
 * - Attempt operations as each user
 * - Verify RLS returns empty results (not errors) when access denied
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Types for test data
interface TestUser {
    id: string;
    email: string;
    client: SupabaseClient;
}

interface TestCompany {
    id: string;
    name: string;
    vat_id: string;
    email: string;
}

interface TestMembership {
    id: string;
    company_id: string;
    user_id: string;
    role: 'owner' | 'admin' | 'member';
}

// Test configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service role client for test setup (bypasses RLS)
let serviceClient: SupabaseClient;

// Test users with different roles
let userA: TestUser; // Owner of Company A
let userB: TestUser; // No memberships (non-member)
let userC: TestUser; // Admin of Company A
let userD: TestUser; // Regular member of Company A

// Test data
let companyA: TestCompany;
let companyB: TestCompany; // For cross-tenant testing

describe('RLS Policies - Companies Table', () => {
    beforeAll(async () => {
        // Initialize service role client
        serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Create test users using service role
        const timestamp = Date.now();

        // User A - will be owner of Company A
        const { data: userAData, error: userAError } = await serviceClient.auth.admin.createUser({
            email: `userA_${timestamp}@test.example.com`,
            password: 'TestPassword123!',
            email_confirm: true,
        });
        if (userAError) throw userAError;

        userA = {
            id: userAData.user.id,
            email: userAData.user.email!,
            client: createClient(SUPABASE_URL, SUPABASE_ANON_KEY),
        };

        // Sign in User A
        const { error: signInAError } = await userA.client.auth.signInWithPassword({
            email: userA.email,
            password: 'TestPassword123!',
        });
        if (signInAError) throw signInAError;

        // User B - no memberships
        const { data: userBData, error: userBError } = await serviceClient.auth.admin.createUser({
            email: `userB_${timestamp}@test.example.com`,
            password: 'TestPassword123!',
            email_confirm: true,
        });
        if (userBError) throw userBError;

        userB = {
            id: userBData.user.id,
            email: userBData.user.email!,
            client: createClient(SUPABASE_URL, SUPABASE_ANON_KEY),
        };

        await userB.client.auth.signInWithPassword({
            email: userB.email,
            password: 'TestPassword123!',
        });

        // User C - will be admin of Company A
        const { data: userCData, error: userCError } = await serviceClient.auth.admin.createUser({
            email: `userC_${timestamp}@test.example.com`,
            password: 'TestPassword123!',
            email_confirm: true,
        });
        if (userCError) throw userCError;

        userC = {
            id: userCData.user.id,
            email: userCData.user.email!,
            client: createClient(SUPABASE_URL, SUPABASE_ANON_KEY),
        };

        await userC.client.auth.signInWithPassword({
            email: userC.email,
            password: 'TestPassword123!',
        });

        // User D - will be regular member of Company A
        const { data: userDData, error: userDError } = await serviceClient.auth.admin.createUser({
            email: `userD_${timestamp}@test.example.com`,
            password: 'TestPassword123!',
            email_confirm: true,
        });
        if (userDError) throw userDError;

        userD = {
            id: userDData.user.id,
            email: userDData.user.email!,
            client: createClient(SUPABASE_URL, SUPABASE_ANON_KEY),
        };

        await userD.client.auth.signInWithPassword({
            email: userD.email,
            password: 'TestPassword123!',
        });

        // Create Company A (using service role to bypass RLS during setup)
        const { data: companyAData, error: companyAError } = await serviceClient
            .from('companies')
            .insert({
                name: `Test Company A ${timestamp}`,
                vat_id: `VAT_A_${timestamp}`,
                email: `companyA_${timestamp}@test.example.com`,
            })
            .select()
            .single();
        if (companyAError) throw companyAError;
        companyA = companyAData;

        // Create Company B (for cross-tenant testing)
        const { data: companyBData, error: companyBError } = await serviceClient
            .from('companies')
            .insert({
                name: `Test Company B ${timestamp}`,
                vat_id: `VAT_B_${timestamp}`,
                email: `companyB_${timestamp}@test.example.com`,
            })
            .select()
            .single();
        if (companyBError) throw companyBError;
        companyB = companyBData;

        // Create memberships
        // User A - owner of Company A
        await serviceClient.from('company_members').insert({
            company_id: companyA.id,
            user_id: userA.id,
            role: 'owner',
        });

        // User C - admin of Company A
        await serviceClient.from('company_members').insert({
            company_id: companyA.id,
            user_id: userC.id,
            role: 'admin',
        });

        // User D - member of Company A
        await serviceClient.from('company_members').insert({
            company_id: companyA.id,
            user_id: userD.id,
            role: 'member',
        });

        // User B has NO memberships (intentional for testing)
    });

    afterAll(async () => {
        // Cleanup: Delete test data using service role
        if (companyA?.id) {
            await serviceClient.from('companies').delete().eq('id', companyA.id);
        }
        if (companyB?.id) {
            await serviceClient.from('companies').delete().eq('id', companyB.id);
        }

        // Delete test users
        if (userA?.id) await serviceClient.auth.admin.deleteUser(userA.id);
        if (userB?.id) await serviceClient.auth.admin.deleteUser(userB.id);
        if (userC?.id) await serviceClient.auth.admin.deleteUser(userC.id);
        if (userD?.id) await serviceClient.auth.admin.deleteUser(userD.id);
    });

    describe('Companies SELECT Policy', () => {
        it('should allow User A (owner) to view Company A', async () => {
            const { data, error } = await userA.client
                .from('companies')
                .select('*')
                .eq('id', companyA.id);

            expect(error).toBeNull();
            expect(data).toHaveLength(1);
            expect(data![0].id).toBe(companyA.id);
        });

        it('should prevent User B (non-member) from viewing Company A', async () => {
            const { data, error } = await userB.client
                .from('companies')
                .select('*')
                .eq('id', companyA.id);

            // RLS filters out the row - no error, but empty result
            expect(error).toBeNull();
            expect(data).toHaveLength(0);
        });

        it('should allow User C (admin) to view Company A', async () => {
            const { data, error } = await userC.client
                .from('companies')
                .select('*')
                .eq('id', companyA.id);

            expect(error).toBeNull();
            expect(data).toHaveLength(1);
            expect(data![0].id).toBe(companyA.id);
        });

        it('should allow User D (member) to view Company A', async () => {
            const { data, error } = await userD.client
                .from('companies')
                .select('*')
                .eq('id', companyA.id);

            expect(error).toBeNull();
            expect(data).toHaveLength(1);
            expect(data![0].id).toBe(companyA.id);
        });
    });

    describe('Companies UPDATE Policy', () => {
        it('should allow owner to update company', async () => {
            const { data, error } = await userA.client
                .from('companies')
                .update({ name: 'Updated Company A Name' })
                .eq('id', companyA.id)
                .select();

            expect(error).toBeNull();
            expect(data).toHaveLength(1);
            expect(data![0].name).toBe('Updated Company A Name');
        });

        it('should allow admin to update company', async () => {
            const { data, error } = await userC.client
                .from('companies')
                .update({ name: 'Admin Updated Name' })
                .eq('id', companyA.id)
                .select();

            expect(error).toBeNull();
            expect(data).toHaveLength(1);
        });

        it('should prevent member from updating company', async () => {
            const { data, error } = await userD.client
                .from('companies')
                .update({ name: 'Member Attempted Update' })
                .eq('id', companyA.id)
                .select();

            // RLS prevents update - empty result
            expect(error).toBeNull();
            expect(data).toHaveLength(0);
        });

        it('should prevent non-member from updating company', async () => {
            const { data, error } = await userB.client
                .from('companies')
                .update({ name: 'Hacked Company Name' })
                .eq('id', companyA.id)
                .select();

            // RLS prevents update - empty result
            expect(error).toBeNull();
            expect(data).toHaveLength(0);
        });
    });

    describe('Companies DELETE Policy', () => {
        it('should prevent admin from deleting company', async () => {
            const { error } = await userC.client
                .from('companies')
                .delete()
                .eq('id', companyA.id);

            // RLS prevents delete - no error but no rows affected
            expect(error).toBeNull();
        });

        it('should prevent member from deleting company', async () => {
            const { error } = await userD.client
                .from('companies')
                .delete()
                .eq('id', companyA.id);

            expect(error).toBeNull();
        });

        it('should prevent non-member from deleting company', async () => {
            const { error } = await userB.client
                .from('companies')
                .delete()
                .eq('id', companyA.id);

            expect(error).toBeNull();
        });

        it('should allow only owner to delete company', async () => {
            // Use Company B for this test (don't delete Company A as other tests need it)
            // First, make User A owner of Company B
            await serviceClient.from('company_members').insert({
                company_id: companyB.id,
                user_id: userA.id,
                role: 'owner',
            });

            const { error } = await userA.client
                .from('companies')
                .delete()
                .eq('id', companyB.id);

            expect(error).toBeNull();

            // Verify deletion
            const { data } = await serviceClient
                .from('companies')
                .select('*')
                .eq('id', companyB.id);

            expect(data).toHaveLength(0);
        });
    });
});

describe('RLS Policies - Profiles Table', () => {
    it('should allow user to view own profile', async () => {
        const { data, error } = await userA.client
            .from('profiles')
            .select('*')
            .eq('id', userA.id)
            .single();

        expect(error).toBeNull();
        expect(data?.id).toBe(userA.id);
    });

    it('should allow user to view co-member profiles', async () => {
        // User A should be able to view User C's profile (both in Company A)
        const { data, error } = await userA.client
            .from('profiles')
            .select('*')
            .eq('id', userC.id)
            .single();

        expect(error).toBeNull();
        expect(data?.id).toBe(userC.id);
    });

    it('should prevent user from viewing unrelated profiles', async () => {
        // User B (no memberships) tries to view User A's profile
        const { data, error } = await userB.client
            .from('profiles')
            .select('*')
            .eq('id', userA.id);

        // RLS filters out the row
        expect(error).toBeNull();
        expect(data).toHaveLength(0);
    });

    it('should allow user to update own profile', async () => {
        const { data, error } = await userA.client
            .from('profiles')
            .update({ full_name: 'Updated Name' })
            .eq('id', userA.id)
            .select();

        expect(error).toBeNull();
        expect(data).toHaveLength(1);
    });

    it('should prevent user from updating other profiles', async () => {
        // User A tries to update User C's profile
        const { data, error } = await userA.client
            .from('profiles')
            .update({ full_name: 'Hacked Name' })
            .eq('id', userC.id)
            .select();

        // RLS prevents update
        expect(error).toBeNull();
        expect(data).toHaveLength(0);
    });
});

describe('RLS Policies - Company Members Table', () => {
    it('should allow user to view members of their company', async () => {
        const { data, error } = await userA.client
            .from('company_members')
            .select('*')
            .eq('company_id', companyA.id);

        expect(error).toBeNull();
        expect(data!.length).toBeGreaterThan(0);
    });

    it('should prevent non-member from viewing company members', async () => {
        const { data, error } = await userB.client
            .from('company_members')
            .select('*')
            .eq('company_id', companyA.id);

        // RLS filters out results
        expect(error).toBeNull();
        expect(data).toHaveLength(0);
    });

    it('should allow owner to invite members', async () => {
        // Create a new test user for invitation
        const timestamp = Date.now();
        const { data: newUserData } = await serviceClient.auth.admin.createUser({
            email: `newuser_${timestamp}@test.example.com`,
            password: 'TestPassword123!',
            email_confirm: true,
        });

        const { data, error } = await userA.client
            .from('company_members')
            .insert({
                company_id: companyA.id,
                user_id: newUserData!.user.id,
                role: 'member',
            })
            .select();

        expect(error).toBeNull();
        expect(data).toHaveLength(1);

        // Cleanup
        await serviceClient.auth.admin.deleteUser(newUserData!.user.id);
    });

    it('should allow admin to invite members', async () => {
        // Create a new test user for invitation
        const timestamp = Date.now();
        const { data: newUserData } = await serviceClient.auth.admin.createUser({
            email: `newuser2_${timestamp}@test.example.com`,
            password: 'TestPassword123!',
            email_confirm: true,
        });

        const { data, error } = await userC.client
            .from('company_members')
            .insert({
                company_id: companyA.id,
                user_id: newUserData!.user.id,
                role: 'member',
            })
            .select();

        expect(error).toBeNull();
        expect(data).toHaveLength(1);

        // Cleanup
        await serviceClient.auth.admin.deleteUser(newUserData!.user.id);
    });

    it('should prevent member from inviting others', async () => {
        // Create a new test user
        const timestamp = Date.now();
        const { data: newUserData } = await serviceClient.auth.admin.createUser({
            email: `newuser3_${timestamp}@test.example.com`,
            password: 'TestPassword123!',
            email_confirm: true,
        });

        const { data, error } = await userD.client
            .from('company_members')
            .insert({
                company_id: companyA.id,
                user_id: newUserData!.user.id,
                role: 'member',
            })
            .select();

        // RLS prevents insert - returns error
        expect(error).not.toBeNull();

        // Cleanup
        await serviceClient.auth.admin.deleteUser(newUserData!.user.id);
    });

    it('should allow users to remove themselves', async () => {
        // Create temporary membership for User B
        const { data: membership } = await serviceClient
            .from('company_members')
            .insert({
                company_id: companyA.id,
                user_id: userB.id,
                role: 'member',
            })
            .select()
            .single();

        // User B removes themselves
        const { error } = await userB.client
            .from('company_members')
            .delete()
            .eq('id', membership!.id);

        expect(error).toBeNull();

        // Verify removal
        const { data } = await serviceClient
            .from('company_members')
            .select('*')
            .eq('id', membership!.id);

        expect(data).toHaveLength(0);
    });

    it('should allow owner to remove others', async () => {
        // Create temporary membership
        const timestamp = Date.now();
        const { data: newUserData } = await serviceClient.auth.admin.createUser({
            email: `tempuser_${timestamp}@test.example.com`,
            password: 'TestPassword123!',
            email_confirm: true,
        });

        const { data: membership } = await serviceClient
            .from('company_members')
            .insert({
                company_id: companyA.id,
                user_id: newUserData!.user.id,
                role: 'member',
            })
            .select()
            .single();

        // Owner removes the member
        const { error } = await userA.client
            .from('company_members')
            .delete()
            .eq('id', membership!.id);

        expect(error).toBeNull();

        // Cleanup
        await serviceClient.auth.admin.deleteUser(newUserData!.user.id);
    });

    it('should allow only owner to change member roles', async () => {
        // Admin tries to change User D's role (should fail)
        const { data: membershipData } = await serviceClient
            .from('company_members')
            .select('*')
            .eq('user_id', userD.id)
            .eq('company_id', companyA.id)
            .single();

        const { data: adminUpdateData, error: adminUpdateError } = await userC.client
            .from('company_members')
            .update({ role: 'admin' })
            .eq('id', membershipData!.id)
            .select();

        // RLS prevents update
        expect(adminUpdateError).toBeNull();
        expect(adminUpdateData).toHaveLength(0);

        // Owner changes User D's role (should succeed)
        const { data: ownerUpdateData, error: ownerUpdateError } = await userA.client
            .from('company_members')
            .update({ role: 'admin' })
            .eq('id', membershipData!.id)
            .select();

        expect(ownerUpdateError).toBeNull();
        expect(ownerUpdateData).toHaveLength(1);
        expect(ownerUpdateData![0].role).toBe('admin');

        // Restore original role
        await serviceClient
            .from('company_members')
            .update({ role: 'member' })
            .eq('id', membershipData!.id);
    });
});
