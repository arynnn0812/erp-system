// Order business logic. createOrder() is the most complex transaction in
// the system: order + items + stock deduction + inventory history, all
// atomic. This is the resume bullet - own every line.
const { pool } = require('../config/db');
const customerModel = require('../models/customer.model');
const ApiError = require('../utils/ApiError');
const audit = require('../utils/audit');

// Money math on DECIMAL values comes back from mysql2 as strings; we work
// in Number and round to 2dp at each step. (For a bank I'd use integer
// paise - honest answer if asked about floating point.)
const r2 = (n) => Math.round(n * 100) / 100;

async function createOrder({ customerId, items, taxPercent = 0, discount = 0, actor, ip }) {
  const customer = await customerModel.findById(customerId);
  if (!customer) throw new ApiError(400, 'Invalid customerId');

  // Merge duplicate product lines (2x product 5 + 3x product 5 = 5x).
  const merged = new Map();
  for (const it of items) {
    merged.set(it.productId, (merged.get(it.productId) || 0) + it.quantity);
  }

  // DEADLOCK AVOIDANCE: always lock product rows in ascending id order.
  // If order A locked (5 then 3) while order B locked (3 then 5), each
  // could hold one lock and wait forever on the other. Consistent ordering
  // makes circular waits impossible.
  const wanted = [...merged.entries()]
    .map(([productId, quantity]) => ({ productId, quantity }))
    .sort((a, b) => a.productId - b.productId);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Lock + validate every product line
    const lines = [];
    for (const { productId, quantity } of wanted) {
      const [rows] = await conn.execute(
        `SELECT id, name, price, quantity FROM products
         WHERE id = ? AND is_active = TRUE FOR UPDATE`,
        [productId]
      );
      const product = rows[0];
      if (!product) throw new ApiError(400, `Invalid productId: ${productId}`);
      if (product.quantity < quantity) {
        throw new ApiError(422, `Insufficient stock for ${product.name}: have ${product.quantity}, requested ${quantity}`);
      }
      // PRICE SNAPSHOT: unit price comes from the DB, never from the client.
      const unitPrice = Number(product.price);
      lines.push({ productId, quantity, unitPrice, lineTotal: r2(unitPrice * quantity) });
    }

    // 2. Totals - computed server-side
    const subtotal = r2(lines.reduce((s, l) => s + l.lineTotal, 0));
    const tax = r2((subtotal * taxPercent) / 100);
    const grandTotal = r2(subtotal + tax - discount);
    if (grandTotal < 0) throw new ApiError(422, 'Discount exceeds order value');

    // 3. Insert the order
    const [orderResult] = await conn.execute(
      `INSERT INTO orders (customer_id, created_by, status, subtotal, tax, discount, grand_total, order_date)
       VALUES (?, ?, 'CONFIRMED', ?, ?, ?, ?, CURDATE())`,
      [customerId, actor.id, subtotal, tax, discount, grandTotal]
    );
    const orderId = orderResult.insertId;

    // 4. Items + stock deduction + inventory history, per line
    for (const l of lines) {
      await conn.execute(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, l.productId, l.quantity, l.unitPrice, l.lineTotal]
      );
      await conn.execute(
        'UPDATE products SET quantity = quantity - ? WHERE id = ?',
        [l.quantity, l.productId]
      );
      await conn.execute(
        `INSERT INTO inventory_transactions (product_id, type, quantity, reference, performed_by)
         VALUES (?, 'OUT', ?, ?, ?)`,
        [l.productId, l.quantity, `ORDER-${orderId}`, actor.id]
      );
    }

    await conn.commit(); // everything above becomes visible atomically

    await audit({
      userId: actor.id, action: 'ORDER_CREATE', entity: 'orders', entityId: orderId,
      details: { customerId, items: lines.length, grandTotal }, ip,
    });

    return { orderId, subtotal, tax, discount, grandTotal, items: lines };
  } catch (err) {
    await conn.rollback(); // no order, no stock change, no history - as if it never happened
    throw err;
  } finally {
    conn.release();
  }
}

// Cancel = reverse of confirm: restock every item, same transactional rules.
async function cancelOrder({ orderId, actor, ip }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [orders] = await conn.execute(
      'SELECT id, status FROM orders WHERE id = ? FOR UPDATE',
      [orderId]
    );
    const order = orders[0];
    if (!order) throw new ApiError(404, 'Order not found');
    if (order.status !== 'CONFIRMED') {
      throw new ApiError(422, `Cannot cancel an order with status ${order.status}`);
    }

    const [items] = await conn.execute(
      'SELECT product_id, quantity FROM order_items WHERE order_id = ? ORDER BY product_id',
      [orderId]
    );

    for (const it of items) {
      await conn.execute(
        'UPDATE products SET quantity = quantity + ? WHERE id = ?',
        [it.quantity, it.product_id]
      );
      await conn.execute(
        `INSERT INTO inventory_transactions (product_id, type, quantity, reference, performed_by)
         VALUES (?, 'IN', ?, ?, ?)`,
        [it.product_id, it.quantity, `ORDER-${orderId}-CANCEL`, actor.id]
      );
    }

    await conn.execute("UPDATE orders SET status = 'CANCELLED' WHERE id = ?", [orderId]);

    await conn.commit();
    await audit({ userId: actor.id, action: 'ORDER_CANCEL', entity: 'orders', entityId: orderId, ip });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { createOrder, cancelOrder };
