require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

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
