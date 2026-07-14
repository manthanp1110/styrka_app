require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  try {
    const { data, error } = await supabase.rpc('get_tables'); // sometimes rpc is needed
    // Actually, we can just try to query some standard table names.
    // Let's try selecting from information_schema if possible, though anon key might not have access.
  } catch(e) {}
  
  // Since we don't know if anon key can access information_schema, let's just test some common names:
  const tablesToTest = ['employees', 'farmers', 'dealers', 'leaves', 'attendance', 'tasks', 'orders', 'expenses', 'chat', 'messages'];
  
  for (const table of tablesToTest) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (!error) {
      console.log(`Table exists: ${table}`, 'Columns:', data.length > 0 ? Object.keys(data[0]) : 'Empty but exists');
    } else if (error.code !== 'PGRST205') { // PGRST205 is table not found
      console.log(`Table exists but error: ${table} - ${error.message}`);
    }
  }
}

checkTables();
