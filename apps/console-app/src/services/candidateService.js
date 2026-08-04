import * as applicationService from './applicationService';
import { getActivePipelineStages, resolveJobStages } from '../utils/stages';
import * as jobService from './jobService';

export async function getCandidates(filters = {}) {
    if (!filters.jobId) {
        return [];
    }

    const items = await applicationService.getJobApplications(filters.jobId, {
        stageId: filters.stageId,
        search: filters.search,
        sortBy: filters.sortBy,
    });

    return items.map(mapApplicationToCandidate);
}

export async function getCandidateById(id) {
    const application = await applicationService.getApplicationById(id);
    return mapApplicationToCandidate(application);
}

export async function updateCandidateStage(id, stageId) {
    await applicationService.updateApplicationStage(id, stageId);
    return getCandidateById(id);
}

export async function updateCandidateRating(id, rating) {
    await applicationService.updateApplicationRating(id, rating);
    return getCandidateById(id);
}

export async function addCandidateNote(id, note) {
    await applicationService.addApplicationNote(id, note.text);
    return getCandidateById(id);
}

export async function deleteCandidate(id) {
    await applicationService.deleteApplication(id);
    return { success: true };
}

export async function getStages(jobId) {
    if (jobId) {
        const job = await jobService.getJobById(jobId);
        const stages = job?.settings?.customStages || job?.pipelineStages;
        return getActivePipelineStages(resolveJobStages(stages));
    }
    return [];
}

export async function updateStages(stages) {
    return stages;
}

export async function getStageById(id, jobId) {
    const stages = await getStages(jobId);
    return stages.find((s) => s.id === id) || null;
}

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

function normalizeAnswer(answer) {
    if (!answer) return answer;

    const videoUrl = answer.type === 'video' ? resolveVideoUrl(answer) : null;

    return {
        ...answer,
        videoUrl,
        mediaUrl: answer.mediaUrl || videoUrl,
        transcript: answer.transcript || null,
    };
}

function normalizeFieldValue(fieldValue) {
    if (!fieldValue) return null;

    const type = String(fieldValue.type || '').toUpperCase();
    let value = fieldValue.value;

    if (type === 'FILE' && typeof value === 'string' && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            if (parsed?.url) value = parsed;
        } catch {
            // keep raw string
        }
    }

    return {
        applicationFieldId: fieldValue.applicationFieldId,
        label: fieldValue.label || 'Field',
        type: fieldValue.type || 'TEXT',
        required: Boolean(fieldValue.required),
        value: value ?? null,
    };
}

function mapApplicationToCandidate(application) {
    if (!application) return null;

    const answers = (application.answers || []).map(normalizeAnswer);
    const videoAnswer = answers.find((a) => a.type === 'video' && a.videoUrl);
    const fieldValues = (application.fieldValues || [])
        .map(normalizeFieldValue)
        .filter(Boolean);

    return {
        id: application.id,
        jobId: application.jobId,
        firstName: application.firstName || '',
        lastName: application.lastName || '',
        email: application.email || '',
        phone: application.phone || '',
        stageId: application.stageId,
        rating: application.rating,
        submittedAt: application.submittedAt,
        startedAt: application.startedAt,
        videoThumbnail: application.videoThumbnail || null,
        videoUrl: application.videoUrl || videoAnswer?.videoUrl || null,
        notes: (application.notes || []).map((note) => ({
            id: note.id,
            text: note.text,
            author: note.author || 'Team member',
            authorId: note.authorId || null,
            createdAt: note.createdAt,
        })),
        fieldValues,
        answers,
    };
}
