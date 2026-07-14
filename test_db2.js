const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { error: e1 } = await supabase.from('attendance').insert([{ user_id: '123e4567-e89b-12d3-a456-426614174000', status: 'Active' }]);
  console.log("Attendance Active:", e1 ? e1.message : "SUCCESS");
  
  const { error: e2 } = await supabase.from('tasks').insert([{ assigned_to: '123e4567-e89b-12d3-a456-426614174000', status: 'Completed', title: 'A' }]);
  console.log("Tasks Completed:", e2 ? e2.message : "SUCCESS");
})();
