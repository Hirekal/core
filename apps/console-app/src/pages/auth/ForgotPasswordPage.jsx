import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { AuthLayout } from './SignUpPage';
import * as authService from '../../services/authService';
import { validateForgotPasswordEmail } from '../../utils/validators';
import { toUserErrorMessage } from '../../utils/errorMessage';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');

  const clearFieldError = (field) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const errors = validateForgotPasswordEmail(email);
    if (errors) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setLoading(true);

    try {
      const trimmedEmail = email.trim();
      await authService.requestPasswordReset(trimmedEmail);
      setSentEmail(trimmedEmail);
      setSent(true);
    } catch (err) {
      setError(toUserErrorMessage(err, 'Unable to send reset email'));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout title="Check your email" subtitle="We sent you a password reset code">
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
            <Mail size={28} />
          </div>

          <div className="rounded-lg border border-border bg-hover/30 px-4 py-3 text-sm">
            <p className="text-muted">Reset code sent to</p>
            <p className="font-medium text-heading">{sentEmail}</p>
          </div>

          <p className="text-sm text-muted">
            Enter the code from your email to set a new password. If you don&apos;t see it, check
            your spam folder.
          </p>

          <Button
            className="w-full"
            onClick={() =>
              navigate(`/reset-password?email=${encodeURIComponent(sentEmail)}`)
            }
          >
            Enter reset code
          </Button>

          <Link to="/login" className="block text-sm text-accent hover:underline">
            Back to login
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a reset code">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </div>
        )}

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

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Sending...' : 'Send Reset Code'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        <Link to="/login" className="text-accent hover:underline">
          Back to login
        </Link>
      </p>
    </AuthLayout>
  );
}
