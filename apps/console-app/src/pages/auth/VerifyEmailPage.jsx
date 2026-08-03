import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { AuthLayout } from './SignUpPage';
import * as authService from '../../services/authService';
import { validateEmail, validateRequired } from '../../utils/validators';
import { toUserErrorMessage } from '../../utils/errorMessage';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [code, setCode] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const clearFieldError = (field) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const errors = {};
    const emailError = validateEmail(email);
    if (emailError) errors.email = emailError;
    const codeError = validateRequired(code, 'Verification code');
    if (codeError) errors.code = codeError;

    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setLoading(true);
    try {
      await authService.verifyCode(
        email.trim(),
        code.trim(),
        authService.CODE_TYPES.EMAIL_VERIFICATION,
      );
      navigate('/login', {
        replace: true,
        state: { message: 'Email verified. You can sign in now.' },
      });
    } catch (err) {
      setError(toUserErrorMessage(err, 'Verification failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setMessage('');

    const emailError = validateEmail(email);
    if (emailError) {
      setFieldErrors({ email: emailError });
      return;
    }

    setResending(true);
    try {
      await authService.resendVerification(email.trim());
      setMessage('If this email needs verification, a new code has been sent.');
    } catch (err) {
      setError(toUserErrorMessage(err, 'Unable to resend code'));
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout title="Verify your email" subtitle="Enter the code we sent to your inbox">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-400">
            {message}
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

        <Input
          label="Verification code"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            clearFieldError('code');
          }}
          error={fieldErrors.code}
          required
        />

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Verifying...' : 'Verify email'}
        </Button>
      </form>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="text-sm text-accent hover:underline disabled:opacity-60"
        >
          {resending ? 'Sending...' : 'Resend code'}
        </button>
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        Already verified?{' '}
        <Link to="/login" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
