import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { useAuth } from '../../context/AuthContext';
import { validateSignUpFields } from '../../utils/validators';
import { toUserErrorMessage } from '../../utils/errorMessage';

export default function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const clearFieldError = (field) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const errors = validateSignUpFields({ name, email, password });
    if (errors) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setLoading(true);
    try {
      const trimmedEmail = email.trim();
      await signUp(name.trim(), trimmedEmail, password);
      navigate(`/verify-email?email=${encodeURIComponent(trimmedEmail)}`);
    } catch (err) {
      setError(toUserErrorMessage(err, 'Sign up failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="Start screening candidates with Hirekal">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
        <Input
          label="Full Name"
          autoComplete="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            clearFieldError('name');
          }}
          error={fieldErrors.name}
          required
        />
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
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            clearFieldError('password');
          }}
          error={fieldErrors.password}
          required
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Creating account...' : 'Sign Up'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link to="/login" className="text-accent hover:underline">Log in</Link>
      </p>
    </AuthLayout>
  );
}

function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img
            src="/logo-light.png"
            alt="Hirekal"
            className="mx-auto mb-4 h-10 w-auto dark:hidden"
          />
          <img
            src="/logo-dark.png"
            alt="Hirekal"
            className="mx-auto mb-4 hidden h-10 w-auto dark:block"
          />
          <h1 className="text-2xl font-semibold tracking-tight text-heading">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">{children}</div>
      </div>
    </div>
  );
}

export { AuthLayout };
