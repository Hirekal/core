import { LifeBuoy } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import EmptyState from '../../components/common/EmptyState';

export default function SupportPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <PageHeader
        title="Support"
        description="Help & documentation"
        breadcrumbs={[{ label: 'Support' }]}
      />
      <EmptyState
        icon={LifeBuoy}
        title="Support"
        description="Help & documentation coming soon."
      />
    </div>
  );
}
