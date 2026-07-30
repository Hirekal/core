import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, ExternalLink, User, Lock, Palette, LifeBuoy } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import ThemeSelector from '../../components/profile/ThemeSelector';
import { useAuth } from '../../context/AuthContext';
import * as authService from '../../services/authService';

function SettingsCard({ icon: Icon, title, description, children, className = '' }) {
  return (
    <Card className={`flex h-full flex-col p-6 sm:p-8 ${className}`} padding={false}>
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-heading">{title}</h3>
          {description && <p className="text-sm text-muted">{description}</p>}
        </div>
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </Card>
  );
}

function FormFooter({ children }) {
  return (
    <div className="mt-6 flex justify-end">
      {children}
    </div>
  );
}

export default function ProfileSettingsPage() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await updateUser({ name: name.trim(), email: email.trim() });
      setMessage('Profile updated successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await authService.changePassword(currentPassword, newPassword);
      setMessage('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl">
      <PageHeader title="Profile Settings" description="Manage your account preferences" />

      {message && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-400">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <SettingsCard
            icon={User}
            title="My Account"
            description="Update your personal information"
          >
            <form onSubmit={handleSaveProfile} className="flex flex-1 flex-col">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Full Name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Input
                  label="Email"
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <FormFooter>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </FormFooter>
            </form>
          </SettingsCard>

          <SettingsCard
            icon={Lock}
            title="Change Password"
            description="At least 8 characters required"
          >
            <form onSubmit={handleChangePassword} className="flex flex-1 flex-col">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Current Password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <Input
                  label="New Password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <FormFooter>
                <Button type="submit" variant="secondary">
                  Update Password
                </Button>
              </FormFooter>
            </form>
          </SettingsCard>
        </div>

        <SettingsCard
          icon={Palette}
          title="Appearance"
          description="Choose how Hirekal looks for you"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <ThemeSelector />
            <p className="text-sm text-muted">Saved automatically to your account</p>
          </div>
        </SettingsCard>

        <div className="grid gap-8 lg:grid-cols-2">
          <SettingsCard
            icon={LifeBuoy}
            title="Support"
            description="Get help when you need it"
          >
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-input px-4 py-2.5 text-sm font-medium text-heading transition-colors hover:border-accent/40 hover:bg-hover"
            >
              <ExternalLink size={16} className="text-accent" />
              Visit Support Center
            </a>
          </SettingsCard>

          <SettingsCard
            icon={LogOut}
            title="Sign out"
            description="End your session on this device"
            className="border-red-200 dark:border-red-900/40"
          >
            <div className="mt-auto">
              <Button variant="danger" onClick={handleLogout} className="w-full">
                <LogOut size={16} />
                Logout
              </Button>
            </div>
          </SettingsCard>
        </div>
      </div>
    </div>
  );
}
