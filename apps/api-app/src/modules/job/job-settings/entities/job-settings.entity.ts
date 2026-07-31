import { BaseEntity } from '../../../../common/entities/base.entity';
import type { Job } from '../../entities/job.entity';
import { Column, Entity, JoinColumn, OneToOne, Relation } from 'typeorm';

export interface SocialPreviewImage {
    type: string;
    url: string;
    storageKey: string;
    fileName: string;
}

export interface GeneralSettings {
    applicationFormLabel: string;
    instructionsLabel: string;
    showQuestionsInAdvance: boolean;
    socialPreview: {
        siteTitle: string;
        metaDescription: string;
        previewImage: SocialPreviewImage;
    };
}

export interface ThankYouPageSettings {
    mediaType: string | null;
    mediaUrl: string;
    storageKey: string;
    fileName: string;
    description: string;
    autoRedirectUrl: string;
}

export interface EmailAutomationSettings {
    inviteApplicants: boolean;
    verifyApplicantEmail: boolean;
    incompleteReminders: boolean;
    confirmationAfterSubmission: boolean;
    followUpQuestionEmails: boolean;
    stageBasedEmails: {
        shortlisted: boolean;
        rejected: boolean;
        disqualified: boolean;
    };
}

export interface WebhookSettings {
    url: string;
    triggers: {
        newApplication: boolean;
        stageChange: boolean;
    };
    includeAnswers: boolean;
    includeVideoUrls: boolean;
    includeAiTranscripts: boolean;
}

@Entity('jobSettings')
export class JobSettings extends BaseEntity {
    @Column({ type: 'uuid', unique: true })
    jobId!: string;

    @Column({ type: 'jsonb', default: {} })
    general!: GeneralSettings;

    @Column({ type: 'jsonb', default: {} })
    thankYouPage!: ThankYouPageSettings;

    @Column({ type: 'jsonb', default: {} })
    emailAutomation!: EmailAutomationSettings;

    @Column({ type: 'jsonb', default: {} })
    webhook!: WebhookSettings;

    @OneToOne('Job', 'settings', { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'jobId' })
    job!: Relation<Job>;
}
