// One order as an invoice. Amounts come from the stored order (prices are
// snapshotted at sale time), so a reprint always matches what was charged.
// "Print" uses the browser's print dialog; print CSS hides the app chrome,
// which also gives "Save as PDF" for free.
import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import api, { errMsg } from '../../api/axios.js';
import { useApi } from '../../hooks/useApi.js';
import Button from '../../components/ui/Button.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useConfirm } from '../../components/ui/ConfirmDialog.jsx';
import { EmptyState, Skeleton } from '../../components/ui/index.jsx';
import { inrExact, dateLong } from '../../utils/format.js';
import { OrderStatus } from './OrderStatus.jsx';

export default function OrderDetail() {
  const { id } = useParams();
  const toast = useToast();
  const confirm = useConfirm();
  const order = useApi(`/orders/${id}`);
  const o = order.data;
  const customer = useApi(o ? `/customers/${o.customer_id}` : null);
  const [busy, setBusy] = useState(false);

  async function cancel() {
    const ok = await confirm({
      title: `Cancel order #${o.id}?`,
      message: 'Every item goes back into stock. This can\'t be undone.',
      confirmLabel: 'Cancel order', cancelLabel: 'Keep order', danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try { await api.post(`/orders/${o.id}/cancel`); toast.success(`Order #${o.id} cancelled, stock restored`); order.reload(); }
    catch (err) { toast.error(errMsg(err)); }
    finally { setBusy(false); }
  }

  if (order.error) {
    return <EmptyState icon="receipt" title="Order not found" message={order.error}
                       action={<Link to="/orders" className="btn btn-sm">Back to orders</Link>} />;
  }

  const c = customer.data;
  const taxRate = o && Number(o.subtotal) > 0 ? (Number(o.tax) / Number(o.subtotal)) * 100 : 0;

  return (
    <>
      <div className="page-header no-print">
        <div>
          <Link to="/orders" className="back-link"><Icon name="chevronLeft" size={15} /> Orders</Link>
          <h1>Order #{id}</h1>
        </div>
        {o && (
          <div className="row">
            {o.status === 'CONFIRMED' && <Button variant="ghost-danger" loading={busy} onClick={cancel}>Cancel order</Button>}
            <Button variant="primary" icon="printer" onClick={() => window.print()}>Print / PDF</Button>
          </div>
        )}
      </div>

      <article className="card invoice">
        {!o ? (
          <div className="stack"><Skeleton width="40%" height={24} /><Skeleton height={160} /><Skeleton width="30%" height={18} /></div>
        ) : (
          <>
            <header className="invoice-head">
              <div>
                <div className="invoice-brand"><span className="brand-mark" aria-hidden="true">E</span> ERP System</div>
                <p className="muted">Tax invoice</p>
              </div>
              <div className="invoice-meta">
                <div className="invoice-number">#{String(o.id).padStart(5, '0')}</div>
                <div>{dateLong(o.order_date)}</div>
                <OrderStatus status={o.status} />
              </div>
            </header>

            {o.status === 'CANCELLED' && (
              <div className="invoice-void" role="note">Cancelled. This order was reversed and its stock returned.</div>
            )}

            <section className="invoice-parties">
              <div>
                <div className="invoice-label">Bill to</div>
                <div className="cell-strong">{o.customer}</div>
                {c?.address && <div>{c.address}</div>}
                {c?.email && <div>{c.email}</div>}
                {c?.phone && <div>{c.phone}</div>}
              </div>
              <div>
                <div className="invoice-label">Prepared by</div>
                <div>{o.created_by_name}</div>
              </div>
            </section>

            <div className="table-wrap">
              <table className="table invoice-items">
                <thead>
                  <tr><th scope="col">Item</th><th scope="col" className="align-right">Qty</th><th scope="col" className="align-right hide-sm">Unit price</th><th scope="col" className="align-right">Amount</th></tr>
                </thead>
                <tbody>
                  {o.items.map((it) => (
                    <tr key={it.product_id}>
                      <td>
                        <Link to={`/inventory/${it.product_id}`} className="cell-strong">{it.name}</Link>
                        <span className="cell-sub mono">{it.sku}</span>
                      </td>
                      <td className="align-right num">{it.quantity}</td>
                      <td className="align-right num hide-sm">{inrExact(it.unit_price)}</td>
                      <td className="align-right num cell-strong">{inrExact(it.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <section className="invoice-totals">
              <div className="summary-row"><span>Subtotal</span><span>{inrExact(o.subtotal)}</span></div>
              <div className="summary-row"><span>Tax{taxRate ? ` (${Number(taxRate.toFixed(2))}%)` : ''}</span><span>{inrExact(o.tax)}</span></div>
              {Number(o.discount) > 0 && <div className="summary-row"><span>Discount</span><span>−{inrExact(o.discount)}</span></div>}
              <div className="summary-total"><span>Total</span><span>{inrExact(o.grand_total)}</span></div>
            </section>
          </>
        )}
      </article>
    </>
  );
}
