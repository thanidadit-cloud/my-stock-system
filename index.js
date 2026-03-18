const http = require('http');
const mysql = require('mysql2');
const url = require('url');

const port = 3000;

// 1. ตั้งค่าการเชื่อมต่อ Database
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'webdb',
    port: 8820
});
const db = connection.promise();

// 2. ฟังก์ชันตรวจสอบการเชื่อมต่อฐานข้อมูล (แบบเงียบ)
async function initMySQL() {
    try {
        await db.query('SELECT 1');
        
    } catch (err) {
        console.error(' MySQL Connection Failed:', err.message);
        process.exit(1); 
    }
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const method = req.method;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // ฟังก์ชันช่วยอ่านข้อมูล Body
    const getBody = (req) => new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => resolve(body));
    });

    try {
        // --- ส่วนของ API Routes ---
        if (path === '/add-product' && method === 'POST') {
            const body = await getBody(req);
            const { name, quantity, min_stock } = JSON.parse(body);
            const sql = "INSERT INTO products (name, quantity, min_stock) VALUES (?, ?, ?)";
            const [result] = await db.query(sql, [name, quantity, min_stock]);
            res.end(JSON.stringify({ status: "success", message: "เพิ่มสำเร็จ!", id: result.insertId }));
        } 

        else if (path === '/update-stock' && method === 'POST') {
            const body = await getBody(req);
            const { product_id, type, amount } = JSON.parse(body);
            const today = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());

            const logSql = "INSERT INTO stock_logs (product_id, type, amount, log_date) VALUES (?, ?, ?, ?)";
            await db.query(logSql, [product_id, type, amount, today]);

            const updateSql = (type === 'IN') 
                ? "UPDATE products SET quantity = quantity + ? WHERE id = ?" 
                : "UPDATE products SET quantity = quantity - ? WHERE id = ?";
            
            await db.query(updateSql, [amount, product_id]);
            res.end(JSON.stringify({ status: "success", message: `บันทึกรายการ ${type} เรียบร้อย!` }));
        }

        else if (path === '/all-products' && method === 'GET') {
            const [results] = await db.query('SELECT * FROM products ORDER BY id ASC');
            res.end(JSON.stringify(results));
        }

        else if (path === '/low-stock' && method === 'GET') {
            const [results] = await db.query('SELECT * FROM products WHERE quantity <= min_stock');
            res.end(JSON.stringify(results));
        }

        else if (path === '/report-daily' && method === 'GET') {
            const sql = `
                SELECT DATE_FORMAT(log_date, '%Y-%m-%d') as log_date, type, SUM(amount) as total 
                FROM stock_logs 
                GROUP BY DATE_FORMAT(log_date, '%Y-%m-%d'), type 
                ORDER BY log_date DESC`;
            const [results] = await db.query(sql);
            res.end(JSON.stringify(results));
        }

        else if (path === '/report-monthly' && method === 'GET') {
            const sql = `
                SELECT DATE_FORMAT(log_date, '%Y-%m') as month, type, SUM(amount) as total 
                FROM stock_logs 
                GROUP BY month, type 
                ORDER BY month DESC`;
            const [results] = await db.query(sql);
            res.end(JSON.stringify(results));
        }

        else {
            res.end(JSON.stringify({ message: "Path not found" }));
        }
    } catch (err) {
        res.end(JSON.stringify({ status: "error", message: err.message }));
    }
});

// 3. เริ่มสตาร์ทระบบ
async function startServer() {
    await initMySQL(); // รอเช็คฐานข้อมูล
    server.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}

startServer();