const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: journeys, error } = await supabase.from('journeys').select('*');
  if (error) console.error(error);
  else console.log('Journeys:', journeys);
})();
