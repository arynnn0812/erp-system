// Inventory page: server-side search + pagination, create/edit modal,
// stock in/out modal (write actions only for ADMIN/MANAGER).
import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api/axios.js';
import { useAuth } from '../../context/AuthContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import Modal from '../../components/Modal.jsx';
import { inr } from '../../utils/format.js';

const EMPTY = { name: '', sku: '', categoryId: '', price: '', quantity: 0, reorderLevel: 10, supplier: '' };

export default function Products() {
  const { hasRole } = useAuth();
  const canWrite = hasRole('ADMIN', 'MANAGER');

  const [data, setData] = useState({ rows: [], page: 1, pages: 1 });
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(null);      // null | product form state
  const [stockFor, setStockFor] = useState(null); // product being stock-adjusted
  const [error, setError] = useState('');

  async function load(p = page) {
    const res = await api.get('/products', { params: { search, page: p, limit: 10 } });
    setData(res.data);
  }

  useEffect(() => { load(1); setPage(1); }, [search]); // eslint-disable-line
  useEffect(() => { api.get('/categories').then((r) => setCategories(r.data.data)); }, []);

  async function saveProduct(e) {
    e.preventDefault();
    setError('');
    const body = { ...form, categoryId: Number(form.categoryId), price: Number(form.price),
                   quantity: Number(form.quantity), reorderLevel: Number(form.reorderLevel) };
    try {
      if (form.id) await api.put(`/products/${form.id}`, body);
      else await api.post('/products', body);
      setForm(null); load();
    } catch (err) { setError(errMsg(err)); }
  }

  async function saveStock(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post(`/products/${stockFor.id}/stock`, {
        type: stockFor.type, quantity: Number(stockFor.qty), reference: stockFor.reference || undefined,
      });
      setStockFor(null); load();
    } catch (err) { setError(errMsg(err)); }
  }

  async function remove(id) {
    if (!confirm('Deactivate this product?')) return;
    try { await api.delete(`/products/${id}`); load(); }
    catch (err) { alert(errMsg(err)); }
  }

  const columns = [
    { key: 'name', label: 'Product' },
    { key: 'sku', label: 'SKU' },
    { key: 'category', label: 'Category' },
    { key: 'price', label: 'Price', render: (r) => inr(r.price) },
    {
      key: 'quantity', label: 'Stock',
      render: (r) => (
        <>
          {r.quantity}{' '}
          {r.low_stock ? <span className="tag-low">LOW</span> : null}
        </>
      ),
    },
    ...(canWrite ? [{
      key: 'actions', label: '',
      render: (r) => (
        <div className="row">
          <button className="btn" onClick={() => setStockFor({ ...r, type: 'IN', qty: 1, reference: '' })}>Stock</button>
          <button className="btn" onClick={() => setForm({ id: r.id, name: r.name, sku: r.sku,
            categoryId: r.category_id, price: r.price, quantity: r.quantity,
            reorderLevel: r.reorder_level, supplier: r.supplier || '' })}>Edit</button>
          {hasRole('ADMIN') && <button className="btn btn-danger" onClick={() => remove(r.id)}>Delete</button>}
        </div>
      ),
    }] : []),
  ];

  return (
    <>
      <div className="row-between">
        <h2>Inventory</h2>
        <div className="row">
          <input placeholder="Search name or SKU…" value={search}
                 onChange={(e) => setSearch(e.target.value)} style={{ width: 220 }} />
          {canWrite && <button className="btn btn-primary" onClick={() => setForm({ ...EMPTY })}>+ Product</button>}
        </div>
      </div>

      <DataTable columns={columns} rows={data.rows} page={data.page} pages={data.pages}
                 onPage={(p) => { setPage(p); load(p); }} />

      {form && (
        <Modal title={form.id ? 'Edit product' : 'New product'} onClose={() => setForm(null)}>
          {error && <div className="error">{error}</div>}
          <form onSubmit={saveProduct}>
            <label>Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <label>SKU</label>
            <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required disabled={!!form.id} />
            <label>Category</label>
            <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>
              <option value="">Select…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <label>Price (₹)</label>
            <input type="number" min="0" step="0.01" value={form.price}
                   onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            {!form.id && (
              <>
                <label>Opening stock</label>
                <input type="number" min="0" value={form.quantity}
                       onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              </>
            )}
            <label>Reorder level</label>
            <input type="number" min="0" value={form.reorderLevel}
                   onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} />
            <label>Supplier (optional)</label>
            <input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-primary">{form.id ? 'Save changes' : 'Create product'}</button>
            </div>
          </form>
        </Modal>
      )}

      {stockFor && (
        <Modal title={`Stock: ${stockFor.name} (current ${stockFor.quantity})`} onClose={() => setStockFor(null)}>
          {error && <div className="error">{error}</div>}
          <form onSubmit={saveStock}>
            <label>Type</label>
            <select value={stockFor.type} onChange={(e) => setStockFor({ ...stockFor, type: e.target.value })}>
              <option value="IN">Stock IN (purchase/return)</option>
              <option value="OUT">Stock OUT (damage/adjustment)</option>
            </select>
            <label>Quantity</label>
            <input type="number" min="1" value={stockFor.qty}
                   onChange={(e) => setStockFor({ ...stockFor, qty: e.target.value })} required />
            <label>Reference (optional)</label>
            <input value={stockFor.reference} placeholder="e.g. PURCHASE-2026-07"
                   onChange={(e) => setStockFor({ ...stockFor, reference: e.target.value })} />
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-primary">Apply</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
