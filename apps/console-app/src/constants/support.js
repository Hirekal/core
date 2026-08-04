/** Support inbox opened via mailto from account / profile Support actions. */
export const SUPPORT_EMAIL =
  import.meta.env.VITE_SUPPORT_EMAIL || 'mit@iqudinformatics.com';

export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Hirekal Support')}`;
