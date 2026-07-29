import { useState } from 'react';
import { Link } from 'react-router-dom';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { AuthLayout } from './SignUpPage';
import * as authService from '../../services/authService';
import { isValidEmail } from '../../utils/validators';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState('request');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequest = async (e) => {
    e.preventDefault();
    if (!isValidEmail(email)) return setError('Please enter a valid email');
    setLoading(true);
    setError('');
    try {
      const result = await authService.requestPasswordReset(email);
      setMessage(result.message);
      setStep('verify');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await authService.verifyResetToken(token || 'mock-token');
      setStep('reset');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) return setError('Passwords do not match');
    if (password.length < 8) return setError('Password must be at least 8 characters');
    setLoading(true);
    setError('');
    try {
      await authService.resetPassword(token || 'mock-token', password);
      setStep('done');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={
        step === 'request' ? 'Reset your password' :
        step === 'verify' ? 'Verify reset request' :
        step === 'reset' ? 'Set new password' : 'Password updated'
      }
      subtitle={
        step === 'request' ? "We'll send you a reset link" :
        step === 'verify' ? 'Enter the code from your email' :
        step === 'reset' ? 'Choose a strong new password' : 'You can now sign in'
      }
    >
      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {message && step === 'verify' && <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-600">{message}</div>}

      {step === 'request' && (
        <form onSubmit={handleRequest} className="space-y-4">
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Sending...' : 'Send Reset Link'}
          </Button>
        </form>
      )}

      {step === 'verify' && (
        <form onSubmit={handleVerify} className="space-y-4">
          <Input label="Reset Code" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Enter code from email" />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify Code'}
          </Button>
        </form>
      )}

      {step === 'reset' && (
        <form onSubmit={handleReset} className="space-y-4">
          <Input label="New Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Input label="Confirm Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Updating...' : 'Update Password'}
          </Button>
        </form>
      )}

      {step === 'done' && (
        <div className="text-center">
          <p className="text-sm text-muted mb-4">Your password has been successfully updated.</p>
          <Link to="/login"><Button className="w-full">Go to Login</Button></Link>
        </div>
      )}

      {step !== 'done' && (
        <p className="mt-6 text-center text-sm text-muted">
          <Link to="/login" className="text-accent hover:underline">Back to login</Link>
        </p>
      )}
    </AuthLayout>
  );
}
