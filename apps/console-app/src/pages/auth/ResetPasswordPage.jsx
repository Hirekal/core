import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { AuthLayout } from './SignUpPage';
import * as authService from '../../services/authService';
import {
  validateEmail,
  validatePasswordResetFields,
  validateRequired,
} from '../../utils/validators';
import { toUserErrorMessage } from '../../utils/errorMessage';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [code, setCode] = useState('');
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

    const errors = {
      ...(validatePasswordResetFields({ password, confirmPassword }) || {}),
    };
    const emailError = validateEmail(email);
    if (emailError) errors.email = emailError;
    const codeError = validateRequired(code, 'Reset code');
    if (codeError) errors.code = codeError;

    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setLoading(true);

    try {
      await authService.resetPassword(email.trim(), code.trim(), password);
      setDone(true);
    } catch (err) {
      setError(toUserErrorMessage(err, 'Unable to reset password'));
    } finally {
      setLoading(false);
    }
  };

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
    <AuthLayout title="Set new password" subtitle="Enter the code from your email">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Input
          label="Email"
          type="text"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearFieldError('email');
          }}
          error={fieldErrors.email}
          required
        />

        <Input
          label="Reset code"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            clearFieldError('code');
          }}
          error={fieldErrors.code}
          required
        />

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
        <Link to="/forgot-password" className="text-accent hover:underline">
          Resend code
        </Link>
        {' · '}
        <Link to="/login" className="text-accent hover:underline">
          Back to login
        </Link>
      </p>
    </AuthLayout>
  );
}
