const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://fwjlrkbycppuajtiblue.supabase.co';
const supabaseKey = 'sb_publishable_5rSFvBDeXR6FRE8aElyznA_m5wNVBl5';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('Testing connection to Supabase...');
  try {
    const { data, error } = await supabase.from('users').select('*').limit(1);
    console.log('Test Users Table:', data, error);
  } catch (err) {
    console.error('Error users:', err.message);
  }

  try {
    const { data, error } = await supabase.from('profiles').select('*').limit(1);
    console.log('Test Profiles Table:', data, error);
  } catch (err) {
    console.error('Error profiles:', err.message);
  }
}

testConnection();
