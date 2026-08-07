/**
 * @fileoverview Paginated invoice history table.
 */
import { FileText, MoreHorizontal, Receipt } from 'lucide-react';
import Table from '../common/Table';
import Button from '../common/Button';
import Badge from '../common/Badge';
import EmptyState from '../common/EmptyState';
import Dropdown from '../common/Dropdown';
import { formatDate } from '../../utils/formatDate';
import { formatMoney, invoiceBadgeStatus } from '../../utils/billingFormat';
import type { Invoice } from '../../types/billing';

interface InvoiceTableProps {
  invoices: Invoice[];
  loading?: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onDownloadInvoice: (invoice: Invoice) => void;
  onDownloadReceipt: (invoice: Invoice) => void;
}

interface InvoiceActionsMenuProps {
  invoice: Invoice;
  onDownloadInvoice: (invoice: Invoice) => void;
  onDownloadReceipt: (invoice: Invoice) => void;
}

/**
 * Three-dot actions menu with Invoice and Receipt downloads.
 */
function InvoiceActionsMenu({
  invoice,
  onDownloadInvoice,
  onDownloadReceipt,
}: InvoiceActionsMenuProps) {
  const canInvoice = Boolean(invoice.invoicePdf || invoice.invoiceUrl);
  const canReceipt = Boolean(
    invoice.receiptUrl && invoice.receiptUrl.includes('/receipts/'),
  );

  return (
    <Dropdown
      align="right"
      trigger={
        <button
          type="button"
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-hover hover:text-heading"
          aria-label="Payment actions"
        >
          <MoreHorizontal size={18} />
        </button>
      }
      items={[
        {
          label: 'Invoice',
          icon: <FileText size={16} />,
          disabled: !canInvoice,
          onClick: () => onDownloadInvoice(invoice),
        },
        {
          label: 'Receipt',
          icon: <Receipt size={16} />,
          disabled: !canReceipt,
          onClick: () => onDownloadReceipt(invoice),
        },
      ]}
    />
  );
}

/**
 * Renders invoice rows with client-side pagination and download actions.
 */
export default function InvoiceTable({
  invoices,
  loading = false,
  page,
  pageSize,
  onPageChange,
  onDownloadInvoice,
  onDownloadReceipt,
}: InvoiceTableProps) {
  const totalPages = Math.max(1, Math.ceil(invoices.length / pageSize));
  const start = (page - 1) * pageSize;
  const pageRows = invoices.slice(start, start + pageSize);

  if (!loading && invoices.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No payments yet"
        description="Payments will appear here after your first charge."
      />
    );
  }

  const columns = [
    {
      key: 'planName',
      label: 'Plan',
      render: (row: Invoice) => (
        <span className="font-medium text-heading">{row.planName ?? 'Subscription'}</span>
      ),
    },
    {
      key: 'date',
      label: 'Payment date',
      render: (row: Invoice) => formatDate(row.paidAt ?? row.createdAt),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (row: Invoice) => (
        <div>
          <span className="font-medium text-heading">
            {formatMoney(
              row.invoiceStatus === 'PAID' ? row.amountPaid : row.amountDue,
              row.currency,
            )}
          </span>
          {typeof row.discountAmount === 'number' && row.discountAmount > 0 && (
            <p className="mt-0.5 text-xs text-[#0d9488]">
              Discount
              {row.discountLabel ? ` (${row.discountLabel})` : ''}: -
              {formatMoney(row.discountAmount, row.currency)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: Invoice) => (
        <Badge status={invoiceBadgeStatus(row.invoiceStatus)}>{row.invoiceStatus}</Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '80px',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      render: (row: Invoice) => (
        <InvoiceActionsMenu
          invoice={row}
          onDownloadInvoice={onDownloadInvoice}
          onDownloadReceipt={onDownloadReceipt}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Table columns={columns} data={pageRows} loading={loading} emptyMessage="No payments" />
      {invoices.length > pageSize && (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
