#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://wnohgxkujwnuoqtibsss.supabase.co',
  'sb_publishable_7t2VlZsjkpEGyDZsUKlZnw_x77_p8x5'
);

console.log('Full error details:\n');

const { data, error } = await supabase.from('users').select('user_uuid').limit(0);

console.log('Error object:', JSON.stringify(error, null, 2));
console.log('\nError code:', error?.code);
console.log('Error message:', error?.message);
console.log('Error details:', error?.details);
console.log('Error hint:', error?.hint);
