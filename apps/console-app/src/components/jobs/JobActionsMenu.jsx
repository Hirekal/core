import { useNavigate } from 'react-router-dom';
import {
  Edit, Copy, Settings, Link2, Trash2, MoreHorizontal, Archive, RotateCcw,
} from 'lucide-react';
import Dropdown from '../common/Dropdown';

export default function JobActionsMenu({
  job,
  onDuplicate,
  onCopyLink,
  onArchive,
  onRestore,
  onDelete,
  triggerClassName = '',
}) {
  const navigate = useNavigate();

  const menuItems = [
    { label: 'Edit Job', icon: <Edit size={16} />, onClick: () => navigate(`/jobs/${job.id}/edit`) },
    { label: 'Duplicate Job', icon: <Copy size={16} />, onClick: () => onDuplicate?.(job.id) },
    { label: 'Job Settings', icon: <Settings size={16} />, onClick: () => navigate(`/jobs/${job.id}/settings`) },
    { divider: true },
    { label: 'Copy Job Link', icon: <Link2 size={16} />, onClick: () => onCopyLink?.(job.shareLink) },
  ];

  if (job.status === 'active' || job.status === 'paused') {
    menuItems.push(
      { divider: true },
      {
        label: 'Archive Job',
        icon: <Archive size={16} />,
        onClick: () => onArchive?.(job),
      },
    );
  }

  if (job.status === 'archived') {
    menuItems.push(
      { divider: true },
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

  return (
    <Dropdown
      align="right"
      trigger={
        <button
          type="button"
          className={`rounded-lg p-1.5 text-muted hover:bg-gray-100 hover:text-heading ${triggerClassName}`}
          aria-label="Job actions"
        >
          <MoreHorizontal size={18} />
        </button>
      }
      items={menuItems}
    />
  );
}
