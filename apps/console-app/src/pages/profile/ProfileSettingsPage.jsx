import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, ExternalLink } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Toggle from '../../components/common/Toggle';
import Card from '../../components/common/Card';
import { useAuth } from '../../context/AuthContext';
import * as authService from '../../services/authService';

export default function ProfileSettingsPage() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [theme, setTheme] = useState(user?.theme || 'light');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await updateUser({ name, email, theme });
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
    <div>
      <PageHeader title="Profile Settings" description="Manage your account preferences" />

      {message && <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-600">{message}</div>}
      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      <div className="max-w-2xl space-y-6">
        <Card>
          <h3 className="text-lg font-semibold mb-4">My Account</h3>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Change Password</h3>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <Input label="Current Password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            <Input label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <Button type="submit" variant="secondary">Update Password</Button>
          </form>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Preferences</h3>
          <Toggle
            label="Dark mode"
            description="Switch to dark theme (stretch goal — light mode is primary)"
            checked={theme === 'dark'}
            onChange={(v) => setTheme(v ? 'dark' : 'light')}
          />
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Support</h3>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
          >
            <ExternalLink size={16} /> Support Center
          </a>
        </Card>

        <Button variant="danger" onClick={handleLogout}>
          <LogOut size={16} /> Logout
        </Button>
      </div>
    </div>
  );
}
