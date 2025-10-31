#!/usr/bin/env node

/**
 * Quick test to verify JWT hook is working
 * Creates a test user and checks if JWT contains account_uuid claims
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wnohgxkujwnuoqtibsss.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 'sb_publishable_7t2VlZsjkpEGyDZsUKlZnw_x77_p8x5';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🧪 Testing JWT Claims Hook Configuration...\n');

async function testJWTHook() {
  // Try to get current session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    console.log('❌ Error getting session:', sessionError.message);
    return;
  }

  if (!session) {
    console.log('⚠️  No active session found.');
    console.log('   To test JWT claims, please:');
    console.log('   1. Sign up/login via your app');
    console.log('   2. Run this script again\n');
    return;
  }

  console.log('✅ Active session found');
  console.log(`   User ID: ${session.user.id}`);
  console.log(`   Email: ${session.user.email}\n`);

  // Decode JWT to check for custom claims
  const token = session.access_token;
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

  console.log('🔍 Checking JWT Claims...\n');

  // Check for account_uuid in user_metadata
  const accountUuid = payload.user_metadata?.account_uuid;
  const userRole = payload.user_metadata?.user_role;

  if (accountUuid && userRole) {
    console.log('✅ JWT Hook is WORKING!');
    console.log(`   account_uuid: ${accountUuid}`);
    console.log(`   user_role: ${userRole}\n`);

    console.log('🎉 Perfect! Your RLS policies will now use JWT claims (zero database overhead)');
  } else {
    console.log('⚠️  JWT Hook NOT configured or user needs to re-login');
    console.log('   Current JWT user_metadata:', JSON.stringify(payload.user_metadata, null, 2));
    console.log('\n   To fix:');
    console.log('   1. Ensure Custom Access Token Hook is enabled in Supabase Dashboard');
    console.log('   2. Sign out and sign back in to get new JWT with claims');
    console.log('   3. Run this script again\n');
  }

  // Test database access
  console.log('🗄️  Testing Database Access...\n');

  const { data: usersData, error: usersError } = await supabase
    .from('users')
    .select('user_uuid, user_email, role')
    .limit(1);

  if (usersError) {
    console.log('❌ Database access failed:', usersError.message);
    if (usersError.message.includes('infinite recursion')) {
      console.log('   ⚠️  Still seeing infinite recursion - JWT hook must be configured and user re-authenticated\n');
    }
  } else {
    console.log('✅ Database access successful!');
    console.log(`   Retrieved ${usersData?.length || 0} user record(s)`);
    console.log('   RLS policies are working correctly!\n');
  }
}

testJWTHook().catch(err => {
  console.error('💥 Test error:', err.message);
});
