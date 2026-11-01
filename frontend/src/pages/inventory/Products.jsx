// Inventory page: server-side search + pagination, create/edit modal,
// stock in/out modal (write actions only for ADMIN/MANAGER).
import { useState } from 'react';
import api, { errMsg } from '../../api/axios.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApi, usePagedList } from '../../hooks/useApi.js';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal, { ModalFooter } from '../../components/ui/Modal.jsx';
import Button from '../../components/ui/Button.jsx';
import Field from '../../components/ui/Field.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useConfirm } from '../../components/ui/ConfirmDialog.jsx';
import { Alert, Badge, Card, PageHeader, SearchInput } from '../../components/ui/index.jsx';
import { inrExact } from '../../utils/format.js';

const EMPTY = { name: '', sku: '', categoryId: '', price: '', quantity: 0, reorderLevel: 10, supplier: '' };

function StockLevel({ product }) {
  if (product.quantity === 0) return <Badge tone="danger" dot>Out of stock</Badge>;
  if (product.low_stock) return <Badge tone="warning" dot>Low</Badge>;
  return <Badge tone="success" dot>In stock</Badge>;
}

export default function Products() {
  const { hasRole } = useAuth();
  const canWrite = hasRole('ADMIN', 'MANAGER');
  const toast = useToast();
  const confirm = useConfirm();

  const [search, setSearch] = useState('');
  const list = usePagedList('/products', { search });
  const categories = useApi(canWrite ? '/categories' : null);

  const [form, setForm] = useState(null);         // null | product form state
  const [stockFor, setStockFor] = useState(null); // product being stock-adjusted
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const openForm = (f) => { setError(''); setForm(f); };
  const openStock = (s) => { setError(''); setStockFor(s); };

  async function saveProduct(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    const body = { ...form, categoryId: Number(form.categoryId), price: Number(form.price),
                   quantity: Number(form.quantity), reorderLevel: Number(form.reorderLevel) };
    try {
      if (form.id) await api.put(`/products/${form.id}`, body);
      else await api.post('/products', body);
      toast.success(form.id ? `${form.name} updated` : `${form.name} added to inventory`);
      setForm(null); list.reload();
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  }

  async function saveStock(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    const qty = Number(stockFor.qty);
    try {
      await api.post(`/products/${stockFor.id}/stock`, {
        type: stockFor.type, quantity: qty, reference: stockFor.reference || undefined,
      });
      toast.success(`${stockFor.type === 'IN' ? 'Added' : 'Removed'} ${qty} × ${stockFor.name}`);
      setStockFor(null); list.reload();
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  }

  async function remove(p) {
    const ok = await confirm({
      title: 'Deactivate product?',
      message: `${p.name} will be hidden from inventory and new orders. Past orders keep their history.`,
      confirmLabel: 'Deactivate', danger: true,
    });
    if (!ok) return;
    try { await api.delete(`/products/${p.id}`); toast.success(`${p.name} deactivated`); list.reload(); }
    catch (err) { toast.error(errMsg(err)); }
  }

  const columns = [
    {
      key: 'name', label: 'Product', primary: true,
      render: (r) => <><span className="cell-strong">{r.name}</span><span className="cell-sub mono">{r.sku}</span></>,
    },
    { key: 'category', label: 'Category' },
    { key: 'price', label: 'Price', align: 'right', render: (r) => <span className="num">{inrExact(r.price)}</span> },
    { key: 'quantity', label: 'On hand', align: 'right', render: (r) => <span className="num cell-strong">{r.quantity}</span> },
    { key: 'status', label: 'Status', render: (r) => <StockLevel product={r} /> },
    ...(canWrite ? [{
      key: 'actions', label: '', actions: true,
      render: (r) => (
        <div className="row-end">
          <Button size="sm" variant="ghost" collapse icon="arrowUpDown" onClick={() => openStock({ ...r, type: 'IN', qty: 1, reference: '' })}>Stock</Button>
          <Button size="sm" variant="ghost" collapse icon="edit" onClick={() => openForm({ id: r.id, name: r.name, sku: r.sku,
            categoryId: r.category_id, price: r.price, quantity: r.quantity,
            reorderLevel: r.reorder_level, supplier: r.supplier || '' })}>Edit</Button>
          {hasRole('ADMIN') && (
            <Button size="sm" variant="ghost-danger" iconOnly icon="trash" aria-label={`Deactivate ${r.name}`} title="Deactivate" onClick={() => remove(r)} />
          )}
        </div>
      ),
    }] : []),
  ];

  const noCategories = canWrite && categories.data && categories.data.length === 0;

  return (
    <>
      <PageHeader
        title="Products"
        description="Everything you stock, with live quantities."
        actions={canWrite && <Button variant="primary" icon="plus" onClick={() => openForm({ ...EMPTY })}>Add product</Button>}
      />

      <Card>
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name or SKU…" label="Search products" />
          {!list.loading && <span className="toolbar-meta">{list.total} {list.total === 1 ? 'product' : 'products'}</span>}
        </div>
        {list.error && list.rows.length > 0 && <div style={{ padding: '12px 16px 0' }}><Alert>{list.error}</Alert></div>}
        <DataTable
          caption="Products"
          columns={columns} rows={list.rows} loading={list.loading} error={list.error}
          page={list.page} pages={list.pages} total={list.total} onPage={list.setPage}
          empty={search
            ? { icon: 'search', title: 'No matching products', message: `Nothing matches “${search}”. Try a name or SKU.` }
            : { icon: 'box', title: 'No products yet', message: canWrite ? 'Add your first product to start tracking stock.' : 'Products will appear here once they are added.' }}
        />
      </Card>

      {form && (
        <Modal title={form.id ? 'Edit product' : 'Add product'} size="lg" onClose={() => setForm(null)}>
          <Alert>{error}</Alert>
          {noCategories && !form.id && <Alert tone="warning">Create a category first; every product needs one.</Alert>}
          <form onSubmit={saveProduct}>
            <div className="form-grid">
              <Field label="Name" className="span-2">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={150} />
              </Field>
              <Field label="SKU" hint={form.id ? 'SKUs are permanent once created.' : 'Unique code, e.g. LAP-001.'}>
                <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required disabled={!!form.id} maxLength={50} />
              </Field>
              <Field label="Category">
                <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>
                  <option value="">Select…</option>
                  {(categories.data || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Price (₹)">
                <input type="number" min="0" step="0.01" inputMode="decimal" value={form.price}
                       onChange={(e) => setForm({ ...form, price: e.target.value })} required />
              </Field>
              {!form.id ? (
                <Field label="Opening stock" hint="Recorded as the first stock movement.">
                  <input type="number" min="0" inputMode="numeric" value={form.quantity}
                         onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                </Field>
              ) : (
                <Field label="On hand" hint="Change stock with the Stock action.">
                  <input value={form.quantity} disabled />
                </Field>
              )}
              <Field label="Reorder level" hint="Flagged as low stock below this.">
                <input type="number" min="0" inputMode="numeric" value={form.reorderLevel}
                       onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} />
              </Field>
              <Field label="Supplier" optional>
                <input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} maxLength={150} />
              </Field>
            </div>
            <ModalFooter>
              <Button onClick={() => setForm(null)}>Cancel</Button>
              <Button type="submit" variant="primary" loading={busy}>{form.id ? 'Save changes' : 'Add product'}</Button>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {stockFor && (
        <Modal title={`Adjust stock · ${stockFor.name}`} onClose={() => setStockFor(null)}>
          <Alert>{error}</Alert>
          <form onSubmit={saveStock}>
            <Field label="Movement">
              <select value={stockFor.type} onChange={(e) => setStockFor({ ...stockFor, type: e.target.value })}>
                <option value="IN">Stock in (purchase or return)</option>
                <option value="OUT">Stock out (damage or adjustment)</option>
              </select>
            </Field>
            <Field
              label="Quantity"
              hint={`On hand now: ${stockFor.quantity}. After this: ${
                Math.max(0, stockFor.quantity + (stockFor.type === 'IN' ? 1 : -1) * (Number(stockFor.qty) || 0))}.`}
            >
              <input type="number" min="1" max={stockFor.type === 'OUT' ? stockFor.quantity : undefined} inputMode="numeric"
                     value={stockFor.qty} onChange={(e) => setStockFor({ ...stockFor, qty: e.target.value })} required />
            </Field>
            <Field label="Reference" optional>
              <input value={stockFor.reference} placeholder="e.g. PO-2026-07" maxLength={100}
                     onChange={(e) => setStockFor({ ...stockFor, reference: e.target.value })} />
            </Field>
            <ModalFooter>
              <Button onClick={() => setStockFor(null)}>Cancel</Button>
              <Button type="submit" variant="primary" loading={busy}>Apply</Button>
            </ModalFooter>
          </form>
        </Modal>
      )}
    </>
  );
}
