/**
 * @fileoverview Confirmation modal for destructive billing actions.
 */
import Modal, { ModalFooter } from '../common/Modal';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'primary' | 'danger';
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
  confirmVariant = 'danger',
  loading = false,
  onConfirm,
  onClose,
}: ConfirmationModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={onConfirm}
          confirmLabel={confirmLabel}
          confirmVariant={confirmVariant}
          loading={loading}
        />
      }
    >
      <p className="text-sm leading-relaxed text-muted">{message}</p>
    </Modal>
  );
}
