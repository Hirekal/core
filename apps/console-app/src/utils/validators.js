export function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

export function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

export function validatePassword(password) {
    if (!password || password.length < 8) {
        return 'Password must be at least 8 characters';
    }
    return null;
}

export function validateRequired(value, label = 'This field') {
    if (!value || !String(value).trim()) {
        return `${label} is required`;
    }
    return null;
}

export function validateEmail(email) {
    if (!email || !String(email).trim()) return 'Email is required';
    if (!isValidEmail(email)) return 'Please enter a valid email address';
    return null;
}

function hasErrors(errors) {
    return Object.values(errors).some(Boolean);
}

export function validateLoginFields({ email, password }) {
    const errors = {};
    const emailError = validateEmail(email);
    if (emailError) errors.email = emailError;
    if (!password) errors.password = 'Password is required';
    return hasErrors(errors) ? errors : null;
}

export function validateSignUpFields({ name, email, password }) {
    const errors = {};
    const nameError = validateRequired(name, 'Name');
    if (nameError) errors.name = nameError;
    const emailError = validateEmail(email);
    if (emailError) errors.email = emailError;
    const passwordError = validatePassword(password);
    if (passwordError) errors.password = passwordError;
    return hasErrors(errors) ? errors : null;
}

export function validateForgotPasswordEmail(email) {
    const emailError = validateEmail(email);
    return emailError ? { email: emailError } : null;
}

export function validatePasswordResetFields({ password, confirmPassword }) {
    const errors = {};
    const passwordError = validatePassword(password);
    if (passwordError) errors.password = passwordError;
    if (!confirmPassword) errors.confirmPassword = 'Please confirm your password';
    else if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match';
    return hasErrors(errors) ? errors : null;
}
