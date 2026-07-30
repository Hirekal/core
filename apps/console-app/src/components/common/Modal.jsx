import { X } from 'lucide-react';
import { useEffect } from 'react';
import Button from './Button';
import { lockBodyScroll, unlockBodyScroll } from '../../utils/bodyScrollLock';

export default function Modal({ isOpen, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative w-full ${sizeClasses[size]} rounded-xl bg-white shadow-xl`}>
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-heading">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted hover:bg-gray-100 hover:text-heading"
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ModalFooter({ onCancel, onConfirm, confirmLabel = 'Confirm', cancelLabel = 'Cancel', loading = false }) {
  return (
    <>
      <Button variant="secondary" onClick={onCancel}> {cancelLabel} </Button>
      <Button onClick={onConfirm} disabled={loading}>{loading ? 'Saving...' : confirmLabel}</Button>
    </>
  );
}
