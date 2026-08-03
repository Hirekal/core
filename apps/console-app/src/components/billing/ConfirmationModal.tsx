/**
 * @fileoverview Confirmation modal for destructive billing actions.
 */
import Modal, { ModalFooter } from '../common/Modal';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Reusable confirm dialog for cancel subscription and similar actions.
 */
export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  loading = false,
  onConfirm,
  onClose,
}: ConfirmationModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-muted">{message}</p>
      <ModalFooter
        onCancel={onClose}
        onConfirm={onConfirm}
        confirmLabel={confirmLabel}
        loading={loading}
      />
    </Modal>
  );
}
