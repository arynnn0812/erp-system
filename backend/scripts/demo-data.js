// Demo business data: six months of trading for a small IT-equipment
// distributor, so the dashboard, reports and reorder planner have something
// real to show.
//
// Everything goes through the same services the API uses (stock locking,
// ledger rows, order totals, audit entries), so the data is internally
// consistent: every product's quantity is explained by its ledger. Rows are
// then backdated, in creation order, so dates and ids rise together.
//
// Deterministic: a seeded PRNG means every run produces the same history.
const { pool } = require('../src/config/db');
const inventoryService = require('../src/services/inventory.service');
const orderService = require('../src/services/order.service');
const hrService = require('../src/services/hr.service');
const customerModel = require('../src/models/customer.model');

const DAYS = 180;

// mulberry32: tiny, fast, good enough for demo data.
function prng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = prng(20260701);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

const daysAgo = (n) => { const d = new Date(); d.setHours(10, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const sqlDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const sqlTime = (d, minutes = 0) => {
  const t = new Date(d.getTime() + minutes * 60000);
  return `${sqlDate(t)} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}:00`;
};

const CATEGORIES = ['Laptops', 'Monitors', 'Accessories', 'Networking', 'Furniture', 'Stationery'];

// weight = relative popularity; end = stock left after the six months
// (chosen so the reorder planner has out-of-stock, urgent and healthy items).
const PRODUCTS = [
  ['Laptops', 'ThinkPad E14 Gen 6', 'LAP-E14', 62999, 4, 'Lenovo India', 3, 2],
  ['Laptops', 'Dell Latitude 3450', 'LAP-L3450', 58499, 4, 'Dell Technologies', 3, 9],
  ['Laptops', 'MacBook Air 13" M3', 'LAP-MBA13', 104900, 2, 'Apple India', 1, 0],
  ['Monitors', '24" Full HD IPS Monitor', 'MON-24FHD', 10999, 8, 'LG Electronics', 6, 4],
  ['Monitors', '27" 4K USB-C Monitor', 'MON-27UHD', 32499, 4, 'Dell Technologies', 3, 7],
  ['Accessories', 'Wireless Mouse', 'ACC-MOUSE', 899, 30, 'Logitech', 20, 14],
  ['Accessories', 'Mechanical Keyboard', 'ACC-KEYB', 4299, 12, 'Keychron', 8, 31],
  ['Accessories', 'USB-C Docking Station', 'ACC-DOCK', 15999, 5, 'Anker', 3, 1],
  ['Accessories', 'Noise-cancelling Headset', 'ACC-HEADSET', 7999, 8, 'Jabra', 6, 22],
  ['Accessories', '65W USB-C Charger', 'ACC-CHG65', 2499, 15, 'Anker', 10, 48],
  ['Networking', 'Wi-Fi 6 Router', 'NET-AX3000', 8999, 4, 'TP-Link', 3, 11],
  ['Networking', '24-port Gigabit Switch', 'NET-SW24', 13499, 2, 'Netgear', 2, 6],
  ['Networking', 'Cat6 Patch Cable (pack of 10)', 'NET-CAT6', 1299, 10, 'D-Link', 10, 0],
  ['Furniture', 'Ergonomic Office Chair', 'FUR-CHAIR', 13999, 5, 'Featherlite', 4, 3],
  ['Furniture', 'Height-adjustable Desk', 'FUR-DESK', 27999, 2, 'Featherlite', 2, 5],
  ['Stationery', 'A4 Paper (5 reams)', 'STN-A4', 1399, 18, 'JK Paper', 25, 40],
  ['Stationery', 'Whiteboard Markers (12)', 'STN-MARK', 449, 10, 'Camlin', 15, 9],
];

const CUSTOMERS = [
  ['Acme Traders Pvt Ltd', 'accounts@acmetraders.example', '+91 98200 11111', 'Andheri East, Mumbai 400069'],
  ['Bluebell Design Studio', 'hello@bluebell.example', '+91 80 4000 2222', 'Indiranagar, Bengaluru 560038'],
  ['Cedar Health Clinics', 'purchase@cedarhealth.example', '+91 44 2810 3333', 'T. Nagar, Chennai 600017'],
  ['Deccan Logistics', 'it@deccanlogistics.example', '+91 40 6600 4444', 'HITEC City, Hyderabad 500081'],
  ['Evergreen Schools Trust', 'admin@evergreen.example', '+91 20 2567 5555', 'Kothrud, Pune 411038'],
  ['Falcon Fintech LLP', 'ops@falconfintech.example', '+91 22 6123 6666', 'Lower Parel, Mumbai 400013'],
  ['Ganga Textiles', 'office@gangatextiles.example', '+91 141 222 7777', 'C-Scheme, Jaipur 302001'],
  ['Horizon Coworking', 'facilities@horizoncw.example', '+91 124 450 8888', 'Cyber City, Gurugram 122002'],
  ['Indus Legal Associates', null, '+91 11 4155 9999', 'Connaught Place, New Delhi 110001'],
  ['Jupiter Media House', 'procurement@jupitermedia.example', '+91 33 4002 1010', 'Salt Lake, Kolkata 700091'],
];

const DEPARTMENTS = ['Engineering', 'Sales', 'Operations', 'Finance', 'Human Resources'];

// [name, email, department, designation, joined (days ago), salary, linked demo login]
const EMPLOYEES = [
  ['Admin User', 'admin.hr@erp.com', 'Operations', 'Operations Director', 1460, 3200000, 'admin@erp.com'],
  ['HR User', 'hr.records@erp.com', 'Human Resources', 'HR Manager', 1100, 1650000, 'hr@erp.com'],
  ['Manager User', 'manager.records@erp.com', 'Sales', 'Sales Manager', 980, 1900000, 'manager@erp.com'],
  ['Employee User', 'employee.records@erp.com', 'Operations', 'Inventory Associate', 400, 540000, 'employee@erp.com'],
  ['Priya Sharma', 'priya.sharma@erp.com', 'Engineering', 'Senior Engineer', 820, 2100000, null],
  ['Arjun Nair', 'arjun.nair@erp.com', 'Engineering', 'Support Engineer', 300, 780000, null],
  ['Meera Iyer', 'meera.iyer@erp.com', 'Sales', 'Account Executive', 510, 960000, null],
  ['Rohan Gupta', 'rohan.gupta@erp.com', 'Sales', 'Account Executive', 150, 900000, null],
  ['Sneha Kulkarni', 'sneha.kulkarni@erp.com', 'Finance', 'Accountant', 700, 840000, null],
  ['Vikram Singh', 'vikram.singh@erp.com', 'Operations', 'Warehouse Lead', 1250, 720000, null],
];

async function userByEmail(email) {
  const [rows] = await pool.execute(
    'SELECT u.id, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.email = ?', [email]
  );
  return rows[0];
}

// Plan every order up front, so opening stock can be set to exactly what the
// history needs (planned sales + the intended closing stock).
function planOrders(customerCount) {
  const weighted = PRODUCTS.flatMap((p, i) => Array(p[4]).fill(i));
  const orders = [];
  for (let day = DAYS - 1; day >= 0; day -= 1) {
    const growth = 1 + (DAYS - day) / DAYS; // business picks up over time
    const count = rand() < 0.35 * growth ? between(1, 2) : 0;
    for (let k = 0; k < count; k += 1) {
      const lines = new Map();
      for (let n = between(1, 3); n > 0; n -= 1) {
        const p = pick(weighted);
        const bulk = PRODUCTS[p][4] >= 10 ? between(2, 10) : between(1, 3);
        lines.set(p, (lines.get(p) || 0) + bulk);
      }
      orders.push({
        day,
        slot: k, // later orders on the same day get later times
        customer: between(0, customerCount - 1),
        lines: [...lines].map(([p, quantity]) => ({ p, quantity })),
        discount: rand() < 0.2 ? pick([250, 500, 1000, 2000]) : 0,
        // Cancellations only in the first half, while the opening margin can
        // hold their stock until the cancel returns it.
        cancel: day > DAYS / 2 && rand() < 0.1,
      });
    }
  }
  return orders;
}

async function seedDemoData() {
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM products');
  if (n > 0) {
    console.log(`\nDemo data skipped: the database already has ${n} products.`);
    return;
  }
  const admin = await userByEmail('admin@erp.com');
  const manager = await userByEmail('manager@erp.com');
  const hr = await userByEmail('hr@erp.com');
  if (!admin || !manager || !hr) throw new Error('Demo users missing: run the plain seed first');

  // --- people -------------------------------------------------------------
  const deptIds = {};
  for (const name of DEPARTMENTS) deptIds[name] = await hrService.createDepartment(name);
  for (const [name, email, dept, designation, joined, salary, login] of EMPLOYEES) {
    const linked = login ? await userByEmail(login) : null;
    await hrService.createEmployee({
      name, email, departmentId: deptIds[dept], designation,
      joiningDate: sqlDate(daysAgo(joined)), salary, userId: linked?.id ?? null,
    }, linked ? admin : hr, '127.0.0.1'); // linking a login is ADMIN-only
  }

  // --- catalogue ----------------------------------------------------------
  const catIds = {};
  for (const name of CATEGORIES) catIds[name] = await inventoryService.createCategory(name);
  const customerIds = [];
  for (const [name, email, phone, address] of CUSTOMERS) {
    customerIds.push(await customerModel.create({ name, email, phone, address }));
  }

  const plan = planOrders(customerIds.length);
  const restockDay = Math.floor(DAYS / 2);
  const sold = PRODUCTS.map(() => ({ before: 0, total: 0, held: 0 }));
  for (const o of plan) {
    if (o.cancel) {
      // Most of this product any one cancelled order holds before its cancel.
      for (const l of o.lines) sold[l.p].held = Math.max(sold[l.p].held, l.quantity);
      continue;
    }
    for (const l of o.lines) {
      sold[l.p].total += l.quantity;
      if (o.day > restockDay) sold[l.p].before += l.quantity;
    }
  }

  // Opening stock covers the first three months plus a margin for the stock a
  // to-be-cancelled order holds until it is cancelled; one purchase order
  // mid-way tops it up so the ledger shows real restocking.
  const productIds = [];
  const opening = [];
  for (let i = 0; i < PRODUCTS.length; i += 1) {
    const [cat, name, sku, price, , supplier, reorderLevel] = PRODUCTS[i];
    opening[i] = sold[i].before + sold[i].held;
    productIds[i] = await inventoryService.createProduct({
      name, sku, categoryId: catIds[cat], price, quantity: opening[i], reorderLevel, supplier,
    }, admin);
  }
  await pool.query(
    'UPDATE inventory_transactions SET created_at = ? WHERE reference = ?', [sqlTime(daysAgo(DAYS)), 'OPENING_STOCK']
  );
  await pool.query('UPDATE products SET created_at = ?', [sqlTime(daysAgo(DAYS))]);

  // --- trading history, in date order -------------------------------------
  let restocked = false;
  let created = 0;
  let cancelled = 0;
  for (const o of plan) {
    if (!restocked && o.day <= restockDay) {
      restocked = true;
      for (let i = 0; i < PRODUCTS.length; i += 1) {
        const quantity = sold[i].total + PRODUCTS[i][7] - opening[i];
        if (quantity <= 0) continue;
        const reference = `PO-${sqlDate(daysAgo(restockDay)).slice(0, 7)}-${String(i + 1).padStart(2, '0')}`;
        await inventoryService.adjustStock({ productId: productIds[i], type: 'IN', quantity, reference, actor: manager, ip: '127.0.0.1' });
        await pool.query('UPDATE inventory_transactions SET created_at = ? WHERE reference = ?', [sqlTime(daysAgo(restockDay), 30), reference]);
      }
    }

    const actor = rand() < 0.7 ? manager : admin;
    const when = daysAgo(o.day);
    const { orderId } = await orderService.createOrder({
      customerId: customerIds[o.customer],
      items: o.lines.map((l) => ({ productId: productIds[l.p], quantity: l.quantity })),
      taxPercent: 18, discount: o.discount, actor, ip: '127.0.0.1',
    });
    // 10:00 onwards, in order, and never later than now for today's orders.
    const minutes = Math.max(0, Math.min(o.slot * 240 + between(0, 200), Math.floor((Date.now() - when) / 60000)));
    await pool.query('UPDATE orders SET order_date = ?, created_at = ? WHERE id = ?', [sqlDate(when), sqlTime(when, minutes), orderId]);
    await pool.query('UPDATE inventory_transactions SET created_at = ? WHERE reference = ?', [sqlTime(when, minutes), `ORDER-${orderId}`]);
    await pool.query("UPDATE audit_logs SET created_at = ? WHERE action = 'ORDER_CREATE' AND entity_id = ?", [sqlTime(when, minutes), orderId]);
    created += 1;

    if (o.cancel) {
      await orderService.cancelOrder({ orderId, actor: manager, ip: '127.0.0.1' });
      const later = sqlTime(when, minutes + 90);
      await pool.query('UPDATE inventory_transactions SET created_at = ? WHERE reference = ?', [later, `ORDER-${orderId}-CANCEL`]);
      await pool.query("UPDATE audit_logs SET created_at = ? WHERE action = 'ORDER_CANCEL' AND entity_id = ?", [later, orderId]);
      cancelled += 1;
    }
  }

  // Sanity check: every product's quantity must equal its ledger.
  const [drift] = await pool.query(
    `SELECT p.sku FROM products p
     JOIN (SELECT product_id, SUM(CASE WHEN type = 'IN' THEN quantity ELSE -quantity END) AS q
           FROM inventory_transactions GROUP BY product_id) l ON l.product_id = p.id
     WHERE l.q <> p.quantity`
  );
  if (drift.length) throw new Error(`ledger mismatch for ${drift.map((d) => d.sku).join(', ')}`);

  console.log(`\nDemo data: ${DEPARTMENTS.length} departments, ${EMPLOYEES.length} employees, ${CATEGORIES.length} categories,`);
  console.log(`  ${PRODUCTS.length} products, ${CUSTOMERS.length} customers, ${created} orders over ${DAYS} days (${cancelled} cancelled).`);
}

module.exports = { seedDemoData };
