import { useState, useEffect } from 'react';
import {
  X, Star, Trash2, Paperclip, Send, Play, Mail, Phone, Clock, MessageSquare, Video,
} from 'lucide-react';
import Button from '../common/Button';
import Badge from '../common/Badge';
import { SelectDropdown } from '../common/Dropdown';
import Tabs from '../common/Tabs';
import Card from '../common/Card';
import { formatDate, formatDateTime } from '../../utils/formatDate';
import { lockBodyScroll, unlockBodyScroll } from '../../utils/bodyScrollLock';

export default function CandidateDrawer({
  candidate,
  stages,
  onClose,
  onStageChange,
  onRatingChange,
  onAddNote,
  onDelete,
}) {
  const [noteText, setNoteText] = useState('');
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    if (!candidate) return undefined;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [candidate]);

  if (!candidate) return null;

  const currentStage = stages.find((s) => s.id === candidate.stageId);
  const defaultStages = stages.filter((s) => s.isDefault);

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    onAddNote?.(noteText);
    setNoteText('');
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-white shadow-2xl lg:max-w-3xl">
        {/* Header */}
        <div className="shrink-0 border-b border-border bg-white px-6 py-5 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-xl font-semibold text-heading truncate">
                  {candidate.firstName} {candidate.lastName}
                </h2>
                {currentStage && <Badge status="default">{currentStage.name}</Badge>}
              </div>
              <p className="text-sm text-muted truncate">{candidate.email}</p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 rounded-lg p-2 text-muted hover:bg-gray-100 hover:text-heading transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
          {/* Video preview */}
          {candidate.videoThumbnail && (
            <div className="relative mb-6 overflow-hidden rounded-xl border border-border bg-gray-900">
              <img
                src={candidate.videoThumbnail}
                alt={`${candidate.firstName} ${candidate.lastName} video`}
                className="w-full h-52 sm:h-64 object-cover opacity-90"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/35">
                <button
                  type="button"
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-accent shadow-lg transition-transform hover:scale-105"
                >
                  <Play size={28} fill="currentColor" className="ml-1" />
                </button>
                <span className="mt-3 text-sm font-medium text-white">Play video response</span>
              </div>
            </div>
          )}

          <Tabs
            tabs={[
              { id: 'info', label: 'Overview' },
              { id: 'timeline', label: 'Timeline' },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
            className="mb-6"
          />

          {activeTab === 'info' && (
            <div className="space-y-6">
              {/* Contact info */}
              <Card className="!p-5">
                <h3 className="text-sm font-semibold text-heading mb-4">Contact Information</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ContactItem icon={Mail} label="Email" value={candidate.email} />
                  <ContactItem icon={Phone} label="Phone" value={candidate.phone} />
                  <ContactItem
                    icon={Clock}
                    label="Submitted"
                    value={candidate.submittedAt ? formatDateTime(candidate.submittedAt) : 'In progress'}
                    className="sm:col-span-2"
                  />
                </div>
              </Card>

              {/* Rating & Stage row */}
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="!p-5">
                  <h3 className="text-sm font-semibold text-heading mb-3">Rating</h3>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => onRatingChange?.(n)}
                        className="rounded p-0.5 transition-transform hover:scale-110"
                      >
                        <Star
                          size={28}
                          className={
                            n <= (candidate.rating || 0)
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-gray-300 hover:text-yellow-200'
                          }
                        />
                      </button>
                    ))}
                  </div>
                  {candidate.rating ? (
                    <p className="mt-2 text-xs text-muted">{candidate.rating} out of 5 stars</p>
                  ) : (
                    <p className="mt-2 text-xs text-muted">No rating yet</p>
                  )}
                </Card>

                <Card className="!p-5">
                  <h3 className="text-sm font-semibold text-heading mb-3">Current Stage</h3>
                  <SelectDropdown
                    value={candidate.stageId}
                    onChange={onStageChange}
                    options={defaultStages.map((s) => ({ value: s.id, label: s.name }))}
                  />
                </Card>
              </div>

              {/* Stage quick actions */}
              <Card className="!p-5">
                <h3 className="text-sm font-semibold text-heading mb-3">Move to Stage</h3>
                <div className="flex flex-wrap gap-2">
                  {defaultStages.map((stage) => (
                    <button
                      key={stage.id}
                      type="button"
                      onClick={() => onStageChange?.(stage.id)}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                        candidate.stageId === stage.id
                          ? 'bg-accent text-white shadow-sm'
                          : 'border border-border bg-white text-heading hover:border-accent/30 hover:bg-accent/5'
                      }`}
                    >
                      {stage.name}
                    </button>
                  ))}
                </div>
              </Card>

              {/* Notes */}
              <Card className="!p-5">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare size={18} className="text-accent" />
                  <h3 className="text-sm font-semibold text-heading">Notes</h3>
                </div>

                {(candidate.notes || []).length === 0 ? (
                  <p className="text-sm text-muted mb-4">No notes added yet.</p>
                ) : (
                  <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                    {(candidate.notes || []).map((note) => (
                      <div key={note.id} className="rounded-lg border border-border bg-surface px-4 py-3">
                        <p className="text-sm text-heading leading-relaxed">{note.text}</p>
                        <p className="mt-2 text-xs text-muted">{note.author} · {formatDate(note.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                    placeholder="Write a note about this candidate..."
                    className="flex-1 rounded-lg border border-border bg-white px-4 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                  <Button size="md" onClick={handleAddNote} disabled={!noteText.trim()}>
                    <Send size={16} />
                  </Button>
                  <Button size="md" variant="secondary" title="Attach file">
                    <Paperclip size={16} />
                  </Button>
                </div>
              </Card>

              {/* Question responses */}
              <Card className="!p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Video size={18} className="text-accent" />
                  <h3 className="text-sm font-semibold text-heading">Question Responses</h3>
                </div>

                {(candidate.answers || []).length === 0 ? (
                  <p className="text-sm text-muted">No responses recorded yet.</p>
                ) : (
                  <div className="space-y-4">
                    {candidate.answers.map((a, i) => (
                      <div key={i} className="rounded-lg border border-border overflow-hidden">
                        <div className="bg-surface px-4 py-3 border-b border-border">
                          <p className="text-sm font-medium text-heading">{a.question}</p>
                          <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted capitalize">
                            {a.type === 'video' ? <Video size={12} /> : null}
                            {a.type} · {formatDateTime(a.timestamp)}
                          </span>
                        </div>
                        <div className="px-4 py-3">
                          {a.type === 'video' ? (
                            <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-surface px-4 py-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                                <Play size={18} fill="currentColor" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-heading">Video response</p>
                                <p className="text-xs text-muted line-clamp-2 mt-0.5">{a.answer}</p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-muted leading-relaxed">{a.answer}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {activeTab === 'timeline' && (
            <Card className="!p-5">
              <h3 className="text-sm font-semibold text-heading mb-6">Activity Timeline</h3>
              <div className="relative space-y-0">
                {(candidate.answers || []).map((a, i) => (
                  <TimelineItem
                    key={i}
                    title={a.question}
                    time={formatDateTime(a.timestamp)}
                    description={a.answer}
                    isLast={!candidate.submittedAt && i === candidate.answers.length - 1}
                  />
                ))}
                {candidate.submittedAt && (
                  <TimelineItem
                    title="Application submitted"
                    time={formatDateTime(candidate.submittedAt)}
                    description="Candidate completed all required questions."
                    dotColor="bg-green-500"
                    isLast
                  />
                )}
                {(candidate.answers || []).length === 0 && !candidate.submittedAt && (
                  <p className="text-sm text-muted py-4">No activity recorded yet.</p>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border bg-white px-6 py-4 sm:px-8">
          <Button variant="danger" className="w-full sm:w-auto" onClick={() => onDelete?.(candidate.id)}>
            <Trash2 size={16} /> Delete Application
          </Button>
        </div>
      </div>
    </>
  );
}

function ContactItem({ icon: Icon, label, value, className = '' }) {
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-heading break-all">{value || '—'}</p>
      </div>
    </div>
  );
}

function TimelineItem({ title, time, description, dotColor = 'bg-accent', isLast = false }) {
  return (
    <div className="flex gap-4 pb-6 last:pb-0">
      <div className="flex flex-col items-center">
        <div className={`h-3 w-3 shrink-0 rounded-full ${dotColor}`} />
        {!isLast && <div className="mt-1 w-px flex-1 bg-border min-h-[2rem]" />}
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-sm font-medium text-heading">{title}</p>
        <p className="text-xs text-muted mt-0.5">{time}</p>
        {description && (
          <p className="mt-2 text-sm text-muted leading-relaxed line-clamp-3">{description}</p>
        )}
      </div>
    </div>
  );
}
