const mysql = require('mysql2/promise');

async function main() {
  try {
    const conn = await mysql.createConnection({
      host: '131.153.147.178',
      port: 3306,
      user: 'zerolord_cinjelly',
      password: '@f33rinimi',
      database: 'zerolord_cinjelly'
    });
    
    console.log("Successfully connected to MySQL database!");
    
    const [tables] = await conn.query("SHOW TABLES");
    console.log("Tables in database:", tables);
    
    for (let t of tables) {
      const tblName = Object.values(t)[0];
      const [[{count}]] = await conn.query(`SELECT COUNT(*) as count FROM \`${tblName}\``);
      console.log(`Table \`${tblName}\` row count: ${count}`);
      
      if (tblName === 'system_config') {
        const [rows] = await conn.query("SELECT * FROM `system_config`");
        console.log("system_config contents:");
        console.log(rows);
      } else if (tblName === 'users') {
        const [rows] = await conn.query("SELECT id, fullName, username, email, role, subscriptionStatus, jellyfinUserId FROM `users`");
        console.log("users contents (truncated):");
        console.log(rows);
      }
    }
    
    await conn.end();
  } catch (err) {
    console.error("Error inspecting DB:", err);
  }
}

main();
