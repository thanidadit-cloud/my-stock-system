const http = require('http');
const url = require('url');
const { db, initMySQL } = require('./database');

const port = 3000;

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const method = req.method;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const getBody = (req) => new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => resolve(body));
    });

    try {
        if (path === '/add-product' && method === 'POST') {
            const body = await getBody(req);
            const { name, quantity, min_stock } = JSON.parse(body);
            const [result] = await db.query("INSERT INTO products (name, quantity, min_stock) VALUES (?, ?, ?)", [name, quantity, min_stock]);
            res.end(JSON.stringify({ status: "success", id: result.insertId }));
        } 
        else if (path === '/update-stock' && method === 'POST') {
            const body = await getBody(req);
            const { product_id, type, amount } = JSON.parse(body);
            const today = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
            await db.query("INSERT INTO stock_logs (product_id, type, amount, log_date) VALUES (?, ?, ?, ?)", [product_id, type, amount, today]);
            const updateSql = (type === 'IN') ? "UPDATE products SET quantity = quantity + ? WHERE id = ?" : "UPDATE products SET quantity = quantity - ? WHERE id = ?";
            await db.query(updateSql, [amount, product_id]);
            res.end(JSON.stringify({ status: "success", message: `บันทึก ${type} เรียบร้อย` }));
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
            const [results] = await db.query("SELECT DATE_FORMAT(log_date, '%Y-%m-%d') as log_date, type, SUM(amount) as total FROM stock_logs GROUP BY log_date, type ORDER BY log_date DESC");
            res.end(JSON.stringify(results));
        }
        // --- ส่วนที่เพิ่มใหม่สำหรับดึงข้อมูล User ---
        else if (path === '/all-users' && method === 'GET') {
            const [results] = await db.query('SELECT id, username, email, role FROM User');
            res.end(JSON.stringify(results));
        }
        else {
            res.end(JSON.stringify({ message: "Path not found" }));
        }
    } catch (err) {
        res.end(JSON.stringify({ status: "error", message: err.message }));
    }
});

async function startServer() {
    await initMySQL(); 
    server.listen(port, () => { console.log(`🚀 Server running at http://localhost:${port}`); });
}
startServer();