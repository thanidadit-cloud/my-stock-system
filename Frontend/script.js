const API = `http://${window.location.hostname}:3000`;

window.onload = () => {
    loadAllProducts();
    loadLowStock();
    loadUsers();
};

async function loadAllProducts() {
    const res = await fetch(`${API}/all-products`);
    const data = await res.json();
    let html = '<table><tr><th>ID</th><th>ชื่อสินค้า</th><th>คงเหลือ</th></tr>';
    data.forEach(item => {
        html += `<tr><td>${item.id}</td><td>${item.name}</td><td>${item.quantity}</td></tr>`;
    });
    document.getElementById('allProductsDisplay').innerHTML = data.length ? html + '</table>' : 'ไม่มีสินค้า';
}

async function addProduct() {
    const name = document.getElementById('newName').value;
    const quantity = document.getElementById('newQty').value;
    if(!name || !quantity) return alert("กรุณากรอกข้อมูล");

    await fetch(`${API}/add-product`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name, quantity: parseInt(quantity), min_stock: 5 })
    });
    loadAllProducts();
    loadLowStock();
}

async function updateStock() {
    const product_id = document.getElementById('logId').value;
    const type = document.getElementById('logType').value;
    const amount = document.getElementById('logAmount').value;

    const res = await fetch(`${API}/update-stock`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ product_id: parseInt(product_id), type, amount: parseInt(amount) })
    });
    const result = await res.json();
    alert(result.message);
    loadAllProducts();
    loadLowStock();
}

async function loadLowStock() {
    const res = await fetch(`${API}/low-stock`);
    const data = await res.json();
    let html = '<table><tr><th>ID</th><th>ชื่อ</th><th>เหลือ</th></tr>';
    data.forEach(item => {
        html += `<tr style="color:red; font-weight:bold;"><td>${item.id}</td><td>${item.name}</td><td>${item.quantity}</td></tr>`;
    });
    document.getElementById('lowStockDisplay').innerHTML = data.length ? html + '</table>' : '✅ ของเต็มสต็อก';
}

async function loadUsers() {
    const res = await fetch(`${API}/all-users`);
    const data = await res.json();
    let html = '<table><tr><th>ID</th><th>Username</th><th>Role</th></tr>';
    data.forEach(user => {
        html += `<tr><td>${user.id}</td><td>${user.username}</td><td>${user.role}</td></tr>`;
    });
    document.getElementById('userDisplay').innerHTML = html + '</table>';
}