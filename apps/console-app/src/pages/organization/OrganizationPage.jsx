import { useEffect, useState } from 'react';
import { Building2, Users, Briefcase, Calendar } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/common/Card';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import * as settingsService from '../../services/settingsService';
import { formatDate } from '../../utils/formatDate';

export default function OrganizationPage() {
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    settingsService.getOrganization().then(setOrg).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="Organization"
        description="Manage your organization settings"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center gap-4 mb-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Building2 size={28} />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{org.name}</h2>
              <p className="text-sm text-muted">{org.plan} Plan</p>
            </div>
          </div>

          <div className="space-y-4">
            <InfoItem icon={Users} label="Team Members" value={org.members} />
            <InfoItem icon={Briefcase} label="Active Jobs" value={org.jobsCount} />
            <InfoItem icon={Calendar} label="Member Since" value={formatDate(org.createdAt)} />
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Organization Settings</h3>
          <p className="text-sm text-muted">
            Multi-organization switching and advanced organization management features are coming soon.
            For now, your organization profile is displayed here for reference.
          </p>
        </Card>
      </div>
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <div className="flex items-center gap-2 text-sm text-muted">
        <Icon size={16} />
        {label}
      </div>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
