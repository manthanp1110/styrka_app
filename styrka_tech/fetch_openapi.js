const fs = require('fs');

async function fetchSchema() {
  const url = 'https://fwjlrkbycppuajtiblue.supabase.co/rest/v1/';
  const headers = {
    'apikey': 'sb_secret_SmLNM4WCf9ji0f0769zijg_stAUQaLh',
    'Authorization': 'Bearer sb_secret_SmLNM4WCf9ji0f0769zijg_stAUQaLh'
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
