require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');

async function fetchSchema() {
  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/`;
  const headers = {
    'apikey': process.env.SUPABASE_SECRET_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SECRET_KEY}`
  };

  try {
    const response = await fetch(url, { headers });
    const data = await response.json();
    fs.writeFileSync('schema_data.json', JSON.stringify(data, null, 2));
    console.log('Schema fetched and saved.');
  } catch (error) {
    console.error('Error fetching schema:', error);
  }
}

fetchSchema();
