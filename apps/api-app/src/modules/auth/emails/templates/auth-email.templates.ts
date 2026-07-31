/**
 * @fileoverview HTML/text templates for auth-related transactional emails.
 */

/**
 * Builds verification email content for a one-time code.
 *
 * @param name - Recipient display name
 * @param code - One-time verification code
 * @returns HTML and plain-text bodies
 */
export function buildVerificationEmailContent(
    name: string,
    code: string,
): { htmlContent: string; textContent: string } {
    const textContent = `Hi ${name},\n\nYour Hirekal email verification code is: ${code}\n\nThis code expires soon. If you did not sign up, you can ignore this email.`;
    const htmlContent = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>Your Hirekal email verification code is:</p>
    <p style="font-size:24px;font-weight:700;letter-spacing:4px;">${escapeHtml(code)}</p>
    <p>This code expires soon. If you did not sign up, you can ignore this email.</p>
  `.trim();

    return { htmlContent, textContent };
}

/**
 * Builds password-reset email content for a one-time code.
 *
 * @param name - Recipient display name
 * @param code - One-time password reset code
 * @returns HTML and plain-text bodies
 */
export function buildPasswordResetEmailContent(
    name: string,
    code: string,
): { htmlContent: string; textContent: string } {
    const textContent = `Hi ${name},\n\nYour Hirekal password reset code is: ${code}\n\nThis code expires soon. If you did not request a reset, you can ignore this email.`;
    const htmlContent = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>Your Hirekal password reset code is:</p>
    <p style="font-size:24px;font-weight:700;letter-spacing:4px;">${escapeHtml(code)}</p>
    <p>This code expires soon. If you did not request a reset, you can ignore this email.</p>
  `.trim();

    return { htmlContent, textContent };
}

/**
 * Escapes HTML special characters in user-controlled strings.
 *
 * @param value - Raw string that may contain HTML-sensitive characters
 * @returns Escaped string safe for HTML interpolation
 */
function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
