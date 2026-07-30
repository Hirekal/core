export default function Input({
  label,
  error,
  className = '',
  containerClassName = '',
  required = false,
  ...props
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label className="text-sm font-medium text-heading">
          {label}
          {required && <span className="text-accent ml-0.5">*</span>}
        </label>
      )}
      <input
        className={`w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-heading placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''} ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
