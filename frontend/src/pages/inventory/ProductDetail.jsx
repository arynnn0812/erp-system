// One product: key facts, its full stock ledger (every movement with the
// balance after it) and attached documents.
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApi, usePagedList } from '../../hooks/useApi.js';
import DataTable from '../../components/ui/DataTable.jsx';
import DocumentsPanel from '../../components/DocumentsPanel.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { Badge, Card, EmptyState, Skeleton } from '../../components/ui/index.jsx';
import { inrExact, tsDateTime } from '../../utils/format.js';

// Ledger references are machine-written; show them in words and link orders.
function Reference({ value }) {
  if (!value) return <span className="muted">—</span>;
  const order = /^ORDER-(\d+)$/.exec(value);
  if (order) return <Link to={`/orders/${order[1]}`}>Order #{order[1]}</Link>;
  const cancel = /^ORDER-(\d+)-CANCEL$/.exec(value);
  if (cancel) return <Link to={`/orders/${cancel[1]}`}>Cancelled order #{cancel[1]}</Link>;
  if (value === 'OPENING_STOCK') return 'Opening stock';
  return value;
}

export default function ProductDetail() {
  const { id } = useParams();
  const { hasRole } = useAuth();
  const product = useApi(`/products/${id}`);
  const ledger = usePagedList(`/products/${id}/transactions`, {}, { limit: 15 });
  const p = product.data;

  if (product.error) {
    return <EmptyState icon="box" title="Product not found" message={product.error}
                       action={<Link to="/inventory" className="btn btn-sm">Back to products</Link>} />;
  }

  const stockBadge = !p ? null : p.quantity === 0 ? <Badge tone="danger" dot>Out of stock</Badge>
    : p.quantity < p.reorder_level ? <Badge tone="warning" dot>Below reorder level</Badge>
      : <Badge tone="success" dot>In stock</Badge>;

  return (
    <>
      <div className="page-header">
        <div>
          <Link to="/inventory" className="back-link"><Icon name="chevronLeft" size={15} /> Products</Link>
          <h1>{p ? p.name : <Skeleton width={260} height={26} />}</h1>
          {p && <p className="mono">{p.sku}</p>}
        </div>
      </div>

      <div className="stack">
        <Card pad>
          {!p ? <Skeleton height={48} /> : (
            <dl className="detail-grid">
              <div><dt>On hand</dt><dd className="num" style={{ fontSize: 22 }}>{p.quantity}</dd></div>
              <div><dt>Status</dt><dd>{stockBadge}</dd></div>
              <div><dt>Reorder level</dt><dd className="num">{p.reorder_level}</dd></div>
              <div><dt>Price</dt><dd className="num">{inrExact(p.price)}</dd></div>
              <div><dt>Stock value</dt><dd className="num">{inrExact(p.price * p.quantity)}</dd></div>
              <div><dt>Category</dt><dd>{p.category}</dd></div>
              <div><dt>Supplier</dt><dd>{p.supplier || <span className="muted">—</span>}</dd></div>
            </dl>
          )}
        </Card>

        <Card title="Stock history" subtitle="Every movement, newest first">
          <DataTable
            caption="Stock history"
            rows={ledger.rows} loading={ledger.loading} error={ledger.error}
            page={ledger.page} pages={ledger.pages} total={ledger.total} onPage={ledger.setPage}
            empty={{ icon: 'arrowUpDown', title: 'No stock movements yet' }}
            columns={[
              { key: 'created_at', label: 'When', render: (t) => <span className="nowrap">{tsDateTime(t.created_at)}</span> },
              {
                key: 'type', label: 'Movement',
                render: (t) => (t.type === 'IN'
                  ? <Badge tone="success">+{t.quantity} in</Badge>
                  : <Badge tone="warning">−{t.quantity} out</Badge>),
              },
              { key: 'reference', label: 'Reference', render: (t) => <Reference value={t.reference} /> },
              { key: 'performed_by', label: 'By' },
              { key: 'balance_after', label: 'Balance', align: 'right', render: (t) => <span className="num cell-strong">{t.balance_after}</span> },
            ]}
          />
        </Card>

        <DocumentsPanel ownerType="PRODUCT" ownerId={Number(id)} canWrite={hasRole('ADMIN', 'MANAGER')} title="Product documents" />
      </div>
    </>
  );
}
