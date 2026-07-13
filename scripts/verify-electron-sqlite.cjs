const Database = require('better-sqlite3');

const db = new Database(':memory:');
const result = db.prepare('select 1 as ready').get();
db.close();

if (result?.ready !== 1) {
  throw new Error('Electron SQLite smoke query returned an unexpected result');
}

console.log(`Electron ${process.versions.electron || 'run-as-node'} SQLite native binding OK (ABI ${process.versions.modules}).`);
