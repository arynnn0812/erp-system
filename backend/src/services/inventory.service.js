// Inventory business logic. The star of the show is adjustStock() -
// the transactional, concurrency-safe stock movement. Understand every
// line of it; this is THE interview question for this project.
const { pool } = require('../config/db');
const productModel = require('../models/product.model');
const categoryModel = require('../models/category.model');
const ApiError = require('../utils/ApiError');
const audit = require('../utils/audit');

// ---------- categories ----------

async function createCategory(name) {
  const existing = await categoryModel.findByName(name);
  if (existing) throw new ApiError(409, 'Category already exists');
  return categoryModel.create(name);
}

async function updateCategory(id, name) {
  const existing = await categoryModel.findByName(name);
  if (existing && existing.id !== Number(id)) throw new ApiError(409, 'Category already exists');
  const ok = await categoryModel.update(id, name);
  if (!ok) throw new ApiError(404, 'Category not found');
}

async function deleteCategory(id) {
  try {
    const ok = await categoryModel.remove(id);
    if (!ok) throw new ApiError(404, 'Category not found');
  } catch (err) {
    // FK violation: products still reference this category
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      throw new ApiError(409, 'Cannot delete: category still has products');
    }
    throw err;
  }
}

// ---------- products ----------

async function createProduct(data, actor) {
  const dupe = await productModel.findBySku(data.sku);
  if (dupe) throw new ApiError(409, `SKU already exists: ${data.sku}`);

  const category = await categoryModel.findById(data.categoryId);
  if (!category) throw new ApiError(400, 'Invalid categoryId');

  // Product row + opening-stock ledger row commit together: a product must
  // never exist with a quantity its history cannot explain.
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const id = await productModel.create(data, conn);
    if (data.quantity > 0) {
      await conn.execute(
        `INSERT INTO inventory_transactions (product_id, type, quantity, reference, performed_by)
         VALUES (?, 'IN', ?, 'OPENING_STOCK', ?)`,
        [id, data.quantity, actor.id]
      );
    }
    await conn.commit();
    return id;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function updateProduct(id, data) {
  const category = await categoryModel.findById(data.categoryId);
  if (!category) throw new ApiError(400, 'Invalid categoryId');
  const ok = await productModel.update(id, data);
  if (!ok) throw new ApiError(404, 'Product not found');
}

async function deleteProduct(id, actor, ip) {
  const ok = await productModel.softDelete(id);
  if (!ok) throw new ApiError(404, 'Product not found');
  await audit({ userId: actor.id, action: 'PRODUCT_DELETE', entity: 'products', entityId: id, ip });
}

// ---------- stock movement (transaction + row lock) ----------

async function adjustStock({ productId, type, quantity, reference, actor, ip }) {
  // A dedicated connection from the pool: a transaction must run entirely
  // on ONE connection (pool.execute may use a different one per call).
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // FOR UPDATE row-locks this product until COMMIT/ROLLBACK.
    // A concurrent stock operation on the same product WAITS here,
    // then sees the already-updated quantity - no lost updates.
    const [rows] = await conn.execute(
      'SELECT id, quantity FROM products WHERE id = ? AND is_active = TRUE FOR UPDATE',
      [productId]
    );
    const product = rows[0];
    if (!product) throw new ApiError(404, 'Product not found');

    if (type === 'OUT' && product.quantity < quantity) {
      // Business rule: never go negative. 422 = understood but unprocessable.
      throw new ApiError(422, `Insufficient stock: have ${product.quantity}, requested ${quantity}`);
    }

    const newQty = type === 'IN' ? product.quantity + quantity : product.quantity - quantity;

    await conn.execute('UPDATE products SET quantity = ? WHERE id = ?', [newQty, productId]);

    await conn.execute(
      `INSERT INTO inventory_transactions (product_id, type, quantity, reference, performed_by)
       VALUES (?, ?, ?, ?, ?)`,
      [productId, type, quantity, reference ?? null, actor.id]
    );

    await conn.commit(); // both writes become visible atomically

    // Audit outside the transaction - it must not be able to roll back the stock op.
    await audit({
      userId: actor.id,
      action: `STOCK_${type}`,
      entity: 'products',
      entityId: productId,
      details: { quantity, from: product.quantity, to: newQty, reference },
      ip,
    });

    return { productId, previousQuantity: product.quantity, newQuantity: newQty };
  } catch (err) {
    await conn.rollback(); // any failure -> neither write happened
    throw err;
  } finally {
    conn.release(); // ALWAYS return the connection, even on error
  }
}

module.exports = {
  createCategory, updateCategory, deleteCategory,
  createProduct, updateProduct, deleteProduct,
  adjustStock,
};
