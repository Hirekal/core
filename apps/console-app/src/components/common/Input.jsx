import { useState } from 'react';
import { Eye, EyeClosed } from 'lucide-react';

export default function Input({
  label,
  error,
  className = '',
  containerClassName = '',
  required = false,
  showPasswordToggle = false,
  type = 'text',
  ...props
}) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';
  const withToggle = showPasswordToggle && isPassword;
  const inputType = withToggle && visible ? 'text' : type;

  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label className="text-sm font-medium text-heading">
          {label}
          {required && <span className="text-accent ml-0.5">*</span>}
        </label>
      )}
      <div className={withToggle ? 'relative' : undefined}>
        <input
          type={inputType}
          className={`w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-heading placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''} ${withToggle ? 'pr-10' : ''} ${className}`}
          {...props}
        />
        {withToggle && (
          <button
            type="button"
            onClick={() => setVisible((prev) => !prev)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted transition-colors hover:bg-hover hover:text-heading"
            aria-label={visible ? 'Hide password' : 'Show password'}
            title={visible ? 'Hide password' : 'Show password'}
          >
            {visible ? <Eye size={18} /> : <EyeClosed size={18} />}
          </button>
        )}
      </div>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
