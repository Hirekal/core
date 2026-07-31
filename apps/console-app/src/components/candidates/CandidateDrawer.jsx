import { useState, useEffect } from 'react';
import {
    X, Star, Trash2, Play, Mail, Phone, Clock, Video, Plus, StickyNote,
} from 'lucide-react';
import Button from '../common/Button';
import Badge from '../common/Badge';
import { SelectDropdown } from '../common/Dropdown';
import Tabs from '../common/Tabs';
import Card from '../common/Card';
import { formatDate, formatDateTime } from '../../utils/formatDate';
import { lockBodyScroll, unlockBodyScroll } from '../../utils/bodyScrollLock';
import LoadingSpinner from '../common/LoadingSpinner';
import * as candidateService from '../../services/candidateService';

/**
 * Resolves a video URL from a source object.
 * @param source - The source object.
 * @returns The video URL.
 */
function resolveVideoUrl(source) {
    if (!source) return null;
    return (
        source.videoUrl
        || source.mediaUrl
        || (typeof source.answer === 'string' && source.answer.startsWith('http')
            ? source.answer
            : null)
    );
}

/**
 * Gets a summary of an answer.
 * @param answer - The answer to get the summary of.
 * @returns The summary of the answer.
 */
function getAnswerSummary(answer) {
    if (!answer) return '';
    if (answer.type === 'video') {
        return resolveVideoUrl(answer) ? 'Video response recorded' : 'No video recorded';
    }
    return answer.answer?.trim() || 'No answer provided';
}

/**
 * Checks if a candidate has recorded responses.
 * @param answers - The answers to check.
 * @returns True if the candidate has recorded responses, false otherwise.
 */
function hasRecordedResponses(answers = []) {
    return answers.some((answer) => {
        if (answer.type === 'video') return Boolean(resolveVideoUrl(answer));
        return Boolean(answer.answer?.trim());
    });
}

/**
 * Displays a video preview.
 * @param thumbnail - The thumbnail of the video.
 * @param videoUrl - The URL of the video.
 * @param label - The label of the video.
 * @param className - The class name of the video preview.
 * @returns The video preview.
 */
function VideoPreview({ thumbnail, videoUrl, label = 'Play video response', className = '' }) {
    const [playing, setPlaying] = useState(false);

    if (!videoUrl) {
        return (
            <div className={`flex aspect-video items-center justify-center rounded-xl border border-dashed border-border bg-hover ${className}`}>
                <p className="text-sm text-muted">No video recorded</p>
            </div>
        );
    }

    if (playing || !thumbnail) {
        return (
            <div className={`overflow-hidden rounded-xl border border-border bg-black ${className}`}>
                <video
                    key={videoUrl}
                    src={videoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    poster={thumbnail || undefined}
                    autoPlay={playing}
                    className="aspect-video w-full bg-black"
                >
                    <track kind="captions" />
                </video>
            </div>
        );
    }

    return (
        <div className={`relative overflow-hidden rounded-xl border border-border bg-gray-900 ${className}`}>
            <img
                src={thumbnail}
                alt=""
                className="aspect-video w-full object-cover opacity-90"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/35">
                <button
                    type="button"
                    onClick={() => setPlaying(true)}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-accent shadow-lg transition-transform hover:scale-105"
                >
                    <Play size={28} fill="currentColor" className="ml-1" />
                </button>
                <span className="mt-3 text-sm font-medium text-white">{label}</span>
            </div>
        </div>
    );
}

/**
 * Displays a candidate drawer.
 * @param candidate - The candidate to display.
 * @param stages - The stages to display.
 * @param onClose - The function to call when the drawer is closed.
 * @param onStageChange - The function to call when the stage is changed.
 * @param onRatingChange - The function to call when the rating is changed.
 * @param onAddNote - The function to call when a note is added.
 * @param onDelete - The function to call when the candidate is deleted.
 * @returns The candidate drawer.
 */
export default function CandidateDrawer({
    candidate: selectedCandidate,
    stages,
    onClose,
    onStageChange,
    onRatingChange,
    onAddNote,
    onDelete,
}) {
    const [noteText, setNoteText] = useState('');
    const [activeTab, setActiveTab] = useState('info');
    const [candidate, setCandidate] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!selectedCandidate?.id) {
            setCandidate(null);
            return undefined;
        }

        let cancelled = false;
        setLoading(true);

        candidateService
            .getCandidateById(selectedCandidate.id)
            .then((detail) => {
                if (!cancelled) setCandidate(detail);
            })
            .catch(() => {
                if (!cancelled) setCandidate(selectedCandidate);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [selectedCandidate?.id]);

    useEffect(() => {
        if (!selectedCandidate?.id) return;
        if (Array.isArray(selectedCandidate.answers) && selectedCandidate.answers.length > 0) {
            setCandidate(selectedCandidate);
        }
    }, [selectedCandidate]);

    useEffect(() => {
        if (!selectedCandidate) return undefined;
        lockBodyScroll();
        return () => unlockBodyScroll();
    }, [selectedCandidate]);

    if (!selectedCandidate) return null;

    const currentStage = stages.find((s) => s.id === (candidate || selectedCandidate).stageId);
    const defaultStages = stages.filter((s) => s.isDefault);
    const displayCandidate = candidate || selectedCandidate;
    const answers = displayCandidate.answers || [];

    const handleAddNote = () => {
        if (!noteText.trim()) return;
        onAddNote?.(noteText);
        setNoteText('');
    };

    const mainVideoAnswer = answers.find((a) => a.type === 'video');
    const mainVideoThumbnail = displayCandidate.videoThumbnail || mainVideoAnswer?.videoThumbnail;
    const mainVideoUrl = displayCandidate.videoUrl || resolveVideoUrl(mainVideoAnswer);

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />

            <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-card shadow-2xl lg:max-w-3xl">
                <div className="shrink-0 border-b border-border px-6 py-5 sm:px-8">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                                <h2 className="truncate text-xl font-semibold text-heading">
                                    {displayCandidate.firstName} {displayCandidate.lastName}
                                </h2>
                                {currentStage && <Badge status="default">{currentStage.name}</Badge>}
                            </div>
                            <p className="truncate text-sm text-muted">{displayCandidate.email}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-hover hover:text-heading"
                            aria-label="Close"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
                    {loading ? (
                        <div className="mb-6 flex min-h-[12rem] items-center justify-center">
                            <LoadingSpinner message="Loading application..." />
                        </div>
                    ) : null}

                    {!loading && mainVideoUrl && (
                        <VideoPreview
                            thumbnail={mainVideoThumbnail}
                            videoUrl={mainVideoUrl}
                            className="mb-6"
                        />
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
                            <Card className="!p-5">
                                <h3 className="mb-4 text-sm font-semibold text-heading">Contact Information</h3>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <ContactItem icon={Mail} label="Email" value={displayCandidate.email} />
                                    <ContactItem icon={Phone} label="Phone" value={displayCandidate.phone} />
                                    <ContactItem
                                        icon={Clock}
                                        label="Submitted"
                                        value={displayCandidate.submittedAt ? formatDateTime(displayCandidate.submittedAt) : 'In progress'}
                                        className="sm:col-span-2"
                                    />
                                </div>
                            </Card>

                            <div className="grid gap-6 lg:grid-cols-2">
                                <Card className="!p-5">
                                    <h3 className="mb-3 text-sm font-semibold text-heading">Rating</h3>
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
                                                        n <= (displayCandidate.rating || 0)
                                                            ? 'fill-yellow-400 text-yellow-400'
                                                            : 'text-gray-300 hover:text-yellow-200'
                                                    }
                                                />
                                            </button>
                                        ))}
                                    </div>
                                    {displayCandidate.rating ? (
                                        <p className="mt-2 text-xs text-muted">{displayCandidate.rating} out of 5 stars</p>
                                    ) : (
                                        <p className="mt-2 text-xs text-muted">No rating yet</p>
                                    )}
                                </Card>

                                <Card className="!p-5">
                                    <h3 className="mb-3 text-sm font-semibold text-heading">Current Stage</h3>
                                    <SelectDropdown
                                        value={displayCandidate.stageId}
                                        onChange={onStageChange}
                                        placeholder="Select stage"
                                        options={defaultStages.map((s) => ({ value: s.id, label: s.name }))}
                                    />
                                </Card>
                            </div>

                            <Card className="overflow-hidden !p-0">
                                <div className="border-b border-border bg-hover/30 px-5 py-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="rounded-xl bg-accent/10 p-2.5 text-accent">
                                                <StickyNote size={18} strokeWidth={2} />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-semibold text-heading">Notes</h3>
                                                <p className="text-xs text-muted">Private team notes for this candidate</p>
                                            </div>
                                        </div>
                                        {(displayCandidate.notes || []).length > 0 && (
                                            <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-accent">
                                                {(displayCandidate.notes || []).length}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="p-5">
                                    {(displayCandidate.notes || []).length === 0 ? (
                                        <div className="mb-5 rounded-xl border border-dashed border-border/80 bg-hover/30 px-6 py-10 text-center">
                                            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-hover text-muted/70">
                                                <StickyNote size={22} strokeWidth={1.75} />
                                            </div>
                                            <p className="text-sm font-medium text-heading">No notes added yet</p>
                                            <p className="mt-1 text-xs text-muted">Capture feedback, impressions, or follow-ups below</p>
                                        </div>
                                    ) : (
                                        <div className="mb-5 max-h-56 space-y-3 overflow-y-auto pr-1">
                                            {(displayCandidate.notes || []).map((note) => (
                                                <article
                                                    key={note.id}
                                                    className="rounded-xl border border-border/70 bg-card px-4 py-3.5 shadow-sm ring-1 ring-border/40"
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
                                                            {note.author?.[0]?.toUpperCase() || 'T'}
                                                        </span>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                                                <span className="text-sm font-medium text-heading">{note.author || 'Team'}</span>
                                                                <span className="text-xs text-muted">· {formatDate(note.createdAt)}</span>
                                                            </div>
                                                            <p className="mt-1.5 text-sm leading-relaxed text-heading">{note.text}</p>
                                                        </div>
                                                    </div>
                                                </article>
                                            ))}
                                        </div>
                                    )}

                                    <div className="rounded-xl border border-border/70 bg-hover/20 p-4 transition-colors focus-within:border-accent/30 focus-within:ring-2 focus-within:ring-accent/10">
                                        <label htmlFor="candidate-note" className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted">
                                            Add a note
                                        </label>
                                        <textarea
                                            id="candidate-note"
                                            value={noteText}
                                            onChange={(e) => setNoteText(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddNote();
                                            }}
                                            placeholder="Write a note about this candidate..."
                                            rows={3}
                                            className="w-full resize-none rounded-lg border border-border/70 bg-input px-4 py-3 text-sm text-heading placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                                        />
                                        <div className="mt-3 flex items-center justify-between gap-3">
                                            <p className="text-xs text-muted">
                                                {noteText.trim() ? `${noteText.trim().length} characters` : 'Press ⌘/Ctrl + Enter to save'}
                                            </p>
                                            <Button
                                                size="sm"
                                                onClick={handleAddNote}
                                                disabled={!noteText.trim()}
                                                className="rounded-lg px-4 shadow-sm"
                                            >
                                                <Plus size={15} strokeWidth={2.5} /> Add note
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            <Card className="!p-5">
                                <div className="mb-4 flex items-center gap-2">
                                    <Video size={18} className="text-accent" />
                                    <h3 className="text-sm font-semibold text-heading">Question Responses</h3>
                                </div>

                                {loading ? (
                                    <p className="text-sm text-muted">Loading responses...</p>
                                ) : !hasRecordedResponses(answers) ? (
                                    <p className="text-sm text-muted">No responses recorded yet.</p>
                                ) : (
                                    <div className="space-y-5">
                                        {answers.map((answer) => {
                                            const videoUrl = resolveVideoUrl(answer);
                                            const answerKey = answer.questionId || answer.question;

                                            return (
                                                <div key={answerKey} className="overflow-hidden rounded-xl border border-border">
                                                    <div className="border-b border-border bg-hover/40 px-4 py-3">
                                                        <p className="text-sm font-medium text-heading">{answer.question}</p>
                                                        <span className="mt-1 inline-flex items-center gap-1 text-xs capitalize text-muted">
                                                            {answer.type === 'video' && <Video size={12} />}
                                                            {answer.type}
                                                            {answer.timestamp ? ` · ${formatDateTime(answer.timestamp)}` : ''}
                                                        </span>
                                                    </div>
                                                    <div className="p-4">
                                                        {answer.type === 'video' ? (
                                                            <VideoPreview
                                                                thumbnail={answer.videoThumbnail || mainVideoThumbnail}
                                                                videoUrl={videoUrl || mainVideoUrl}
                                                                label="Play video response"
                                                            />
                                                        ) : (
                                                            <p className="text-sm leading-relaxed text-muted">
                                                                {answer.answer?.trim() || 'No answer provided'}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </Card>
                        </div>
                    )}

                    {activeTab === 'timeline' && (
                        <Card className="!p-5">
                            <h3 className="mb-6 text-sm font-semibold text-heading">Activity Timeline</h3>
                            <div className="relative space-y-0">
                                {answers.map((a) => (
                                    <TimelineItem
                                        key={a.questionId || a.question}
                                        title={a.question}
                                        time={a.timestamp ? formatDateTime(a.timestamp) : '—'}
                                        description={getAnswerSummary(a)}
                                        isLast={!displayCandidate.submittedAt && a === answers[answers.length - 1]}
                                    />
                                ))}
                                {displayCandidate.submittedAt && (
                                    <TimelineItem
                                        title="Application submitted"
                                        time={formatDateTime(displayCandidate.submittedAt)}
                                        description="Candidate completed all required questions."
                                        dotColor="bg-green-500"
                                        isLast
                                    />
                                )}
                                {!loading && answers.length === 0 && !displayCandidate.submittedAt && (
                                    <p className="py-4 text-sm text-muted">No activity recorded yet.</p>
                                )}
                            </div>
                        </Card>
                    )}
                </div>

                <div className="shrink-0 border-t border-border px-6 py-4 sm:px-8">
                    <Button variant="danger" className="w-full sm:w-auto" onClick={() => onDelete?.(displayCandidate.id)}>
                        <Trash2 size={16} /> Delete Application
                    </Button>
                </div>
            </div>
        </>
    );
}

/**
 * Displays a contact item.
 * @param icon - The icon to display.
 * @param label - The label of the contact item.
 * @param value - The value of the contact item.
 * @param className - The class name of the contact item.
 * @returns The contact item.
 */
function ContactItem({ icon: Icon, label, value, className = '' }) {
    return (
        <div className={`flex items-start gap-3 ${className}`}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Icon size={16} />
            </div>
            <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
                <p className="mt-0.5 break-all text-sm font-medium text-heading">{value || '—'}</p>
            </div>
        </div>
    );
}

/**
 * Displays a timeline item.
 * @param title - The title of the timeline item.
 * @param time - The time of the timeline item.
 * @param description - The description of the timeline item.
 * @param dotColor - The color of the dot.
 * @param isLast - Whether the timeline item is the last one.
 * @returns The timeline item.
 */
function TimelineItem({ title, time, description, dotColor = 'bg-accent', isLast = false }) {
    return (
        <div className="flex gap-4 pb-6 last:pb-0">
            <div className="flex flex-col items-center">
                <div className={`h-3 w-3 shrink-0 rounded-full ${dotColor}`} />
                {!isLast && <div className="mt-1 min-h-[2rem] w-px flex-1 bg-border" />}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm font-medium text-heading">{title}</p>
                <p className="mt-0.5 text-xs text-muted">{time}</p>
                {description && (
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{description}</p>
                )}
            </div>
        </div>
    );
}
