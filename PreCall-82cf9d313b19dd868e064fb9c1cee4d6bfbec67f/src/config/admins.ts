/**
 * Admin Configuration
 * 
 * Add approved Google emails here to grant admin access.
 * This is the source of truth for admin permissions in the frontend.
 */

export const FOUNDER_EMAIL = 'precall.admin@gmail.com';

export const APPROVED_ADMIN_EMAILS = [
  FOUNDER_EMAIL, // Founder (Safety Net)
];

/**
 * Helper to check if an email is an approved admin
 */
export const isEmailAdmin = (email: string | null | undefined): boolean => {
  if (!email) return false;
  return APPROVED_ADMIN_EMAILS.includes(email.toLowerCase());
};
