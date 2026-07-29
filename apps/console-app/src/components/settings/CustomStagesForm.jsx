import { useState } from 'react';
import { GripVertical, Edit, Trash2, Plus } from 'lucide-react';
import Button from '../common/Button';
import Input from '../common/Input';
import Modal from '../common/Modal';
import Card from '../common/Card';

export default function CustomStagesForm({ stages, onChange }) {
  const [editStage, setEditStage] = useState(null);
  const [editName, setEditName] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');

  const handleDeactivate = (id) => {
    onChange(stages.map((s) => (s.id === id ? { ...s, active: false } : s)));
  };

  const handleSaveEdit = () => {
    onChange(stages.map((s) => (s.id === editStage ? { ...s, name: editName } : s)));
    setEditStage(null);
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    onChange([
      ...stages,
      {
        id: `stage-${Date.now()}`,
        name: newName,
        slug: newName.toLowerCase().replace(/\s+/g, '-'),
        order: stages.length + 1,
        active: true,
        isDefault: false,
      },
    ]);
    setNewName('');
    setShowAdd(false);
  };

  const activeStages = stages.filter((s) => s.active);

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Custom Stages</h3>
        <Button size="sm" variant="secondary" onClick={() => setShowAdd(true)}>
          <Plus size={16} /> Add Stage
        </Button>
      </div>

      <div className="space-y-2">
        {activeStages.map((stage) => (
          <div key={stage.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
            <GripVertical size={16} className="text-muted cursor-grab" />
            <span className="flex-1 text-sm font-medium">{stage.name}</span>
            {stage.isDefault && (
              <span className="text-xs text-muted bg-gray-100 px-2 py-0.5 rounded">Default</span>
            )}
            <button
              onClick={() => { setEditStage(stage.id); setEditName(stage.name); }}
              className="p-1 text-muted hover:text-heading"
            >
              <Edit size={16} />
            </button>
            {!stage.isDefault && (
              <button onClick={() => handleDeactivate(stage.id)} className="p-1 text-muted hover:text-red-500">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      <Modal isOpen={!!editStage} onClose={() => setEditStage(null)} title="Edit Stage">
        <Input label="Stage Name" value={editName} onChange={(e) => setEditName(e.target.value)} />
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setEditStage(null)}>Cancel</Button>
          <Button onClick={handleSaveEdit}>Save</Button>
        </div>
      </Modal>

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add New Stage">
        <Input label="Stage Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
          <Button onClick={handleAdd}>Add Stage</Button>
        </div>
      </Modal>
    </Card>
  );
}
