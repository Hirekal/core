import { useCallback, useEffect, useState } from 'react';
import { Building2, Users, Briefcase, Calendar, UserPlus, Trash2 } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/common/Card';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Modal from '../../components/common/Modal';
import Table from '../../components/common/Table';
import AddTeamMemberModal from '../../components/organization/AddTeamMemberModal';
import { useAuth } from '../../context/AuthContext';
import * as organizationService from '../../services/organizationService';
import { formatDate } from '../../utils/formatDate';
import { toUserErrorMessage } from '../../utils/errorMessage';

export default function OrganizationPage() {
  const { user } = useAuth();
  const organizationId = user?.organizationId;

  const [org, setOrg] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [orgName, setOrgName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState('');

  const loadData = useCallback(async () => {
    if (!organizationId) {
      throw new Error('No organization linked to your account');
    }

    const [orgData, membersData] = await Promise.all([
      organizationService.getOrganization(organizationId),
      organizationService.getTeamMembers(organizationId, user?.id),
    ]);
    setOrg(orgData);
    setOrgName(orgData.name || '');
    setMembers(membersData);
  }, [organizationId, user?.id]);

  useEffect(() => {
    setLoading(true);
    setError('');
    loadData()
      .catch((err) => {
        if (err.status !== 401) {
          setError(toUserErrorMessage(err, 'Failed to load organization'));
        }
        setOrg(null);
        setMembers([]);
      })
      .finally(() => setLoading(false));
  }, [loadData]);

  const handleSaveName = async (e) => {
    e.preventDefault();
    if (!organizationId || !orgName.trim()) return;

    setSavingName(true);
    setNameMessage('');
    setError('');
    try {
      const updated = await organizationService.updateOrganization(organizationId, {
        name: orgName.trim(),
      });
      setOrg((prev) => ({ ...prev, name: updated.name }));
      setNameMessage('Organization name updated');
      setTimeout(() => setNameMessage(''), 3000);
    } catch (err) {
      setError(toUserErrorMessage(err, 'Failed to update organization'));
    } finally {
      setSavingName(false);
    }
  };

  const handleAddMember = async (data) => {
    const result = await organizationService.addTeamMember(data);
    await loadData();
    return result;
  };

  const handleDeleteMember = async () => {
    if (!memberToDelete) return;

    setDeleting(true);
    setDeleteError('');

    try {
      await organizationService.deleteTeamMember(memberToDelete.id, {
        currentUserId: user?.id,
        role: memberToDelete.role,
      });
      setMemberToDelete(null);
      await loadData();
    } catch (err) {
      setDeleteError(toUserErrorMessage(err, 'Unable to remove team member'));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  if (!org) {
    return (
      <div className="mx-auto w-full max-w-6xl py-16 text-center text-muted">
        {error || 'Organization not found'}
      </div>
    );
  }

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row) => (
        <div>
          <p className="font-medium">
            {row.name}
            {row.id === user?.id ? (
              <span className="ml-2 text-xs font-normal text-muted">(you)</span>
            ) : null}
          </p>
          <p className="text-xs text-muted">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (row) => (
        <span className="text-sm text-heading">{row.role}</span>
      ),
    },
    {
      key: 'joinedAt',
      label: 'Joined',
      render: (row) => formatDate(row.joinedAt),
    },
    {
      key: 'actions',
      label: '',
      width: '80px',
      render: (row) =>
        String(row.role || '').toLowerCase() === 'admin' || row.id === user?.id ? null : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteError('');
              setMemberToDelete(row);
            }}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            title="Remove team member"
          >
            <Trash2 size={16} />
          </button>
        ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="Organization"
        description="Manage your organization settings"
      />

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}
      {nameMessage && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {nameMessage}
        </div>
      )}

      <div className="space-y-6">
        <Card>
          <div className="flex items-center gap-4 mb-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Building2 size={28} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-heading">{org.name}</h2>
              <p className="text-sm text-muted">{org.plan} Plan</p>
            </div>
          </div>

          <form onSubmit={handleSaveName} className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                label="Organization name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={savingName || orgName.trim() === org.name}>
              {savingName ? 'Saving...' : 'Save name'}
            </Button>
          </form>

          <div className="grid gap-4 sm:grid-cols-3">
            <InfoItem icon={Users} label="Team Members" value={org.members} />
            <InfoItem icon={Briefcase} label="Active Jobs" value={org.jobsCount} />
            <InfoItem icon={Calendar} label="Member Since" value={formatDate(org.createdAt)} />
          </div>
        </Card>

        <Card padding={false}>
          <div className="flex flex-col gap-4 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-heading">Team Members</h3>
              <p className="text-sm text-muted">
                {members.length} {members.length === 1 ? 'member' : 'members'} in your organization
              </p>
            </div>
            <Button onClick={() => setShowAddModal(true)}>
              <UserPlus size={16} />
              Add Team Member
            </Button>
          </div>

          <Table
            columns={columns}
            data={members}
            emptyMessage="No team members yet. Add your first team member to get started."
          />
        </Card>
      </div>

      <AddTeamMemberModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddMember}
      />

      <Modal
        isOpen={!!memberToDelete}
        onClose={() => {
          setMemberToDelete(null);
          setDeleteError('');
        }}
        title="Remove Team Member"
        size="sm"
      >
        <p className="text-sm text-muted">
          Remove access for <strong className="text-heading">{memberToDelete?.name}</strong>?
          They will no longer be able to sign in to this organization.
        </p>

        {deleteError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
            {deleteError}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              setMemberToDelete(null);
              setDeleteError('');
            }}
          >
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeleteMember} disabled={deleting}>
            {deleting ? 'Removing...' : 'Remove Member'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/70 bg-hover/20 px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-muted">
        <Icon size={16} />
        {label}
      </div>
      <span className="text-sm font-semibold text-heading">{value}</span>
    </div>
  );
}
