const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { error } = await supabase.from('journeys').insert([{
    user_id: '123e4567-e89b-12d3-a456-426614174000',
    status: 'active',
    start_lat: 0,
    start_lng: 0,
    destination_lat: 0,
    destination_lng: 0
  }]);
  console.log("lowercase active:", error ? error.message : "SUCCESS");
  
  const { error: e2 } = await supabase.from('journeys').insert([{
    user_id: '123e4567-e89b-12d3-a456-426614174000',
    status: 'Active',
    start_lat: 0,
    start_lng: 0,
    destination_lat: 0,
    destination_lng: 0
  }]);
  console.log("Uppercase Active:", e2 ? e2.message : "SUCCESS");
})();
