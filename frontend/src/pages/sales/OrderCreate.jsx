// Order creation: local cart of {productId, quantity}. Totals are PREVIEWED
// client-side but the server recomputes everything from DB prices - the
// client only ever sends intent (ids + quantities), never money.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../../api/axios.js';
import { inr } from '../../utils/format.js';

export default function OrderCreate() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [cart, setCart] = useState([]); // {productId, name, price, quantity, stock}
  const [taxPercent, setTaxPercent] = useState(18);
  const [discount, setDiscount] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/customers', { params: { limit: 100 } }).then((r) => setCustomers(r.data.rows));
  }, []);

  // Debounced product search against the API.
  useEffect(() => {
    if (!search) { setResults([]); return; }
    const t = setTimeout(() => {
      api.get('/products', { params: { search, limit: 5 } }).then((r) => setResults(r.data.rows));
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  function addToCart(p) {
    setSearch(''); setResults([]);
    setCart((c) => {
      const existing = c.find((x) => x.productId === p.id);
      if (existing) return c.map((x) => x.productId === p.id ? { ...x, quantity: x.quantity + 1 } : x);
      return [...c, { productId: p.id, name: p.name, price: Number(p.price), quantity: 1, stock: p.quantity }];
    });
  }

  const subtotal = useMemo(() => cart.reduce((s, l) => s + l.price * l.quantity, 0), [cart]);
  const tax = subtotal * (Number(taxPercent) || 0) / 100;
  const grand = subtotal + tax - (Number(discount) || 0);

  async function submit() {
    setError(''); setBusy(true);
    try {
      const res = await api.post('/orders', {
        customerId: Number(customerId),
        items: cart.map(({ productId, quantity }) => ({ productId, quantity })),
        taxPercent: Number(taxPercent) || 0,
        discount: Number(discount) || 0,
      });
      alert(`Order #${res.data.data.orderId} created — total ${inr(res.data.data.grandTotal)}`);
      navigate('/orders');
    } catch (err) {
      setError(errMsg(err)); // e.g. 422 insufficient stock if it changed since page load
    } finally { setBusy(false); }
  }

  return (
    <>
      <h2>New order</h2>
      {error && <div className="error">{error}</div>}

      <div className="card">
        <label>Customer</label>
        <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">Select customer…</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <label>Add product</label>
        <input placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {results.length > 0 && (
          <div className="card" style={{ marginTop: 6, padding: 6 }}>
            {results.map((p) => (
              <div key={p.id} className="row-between" style={{ padding: '6px 8px', marginBottom: 0 }}>
                <span>{p.name} · {inr(p.price)} · stock {p.quantity}</span>
                <button className="btn" onClick={() => addToCart(p)} disabled={p.quantity === 0}>Add</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3>Items</h3>
        <table>
          <thead><tr><th>Product</th><th>Price</th><th>Qty</th><th>Line total</th><th></th></tr></thead>
          <tbody>
            {cart.length === 0 && <tr><td colSpan={5} className="empty">Cart is empty</td></tr>}
            {cart.map((l) => (
              <tr key={l.productId}>
                <td>{l.name}</td>
                <td>{inr(l.price)}</td>
                <td style={{ width: 90 }}>
                  <input type="number" min="1" max={l.stock} value={l.quantity}
                    onChange={(e) => setCart((c) => c.map((x) =>
                      x.productId === l.productId
                        ? { ...x, quantity: Math.max(1, Math.floor(Number(e.target.value)) || 1) } // never 0/NaN
                        : x))} />
                </td>
                <td>{inr(l.price * l.quantity)}</td>
                <td><button className="btn btn-danger" onClick={() =>
                  setCart((c) => c.filter((x) => x.productId !== l.productId))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="row">
          <div style={{ width: 140 }}>
            <label>Tax %</label>
            <input type="number" min="0" max="100" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} />
          </div>
          <div style={{ width: 160 }}>
            <label>Discount (₹)</label>
            <input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 14, lineHeight: 1.9 }}>
          Subtotal: <b>{inr(subtotal)}</b> · Tax: <b>{inr(tax)}</b> · Discount: <b>−{inr(discount)}</b>
          <div style={{ fontSize: 18 }}>Grand total (preview): <b>{inr(grand)}</b></div>
          <div className="hint">Final amounts are computed by the server from database prices.</div>
        </div>
        <div style={{ marginTop: 10 }}>
          <button className="btn btn-primary" disabled={busy || !customerId || cart.length === 0} onClick={submit}>
            {busy ? 'Placing order…' : 'Confirm order'}
          </button>
        </div>
      </div>
    </>
  );
}
