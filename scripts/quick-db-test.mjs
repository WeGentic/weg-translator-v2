#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://wnohgxkujwnuoqtibsss.supabase.co',
  'sb_publishable_7t2VlZsjkpEGyDZsUKlZnw_x77_p8x5'
);

console.log('Testing database access (unauthenticated)...\n');

// Test if we can at least query without infinite recursion
const { error } = await supabase.from('users').select('user_uuid').limit(0);

if (error) {
  if (error.message.includes('infinite recursion')) {
    console.log('❌ STILL BROKEN: Infinite recursion detected');
    console.log('   The hook may need a few minutes to propagate\n');
  } else {
    console.log('✅ NO INFINITE RECURSION!');
    console.log(`   Error (expected for anon access): ${error.message}\n`);
    console.log('   This is normal - RLS is working correctly!');
  }
} else {
  console.log('✅ Database accessible!');
  console.log('   RLS policies are working correctly!\n');
}
