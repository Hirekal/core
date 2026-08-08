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
   * Converts a Stripe hosted receipt page into a direct PDF download URL.
   * Only accepts real charge receipt URLs under /receipts/ (never invoice PDFs).
   */
  const toReceiptPdfDownloadUrl = (receiptUrl: string): string | null => {
    try {
      const parsed = new URL(receiptUrl);
      if (
        !/pay\.stripe\.com$/i.test(parsed.hostname) ||
        !parsed.pathname.includes('/receipts/')
      ) {
        return null;
      }

      const path = parsed.pathname.replace(/\/$/, '');
      parsed.pathname = path.endsWith('/pdf') ? path : `${path}/pdf`;
      parsed.search = 's=ap';
      return parsed.toString();
    } catch {
      return null;
    }
  };

  /*
   * Opens the Stripe payment receipt PDF (not the invoice) in a new browser tab.
   */
  const handleDownloadReceipt = (invoice: Invoice) => {
    try {
      const receiptPdfUrl = invoice.receiptUrl
        ? toReceiptPdfDownloadUrl(invoice.receiptUrl)
        : null;
      if (!receiptPdfUrl) {
        showError(new Error('Receipt download unavailable'), 'Receipt download failed');
        return;
      }
      window.open(receiptPdfUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      showError(err, 'Receipt download failed');
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <PageHeader
          title="Payments"
          description="View and download your payment history"
          breadcrumbs={[
            { to: '/billing/plans', label: 'Billing' },
            { label: 'Payments' },
          ]}
        />
        <Card padding={false}>
          <div className="">
            <InvoiceTable
              invoices={[]}
              loading
              page={1}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              onDownloadInvoice={handleDownloadInvoice}
              onDownloadReceipt={handleDownloadReceipt}
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
        breadcrumbs={[
          { to: '/billing/plans', label: 'Billing' },
          { label: 'Payments' },
        ]}
      />

      {error && <BillingErrorState message={error} onRetry={loadInvoices} />}

      <Card padding={false}>
        <div className="">
          <InvoiceTable
            invoices={invoices}
            loading={loading}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            onDownloadInvoice={handleDownloadInvoice}
            onDownloadReceipt={handleDownloadReceipt}
          />
        </div>
      </Card>
    </div>
  );
}
