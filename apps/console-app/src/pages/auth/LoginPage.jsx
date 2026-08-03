import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { useAuth } from '../../context/AuthContext';
import { validateLoginFields } from '../../utils/validators';
import { toUserErrorMessage } from '../../utils/errorMessage';
import { AuthLayout } from './SignUpPage';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const successMessage = location.state?.message || '';

  const clearFieldError = (field) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const errors = validateLoginFields({ email, password });
    if (errors) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate('/jobs');
    } catch (err) {
      const message = toUserErrorMessage(err, 'Sign in failed');
      setError(message);
      if (/not verified/i.test(err?.message || '')) {
        setFieldErrors({});
      }
    } finally {
      setLoading(false);
    }
  };

  const showVerifyLink = /not verified/i.test(error);

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your Hirekal account">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {successMessage && (
          <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-400">
            {successMessage}
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
            {error}
            {showVerifyLink && (
              <div className="mt-2">
                <Link
                  to={`/verify-email?email=${encodeURIComponent(email.trim())}`}
                  className="font-medium underline"
                >
                  Verify your email
                </Link>
              </div>
            )}
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
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            clearFieldError('password');
          }}
          error={fieldErrors.password}
          required
        />
        <div className="text-right">
          <Link to="/forgot-password" className="text-sm text-accent hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Don&apos;t have an account?{' '}
        <Link to="/signup" className="text-accent hover:underline">
          Sign up
        </Link>
      </p>
    </AuthLayout>
  );
}
