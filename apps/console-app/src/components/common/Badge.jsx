const statusStyles = {
  active: 'bg-green-50 text-green-700 border-green-200',
  paused: 'bg-gray-100 text-gray-600 border-gray-200',
  archived: 'bg-gray-50 text-gray-400 border-gray-200',
  success: 'bg-green-50 text-green-700 border-green-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900/40',
  failed: 'bg-red-50 text-red-700 border-red-200',
  default: 'bg-accent/10 text-accent border-accent/20',
};

export default function Badge({ children, status = 'default', className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyles[status] || statusStyles.default} ${className}`}
    >
      {children}
    </span>
  );
}
