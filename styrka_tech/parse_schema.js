const fs = require('fs');

const data = JSON.parse(fs.readFileSync('schema_data.json', 'utf8'));
const defs = data.definitions;

if (defs) {
  for (const [tableName, schema] of Object.entries(defs)) {
    console.log(`Table: ${tableName}`);
    if (schema.properties) {
      console.log('  Columns:', Object.keys(schema.properties).join(', '));
    }
  }
} else {
  console.log('No definitions found.');
}
