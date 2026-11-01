import { Badge } from '../../components/ui/index.jsx';

export function OrderStatus({ status }) {
  if (status === 'CONFIRMED') return <Badge tone="success" dot>Confirmed</Badge>;
  if (status === 'CANCELLED') return <Badge tone="neutral" dot>Cancelled</Badge>;
  return <Badge tone="warning" dot>Pending</Badge>;
}
