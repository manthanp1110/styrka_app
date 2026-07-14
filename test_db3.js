const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { error: e1 } = await supabase.from('employee_locations').insert([{ user_id: '123e4567-e89b-12d3-a456-426614174000', latitude: 0, longitude: 0, status: 'Moving' }]);
  console.log("Moving:", e1 ? e1.message : "SUCCESS");
})();
