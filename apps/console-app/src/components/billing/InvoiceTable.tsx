/**
 * @fileoverview Paginated invoice history table.
 */
import { Download } from 'lucide-react';
import Table from '../common/Table';
import Button from '../common/Button';
import Badge from '../common/Badge';
import EmptyState from '../common/EmptyState';
import { FileText } from 'lucide-react';
import { formatDate } from '../../utils/formatDate';
import { formatMoney, invoiceBadgeStatus } from '../../utils/billingFormat';
import type { Invoice } from '../../types/billing';

interface InvoiceTableProps {
  invoices: Invoice[];
  loading?: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onDownload: (invoice: Invoice) => void;
}

/**
 * Renders invoice rows with client-side pagination and download action.
 */
export default function InvoiceTable({
  invoices,
  loading = false,
  page,
  pageSize,
  onPageChange,
  onDownload,
}: InvoiceTableProps) {
  const totalPages = Math.max(1, Math.ceil(invoices.length / pageSize));
  const start = (page - 1) * pageSize;
  const pageRows = invoices.slice(start, start + pageSize);

  if (!loading && invoices.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No invoices yet"
        description="Invoices will appear here after your first payment."
      />
    );
  }

  const columns = [
    {
      key: 'number',
      label: 'Invoice',
      render: (row: Invoice) => (
        <span className="font-medium text-heading">{row.providerInvoiceId}</span>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      render: (row: Invoice) => formatDate(row.createdAt),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (row: Invoice) => formatMoney(row.amountDue, row.currency),
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
      label: '',
      width: '120px',
      render: (row: Invoice) => (
        <Button
          variant="ghost"
          size="sm"
          disabled={!row.invoicePdf && !row.invoiceUrl}
          onClick={(event) => {
            event.stopPropagation();
            onDownload(row);
          }}
        >
          <Download size={16} />
          Download
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Table columns={columns} data={pageRows} loading={loading} emptyMessage="No invoices" />
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
