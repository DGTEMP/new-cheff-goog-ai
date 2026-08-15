const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');
db.all("SELECT * FROM pedidos WHERE localName = 'Mesa 10'", (err, rows) => console.log(rows));
