const http = require('http');
const mysql = require('mysql2/promise'); // ใช้เวอร์ชัน promise
const url = require('url');

const port = 3000;

async function startServer() {
    // 1. สร้าง Connection Pool (แนะนำมากกว่า createConnection สำหรับ Async)
    const db = await mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: 'root',
        database: 'webdb',
        port: 8820,
        waitForConnections: true,
        connectionLimit: 10
    });

    const server = http.createServer(async (req, res) => {
        const parsedUrl = url.parse(req.url, true);
        const path = parsedUrl.pathname;
        const method = req.method;

        // Header ตั้งค่า CORS และ JSON
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

        // ฟังก์ชันช่วยอ่าน Body แบบ Async
        const getBody = (req) => new Promise((resolve) => {
            let body = '';
            req.on('data', chunk => body += chunk.toString());
            req.on('end', () => resolve(body));
        });

        try {
            // 1. เพิ่มสินค้าใหม่ (POST)
            if (path === '/add-product' && method === 'POST') {
                const body = await getBody(req);
                const { name, quantity, min_stock } = JSON.parse(body);
                const [result] = await db.execute(
                    "INSERT INTO products (name, quantity, min_stock) VALUES (?, ?, ?)", 
                    [name, quantity, min_stock]
                );
                res.end(JSON.stringify({ status: "success", message: "เพิ่มสำเร็จ!", id: result.insertId }));
            }

            // 2. บันทึก เข้า-ออก และ อัปเดตสต็อก (POST)
            else if (path === '/update-stock' && method === 'POST') {
                const body = await getBody(req);
                const { product_id, type, amount } = JSON.parse(body);
                const today = new Date().toISOString().split('T')[0];

                // ใช้ await ทำงานทีละขั้นตอน (Sequential)
                // บันทึก Log
                await db.execute(
                    "INSERT INTO stock_logs (product_id, type, amount, log_date) VALUES (?, ?, ?, ?)", 
                    [product_id, type, amount, today]
                );

                // อัปเดตจำนวนสินค้า
                const updateSql = (type === 'IN') 
                    ? "UPDATE products SET quantity = quantity + ? WHERE id = ?" 
                    : "UPDATE products SET quantity = quantity - ? WHERE id = ?";
                await db.execute(updateSql, [amount, product_id]);

                res.end(JSON.stringify({ status: "success", message: `บันทึกรายการ ${type} เรียบร้อย!` }));
            }

            // 3. ดึงสินค้าทั้งหมด (GET)
            else if (path === '/all-products' && method === 'GET') {
                const [rows] = await db.query('SELECT * FROM products ORDER BY id ASC');
                res.end(JSON.stringify(rows));
            }

            // 4. สินค้าใกล้หมด (GET)
            else if (path === '/low-stock' && method === 'GET') {
                const [rows] = await db.query('SELECT * FROM products WHERE quantity <= min_stock');
                res.end(JSON.stringify(rows));
            }

            // 5. รายงานรายวัน (GET)
            else if (path === '/report-daily' && method === 'GET') {
                const [rows] = await db.query(`
                    SELECT log_date AS date, type, SUM(amount) AS total 
                    FROM stock_logs 
                    GROUP BY date, type 
                    ORDER BY date DESC
                `);
                res.end(JSON.stringify(rows));
            }

            // 6. รายงานรายเดือน (GET)
            else if (path === '/report-monthly' && method === 'GET') {
                const [rows] = await db.query(`
                    SELECT DATE_FORMAT(log_date, '%Y-%m') AS date, type, SUM(amount) AS total 
                    FROM stock_logs 
                    GROUP BY date, type 
                    ORDER BY date DESC
                `);
                res.end(JSON.stringify(rows));
            }

            else {
                res.writeHead(404);
                res.end(JSON.stringify({ message: "Path not found" }));
            }

        } catch (err) {
            console.error(err);
            res.writeHead(500);
            res.end(JSON.stringify({ status: "error", message: err.message }));
        }
    });

    server.listen(port, () => {
        console.log(` Async Server is running on http://localhost:${port}`);
    });
}

// เริ่มต้นระบบ
startServer().catch(err => console.error("Server Start Failed:", err));