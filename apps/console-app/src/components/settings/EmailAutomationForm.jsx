import Toggle from '../common/Toggle';
import Card from '../common/Card';

export default function EmailAutomationForm({ settings, onChange }) {
  const email = settings.emailAutomation || {};

  const update = (field, value) => {
    onChange({ ...settings, emailAutomation: { ...email, [field]: value } });
  };

  const updateStageEmail = (field, value) => {
    onChange({
      ...settings,
      emailAutomation: {
        ...email,
        stageBasedEmails: { ...email.stageBasedEmails, [field]: value },
      },
    });
  };

  const stageEmails = email.stageBasedEmails || {};

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="text-lg font-semibold mb-2">Applicant Emails</h3>
        <p className="text-sm text-muted mb-4">Automated emails sent to candidates during the application process.</p>
        <div className="space-y-4">
          <Toggle
            label="Invite applicants"
            description="Send email invitations to apply for this job"
            checked={email.inviteApplicants ?? false}
            onChange={(v) => update('inviteApplicants', v)}
          />
          <Toggle
            label="Verify applicant email"
            description="Require email verification before starting the application"
            checked={email.verifyApplicantEmail ?? true}
            onChange={(v) => update('verifyApplicantEmail', v)}
          />
          <Toggle
            label="Automatic reminders for incomplete applications"
            description="Send reminder emails to candidates who started but did not finish"
            checked={email.incompleteReminders ?? true}
            onChange={(v) => update('incompleteReminders', v)}
          />
          <Toggle
            label="Confirmation email after submission"
            description="Send a confirmation email when a candidate submits their application"
            checked={email.confirmationAfterSubmission ?? true}
            onChange={(v) => update('confirmationAfterSubmission', v)}
          />
          <Toggle
            label="Follow-up question emails"
            description="Send emails when additional questions are requested from a candidate"
            checked={email.followUpQuestionEmails ?? false}
            onChange={(v) => update('followUpQuestionEmails', v)}
          />
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold mb-2">Stage-based Emails</h3>
        <p className="text-sm text-muted mb-4">Automatically notify candidates when their application stage changes.</p>
        <div className="space-y-4">
          <Toggle
            label="Shortlisted"
            description="Send email when candidate is moved to Shortlisted"
            checked={stageEmails.shortlisted ?? false}
            onChange={(v) => updateStageEmail('shortlisted', v)}
          />
          <Toggle
            label="Rejected"
            description="Send email when candidate is moved to Rejected"
            checked={stageEmails.rejected ?? false}
            onChange={(v) => updateStageEmail('rejected', v)}
          />
          <Toggle
            label="Disqualified"
            description="Send email when candidate is moved to Disqualified"
            checked={stageEmails.disqualified ?? false}
            onChange={(v) => updateStageEmail('disqualified', v)}
          />
        </div>
      </Card>
    </div>
  );
}
