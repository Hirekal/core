/**
 * @fileoverview Invoice history page with download support.
 */
import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/common/Card';
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
    const rows = await billingService.getMyInvoices();
    setInvoices(rows);
    setPage(1);
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    loadInvoices()
      .catch((err) => setError(toUserErrorMessage(err, 'Failed to load payments')))
      .finally(() => setLoading(false));
  }, [loadInvoices]);

  /*
   * Opens the hosted invoice PDF or payment page in a new browser tab.
   */
  const handleDownloadInvoice = (invoice: Invoice) => {
    try {
      const url = invoice.invoicePdf ?? invoice.invoiceUrl;
      if (!url) {
        showError(new Error('Payment download unavailable'), 'Payment download failed');
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      showError(err, 'Payment download failed');
    }
  };

  /*
   * Opens the Stripe payment receipt in a new browser tab.
   */
  // const handleDownloadReceipt = (invoice: Invoice) => {
  //   try {
  //     if (!invoice.receiptUrl) {
  //       showError(new Error('Receipt download unavailable'), 'Receipt download failed');
  //       return;
  //     }
  //     window.open(invoice.receiptUrl, '_blank', 'noopener,noreferrer');
  //   } catch (err) {
  //     showError(err, 'Receipt download failed');
  //   }
  // };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <PageHeader
          title="Payments"
          description="View and download your payment history"
          breadcrumbs={[{ label: 'Payments' }]}
        />
        <Card padding={false}>
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-sm font-semibold text-heading">Payment history</h3>
          </div>
          <div className="p-5">
            <InvoiceTable
              invoices={[]}
              loading
              page={1}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              onDownloadInvoice={handleDownloadInvoice}
              // onDownloadReceipt={handleDownloadReceipt}
            />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <PageHeader
        title="Payments"
        description="View and download your payment history"
        breadcrumbs={[{ label: 'Payments' }]}
      />

      {error && <BillingErrorState message={error} onRetry={loadInvoices} />}

      <Card padding={false}>
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-heading">Payment history</h3>
        </div>
        <div className="p-5">
          <InvoiceTable
            invoices={invoices}
            loading={loading}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            onDownloadInvoice={handleDownloadInvoice}
            // onDownloadReceipt={handleDownloadReceipt}
          />
        </div>
      </Card>
    </div>
  );
}
