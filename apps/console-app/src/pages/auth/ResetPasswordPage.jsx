import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { AuthLayout } from './SignUpPage';
import * as authService from '../../services/authService';
import { validatePasswordResetFields } from '../../utils/validators';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const email = searchParams.get('email') || '';
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const clearFieldError = (field) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const errors = validatePasswordResetFields({ password, confirmPassword });
    if (errors) {
      setFieldErrors(errors);
      return;
    }

    if (!token || !email) {
      setError('Invalid or expired reset link. Please request a new one.');
      return;
    }

    setFieldErrors({});
    setLoading(true);

    try {
      await authService.verifyResetToken(token, email);
      await authService.resetPassword(token, password, email);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!email || !token) {
    return (
      <AuthLayout title="Invalid reset link" subtitle="This password reset link is not valid">
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted">
            Open the reset link from your email to set a new password.
          </p>
          <Link to="/forgot-password">
            <Button className="w-full">Request New Reset Link</Button>
          </Link>
          <p className="text-sm text-muted">
            <Link to="/login" className="text-accent hover:underline">Back to login</Link>
          </p>
        </div>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title="Password updated" subtitle="You can now sign in">
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted">Your password has been successfully updated.</p>
          <Button className="w-full" onClick={() => navigate('/login')}>
            Go to Login
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set new password" subtitle="Choose a strong new password">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="mb-4 rounded-lg border border-border bg-hover/30 px-4 py-3 text-sm">
        <p className="text-muted">Resetting password for</p>
        <p className="font-medium text-heading">{email}</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Input
          label="New Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            clearFieldError('password');
          }}
          error={fieldErrors.password}
          required
        />

        <Input
          label="Confirm Password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            clearFieldError('confirmPassword');
          }}
          error={fieldErrors.confirmPassword}
          required
        />

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Updating...' : 'Update Password'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        <Link to="/login" className="text-accent hover:underline">Back to login</Link>
      </p>
    </AuthLayout>
  );
}
