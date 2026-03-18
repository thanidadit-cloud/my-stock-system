const mysql = require('mysql2');

// 1. ตั้งค่าการเชื่อมต่อ Database
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'webdb',
    port: 8820
});

const db = connection.promise();

// 2. ฟังก์ชันตรวจสอบการเชื่อมต่อฐานข้อมูล
async function initMySQL() {
    try {
        await db.query('SELECT 1');
        // ถ้าผ่าน จะไม่แสดงอะไรเพื่อให้ Terminal สะอาด
    } catch (err) {
        console.error('❌ MySQL Connection Failed:', err.message);
        process.exit(1); 
    }
}

// ส่งออกไปให้ไฟล์อื่นใช้งาน
module.exports = { db, initMySQL };