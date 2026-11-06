// Order creation: local cart of {productId, quantity}. Totals are PREVIEWED
// client-side but the server recomputes everything from DB prices - the
// client only ever sends intent (ids + quantities), never money.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { errMsg } from '../../api/axios.js';
import Button from '../../components/ui/Button.jsx';
import Field from '../../components/ui/Field.jsx';
import Icon from '../../components/ui/Icon.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { Alert, Card, PageHeader } from '../../components/ui/index.jsx';
import { inr, inrExact } from '../../utils/format.js';

export default function OrderCreate() {
  const navigate = useNavigate();
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [query, setQuery] = useState('');
  const [found, setFound] = useState({ query: '', rows: [] });
  const [cart, setCart] = useState([]); // {productId, name, sku, price, quantity, stock}
  const [taxPercent, setTaxPercent] = useState(18);
  const [discount, setDiscount] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/customers', { params: { limit: 100 } }).then((r) => setCustomers(r.data.rows))
      .catch((e) => setError(errMsg(e)));
  }, []);

  // Debounced product search; a reply for an older query is ignored.
  useEffect(() => {
    const q = query.trim();
    if (!q) return undefined;
    let stale = false;
    const t = setTimeout(() => {
      api.get('/products', { params: { search: q, limit: 6 } })
        .then((r) => { if (!stale) setFound({ query: q, rows: r.data.rows }); })
        .catch(() => { if (!stale) setFound({ query: q, rows: [] }); });
    }, 250);
    return () => { stale = true; clearTimeout(t); };
  }, [query]);

  const q = query.trim();
  const results = q && found.query === q ? found.rows : [];
  const searching = q && found.query !== q;

  function addToCart(p) {
    setQuery('');
    setCart((c) => {
      const existing = c.find((x) => x.productId === p.id);
      if (existing) {
        return c.map((x) => (x.productId === p.id ? { ...x, quantity: Math.min(x.stock, x.quantity + 1) } : x));
      }
      return [...c, { productId: p.id, name: p.name, sku: p.sku, price: Number(p.price), quantity: 1, stock: p.quantity }];
    });
  }

  const setQty = (id, v) => setCart((c) => c.map((x) => (x.productId === id
    ? { ...x, quantity: Math.max(1, Math.floor(Number(v)) || 1) } // never 0/NaN
    : x)));

  const subtotal = useMemo(() => cart.reduce((s, l) => s + l.price * l.quantity, 0), [cart]);
  const tax = subtotal * (Number(taxPercent) || 0) / 100;
  const grand = Math.max(0, subtotal + tax - (Number(discount) || 0));
  const overStock = cart.filter((l) => l.quantity > l.stock);

  async function submit() {
    setError(''); setBusy(true);
    try {
      const res = await api.post('/orders', {
        customerId: Number(customerId),
        items: cart.map(({ productId, quantity }) => ({ productId, quantity })),
        taxPercent: Number(taxPercent) || 0,
        discount: Number(discount) || 0,
      });
      toast.success(`Total ${inr(res.data.data.grandTotal)}`, `Order #${res.data.data.orderId} created`);
      navigate('/orders');
    } catch (err) {
      setError(errMsg(err)); // e.g. 422 insufficient stock if it changed since page load
      setBusy(false);
    }
  }

  const columns = [
    {
      key: 'name', label: 'Product', primary: true,
      render: (l) => <><span className="cell-strong">{l.name}</span><span className="cell-sub mono">{l.sku} · {l.stock} in stock</span></>,
    },
    { key: 'price', label: 'Price', align: 'right', render: (l) => <span className="num">{inrExact(l.price)}</span> },
    {
      key: 'quantity', label: 'Qty',
      render: (l) => (
        <input className="input qty-input num" type="number" min="1" max={l.stock} inputMode="numeric"
               aria-label={`Quantity of ${l.name}`} aria-invalid={l.quantity > l.stock || undefined}
               value={l.quantity} onChange={(e) => setQty(l.productId, e.target.value)} />
      ),
    },
    { key: 'line', label: 'Line total', align: 'right', render: (l) => <span className="num cell-strong">{inrExact(l.price * l.quantity)}</span> },
    {
      key: 'actions', label: '', actions: true,
      render: (l) => (
        <Button size="sm" variant="ghost-danger" iconOnly icon="trash" aria-label={`Remove ${l.name}`}
                onClick={() => setCart((c) => c.filter((x) => x.productId !== l.productId))} />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="New order"
        description="Pick a customer, add products, and confirm. Stock is reserved the moment you confirm."
        actions={<Link to="/orders" className="btn btn-ghost"><Icon name="chevronLeft" size={16} /> All orders</Link>}
      />
      <Alert>{error}</Alert>

      <div className="order-layout">
        <div className="stack">
          <Card title="Customer" pad>
            {customers.length === 0 && !error ? (
              <Alert tone="info">No customers yet. <Link to="/customers">Add a customer</Link> before creating an order.</Alert>
            ) : (
              <Field label="Bill to">
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">Select a customer…</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            )}
          </Card>

          <Card title="Items" subtitle={cart.length ? `${cart.length} ${cart.length === 1 ? 'product' : 'products'}` : undefined}>
            <div className="card-body" style={{ paddingBottom: cart.length ? 'var(--sp-4)' : undefined }}>
              <Field label="Add a product" hint="Search by name or SKU. Enter adds the first match." className="no-mb">
                <div>
                  <div className="input-group">
                    <Icon name="search" size={16} />
                    <input className="input" type="search" value={query} placeholder="e.g. Laptop or LAP-001"
                           onChange={(e) => setQuery(e.target.value)} aria-label="Search products to add"
                           onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (results[0]?.quantity > 0) addToCart(results[0]); } }} />
                  </div>
                  {q && (
                    <div className="results" role="group" aria-label="Matching products">
                      {searching && <div className="result-item muted">Searching…</div>}
                      {!searching && results.length === 0 && <div className="result-item muted">No products match “{q}”.</div>}
                      {results.map((p) => {
                        const inCart = cart.find((x) => x.productId === p.id)?.quantity || 0;
                        const left = p.quantity - inCart;
                        return (
                          <button key={p.id} type="button" className="result-item"
                                  onClick={() => addToCart(p)} disabled={left <= 0}>
                            <span>
                              <span className="cell-strong">{p.name}</span>
                              <span className="cell-sub mono">{p.sku}</span>
                            </span>
                            <span className="row num" style={{ flexWrap: 'nowrap' }}>
                              {inrExact(p.price)}
                              <span className="muted">{p.quantity === 0 ? 'out of stock' : left <= 0 ? 'all in cart' : `${left} left`}</span>
                              <Icon name="plus" size={16} />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Field>
            </div>
            {cart.length > 0 && <DataTable caption="Order items" columns={columns} rows={cart} rowKey="productId" />}
          </Card>
        </div>

        <Card title="Summary" className="order-summary" pad>
          <div className="form-grid">
            <Field label="Tax %">
              <input type="number" min="0" max="100" step="0.01" inputMode="decimal" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} />
            </Field>
            <Field label="Discount (₹)">
              <input type="number" min="0" step="0.01" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </Field>
          </div>
          <div className="summary-row"><span>Subtotal</span><span>{inrExact(subtotal)}</span></div>
          <div className="summary-row"><span>Tax</span><span>{inrExact(tax)}</span></div>
          <div className="summary-row"><span>Discount</span><span>−{inrExact(discount)}</span></div>
          <div className="summary-total"><span>Total</span><span>{inrExact(grand)}</span></div>
          <p className="field-hint" style={{ margin: '8px 0 16px' }}>
            A preview. The server recalculates every amount from current prices when you confirm.
          </p>
          {overStock.length > 0 && (
            <Alert tone="warning">Only {overStock[0].stock} of {overStock[0].name} in stock. Lower the quantity to continue.</Alert>
          )}
          <Button variant="primary" block loading={busy} onClick={submit}
                  disabled={!customerId || cart.length === 0 || overStock.length > 0}>
            {busy ? 'Placing order…' : 'Confirm order'}
          </Button>
        </Card>
      </div>
    </>
  );
}
