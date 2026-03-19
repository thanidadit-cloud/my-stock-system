const http = require('http');
const mysql = require('mysql2/promise');
const url = require('url');

const port = 3000;
let db; 

// 1. เชื่อมต่อฐานข้อมูล
async function initMySQL() {
    try {
        db = await mysql.createPool({
            host: 'localhost',
            user: 'root',
            password: 'root',
            database: 'webdb',
            port: 8820,
            waitForConnections: true,
            connectionLimit: 10
        });
        console.log(" Connected to MySQL Pool Successfully");
    } catch (err) {
        console.error(" Database Connection Failed:", err.message);
        process.exit(1);
    }
}

const getBody = (req) => new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
        try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(new Error("Invalid JSON")); }
    });
});

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const method = req.method;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    try {
        if (path === '/add-product' && method === 'POST') {
            const { name, quantity, min_stock } = await getBody(req);
            const [result] = await db.execute(
                "INSERT INTO products (name, quantity, min_stock) VALUES (?, ?, ?)", 
                [name, quantity, min_stock]
            );
            res.end(JSON.stringify({ status: "success", message: "เพิ่มสำเร็จ!", id: result.insertId }));
        }

        else if (path === '/update-stock' && method === 'POST') {
            const { product_id, type, amount } = await getBody(req);
            const [checkProduct] = await db.execute("SELECT name, quantity FROM products WHERE id = ?", [product_id]);
            
            if (checkProduct.length === 0) {
                res.writeHead(404);
                return res.end(JSON.stringify({ status: "error", message: `ไม่พบสินค้า ID: ${product_id}` }));
            }

            const product = checkProduct[0];
            const conn = await db.getConnection();

            try {
                await conn.beginTransaction();
                
                // ปรับตรงนี้: ใช้เวลาท้องถิ่น (ไทย) แทน ISOString เพื่อให้วันที่ตรงกับหน้าเว็บ
                const today = new Date().toLocaleDateString('en-CA'); 

                await conn.execute(
                    "INSERT INTO stock_logs (product_id, type, amount, log_date) VALUES (?, ?, ?, ?)", 
                    [product_id, type, amount, today]
                );

                const op = (type === 'IN') ? '+' : '-';
                await conn.execute(`UPDATE products SET quantity = quantity ${op} ? WHERE id = ?`, [amount, product_id]);

                await conn.commit();
                const newQty = (type === 'IN') ? (product.quantity + Number(amount)) : (product.quantity - Number(amount));
                let warning = (newQty <= 5) ? ` คำเตือน: ${product.name} เหลือเพียง ${newQty} ชิ้น!` : "";

                res.end(JSON.stringify({ status: "success", message: `บันทึกเรียบร้อย!${warning}` }));
            } catch (err) {
                await conn.rollback();
                throw err;
            } finally {
                conn.release();
            }
        }

        else if (path === '/all-products' && method === 'GET') {
            const [rows] = await db.query('SELECT * FROM products ORDER BY id ASC');
            res.end(JSON.stringify(rows));
        }

        else if (path === '/low-stock' && method === 'GET') {
            const [rows] = await db.query('SELECT * FROM products WHERE quantity <= min_stock');
            res.end(JSON.stringify(rows));
        }

        else if (path === '/report-daily' && method === 'GET') {
            const [rows] = await db.query(`
                SELECT DATE_FORMAT(log_date, '%Y-%m-%d') AS date, type, CAST(SUM(amount) AS UNSIGNED) AS total 
                FROM stock_logs GROUP BY date, type ORDER BY date DESC
            `);
            res.end(JSON.stringify(rows));
        }

        else if (path === '/report-monthly' && method === 'GET') {
            const [rows] = await db.query(`
                SELECT DATE_FORMAT(log_date, '%Y-%m') AS date, type, CAST(SUM(amount) AS UNSIGNED) AS total 
                FROM stock_logs GROUP BY date, type ORDER BY date DESC
            `);
            res.end(JSON.stringify(rows));
        }

        else {
            res.writeHead(404);
            res.end(JSON.stringify({ message: "Not Found" }));
        }

    } catch (err) {
        console.error(" Server Error:", err.message);
        res.writeHead(500);
        res.end(JSON.stringify({ status: "error", message: err.message }));
    }
});

server.listen(port, async () => {
    await initMySQL();
    console.log(` Server ready at http://localhost:${port}`);
});