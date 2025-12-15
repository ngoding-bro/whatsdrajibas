import mysql from "mysql2/promise";

const jbssms = mysql.createPool({
  host: "",
  port: 3434,
  user: "root",
  password: "",
  database: "jbssms",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export { jbssms };
