export default function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-3 border-accent border-t-transparent" />
      <span className="ml-3 text-sm text-muted">{message}</span>
    </div>
  );
}
