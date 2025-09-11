// db/index.js
import mysql from "mysql2/promise";

// Buat koneksi pool
const jbssms = mysql.createPool({
  host: "192.168.182.37",
  port: 3434,
  user: "root",
  password: "kebersamaan",
  database: "jbssms",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export { jbssms };