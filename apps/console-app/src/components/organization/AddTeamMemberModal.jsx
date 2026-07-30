import { useState } from 'react';
import { Copy, Check, AlertTriangle } from 'lucide-react';
import Modal, { ModalFooter } from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';

export default function AddTeamMemberModal({ isOpen, onClose, onAdd }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdMember, setCreatedMember] = useState(null);
  const [oneTimePassword, setOneTimePassword] = useState('');
  const [copied, setCopied] = useState(false);

  const resetForm = () => {
    setName('');
    setEmail('');
    setError('');
    setCreatedMember(null);
    setOneTimePassword('');
    setCopied(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await onAdd({ name, email });
      setCreatedMember(result.member);
      setOneTimePassword(result.oneTimePassword);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(oneTimePassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (createdMember) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="Team Member Added"
        size="md"
        footer={
          <Button onClick={handleClose}>Done</Button>
        }
      >
        <div className="space-y-5">
          <p className="text-sm text-muted">
            <span className="font-medium text-heading">{createdMember.name}</span> has been added to your organization.
            Share the one-time password below so they can sign in.
          </p>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                This password will only be shown once. Copy it now and share it securely with the team member.
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-heading">One-Time Password</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg border border-border bg-input px-3 py-2.5 font-mono text-sm text-heading">
                {oneTimePassword}
              </code>
              <Button variant="secondary" onClick={handleCopyPassword} className="shrink-0">
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-hover/30 px-4 py-3 text-sm">
            <p className="text-muted">Login email</p>
            <p className="font-medium text-heading">{createdMember.email}</p>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Team Member"
      size="md"
      footer={
        <ModalFooter
          onCancel={handleClose}
          onConfirm={() => handleSubmit()}
          confirmLabel="Add Member"
          loading={loading}
        />
      }
    >
      <form id="add-team-member-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </div>
        )}

        <Input
          label="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Doe"
          required
        />

        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jane.doe@acme.com"
          required
        />
      </form>
    </Modal>
  );
}
