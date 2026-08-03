/**
 * @fileoverview Invoice history page with download support.
 */
import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/common/Card';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import InvoiceTable from '../../components/billing/InvoiceTable';
import BillingErrorState from '../../components/billing/BillingErrorState';
import { useToast } from '../../context/ToastContext';
import * as billingService from '../../services/billingService';
import { toUserErrorMessage } from '../../utils/errorMessage';
import type { Invoice } from '../../types/billing';

const PAGE_SIZE = 10;

/**
 * Lists invoice history with pagination and PDF download links.
 */
export default function InvoicesPage() {
  const { showError } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  /*
   * Loads invoice rows for the default payment provider.
   */
  const loadInvoices = useCallback(async () => {
    try {
      const provider = await billingService.getDefaultPaymentProvider();
      const rows = await billingService.getInvoices(provider.id);
      setInvoices(rows);
      setPage(1);
    } catch (error) {
      throw error;
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    loadInvoices()
      .catch((err) => setError(toUserErrorMessage(err, 'Failed to load invoices')))
      .finally(() => setLoading(false));
  }, [loadInvoices]);

  /*
   * Opens the hosted invoice PDF or payment page in a new browser tab.
   */
  const handleDownload = (invoice: Invoice) => {
    try {
      const url = invoice.invoicePdf ?? invoice.invoiceUrl;
      if (!url) {
        showError(new Error('Invoice download unavailable'), 'Invoice download failed');
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      showError(err, 'Invoice download failed');
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading invoices…" />;
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <PageHeader
        title="Invoices"
        description="View and download your billing history"
        breadcrumbs={[
          { to: '/jobs', label: 'Jobs' },
          { label: 'Billing' },
          { label: 'Invoices' },
        ]}
      />

      {error && <BillingErrorState message={error} onRetry={loadInvoices} />}

      <Card padding={false}>
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-heading">Invoice history</h3>
        </div>
        <div className="p-5">
          <InvoiceTable
            invoices={invoices}
            loading={loading}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            onDownload={handleDownload}
          />
        </div>
      </Card>
    </div>
  );
}
