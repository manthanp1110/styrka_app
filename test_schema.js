const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data, error } = await supabase.from('tasks').select('*').limit(1);
  console.log(data, error);
})();
