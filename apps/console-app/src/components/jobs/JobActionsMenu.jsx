import { useNavigate } from 'react-router-dom';
import {
  Edit,
  Copy,
  Settings,
  Link2,
  Trash2,
  MoreHorizontal,
  Archive,
  RotateCcw,
  Pause,
  Play,
} from 'lucide-react';
import Dropdown from '../common/Dropdown';

export default function JobActionsMenu({
  job,
  onDuplicate,
  onCopyLink,
  onPause,
  onResume,
  onArchive,
  onRestore,
  onDelete,
  statusOnly = false,
  triggerVariant = 'icon',
  triggerClassName = '',
}) {
  const navigate = useNavigate();

  const menuItems = [];

  if (!statusOnly) {
    menuItems.push(
      { label: 'Edit Job', icon: <Edit size={16} />, onClick: () => navigate(`/jobs/${job.id}/edit`) },
      { label: 'Duplicate Job', icon: <Copy size={16} />, onClick: () => onDuplicate?.(job.id) },
      { label: 'Job Settings', icon: <Settings size={16} />, onClick: () => navigate(`/jobs/${job.id}/settings`) },
      { divider: true },
      { label: 'Copy Job Link', icon: <Link2 size={16} />, onClick: () => onCopyLink?.(job.shareLink) },
    );
  }

  if (job.status === 'active') {
    menuItems.push(
      ...(statusOnly ? [] : [{ divider: true }]),
      {
        label: 'Pause Job',
        icon: <Pause size={16} />,
        onClick: () => onPause?.(job),
      },
      {
        label: 'Archive Job',
        icon: <Archive size={16} />,
        onClick: () => onArchive?.(job),
      },
    );
  }

  if (job.status === 'paused') {
    menuItems.push(
      ...(statusOnly ? [] : [{ divider: true }]),
      {
        label: 'Resume Job',
        icon: <Play size={16} />,
        onClick: () => onResume?.(job),
      },
      {
        label: 'Archive Job',
        icon: <Archive size={16} />,
        onClick: () => onArchive?.(job),
      },
    );
  }

  if (job.status === 'archived') {
    menuItems.push(
      ...(statusOnly ? [] : [{ divider: true }]),
      {
        label: 'Restore Job',
        icon: <RotateCcw size={16} />,
        onClick: () => onRestore?.(job),
      },
      {
        label: 'Delete Archived Job',
        icon: <Trash2 size={16} />,
        danger: true,
        onClick: () => onDelete?.(job),
      },
    );
  }

  const triggerStyles = triggerVariant === 'header'
    ? 'inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-card text-muted shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/30 hover:bg-accent/5 hover:text-accent hover:shadow-md'
    : `rounded-lg p-1.5 text-muted transition-colors hover:bg-hover hover:text-heading ${triggerClassName}`;

  return (
    <Dropdown
      align="right"
      trigger={
        <button
          type="button"
          className={triggerStyles}
          aria-label="Job actions"
        >
          <MoreHorizontal size={18} />
        </button>
      }
      items={menuItems}
    />
  );
}
