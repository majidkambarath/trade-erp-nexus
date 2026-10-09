// Choosing a new password: the one rule set, used by the Settings screen (a person changing their own) and by the screen shown to
// someone whose password was set by somebody else. No React in it, so it is tested without rendering. The server checks the same
// things (adminController.changePassword) and says so in its own words if this ever lets one through.

export const MIN_PASSWORD = 8;

/**
 * What is wrong with the form, as { field: message }; {} when it is good to send. `needCurrent` is false only where the current
 * password is not asked for (it always is today).
 */
export function validatePasswordChange({ currentPassword = "", newPassword = "", confirmPassword = "" } = {}) {
  const found = {};
  if (!currentPassword) found.currentPassword = "Enter your current password";
  if (newPassword.length < MIN_PASSWORD) found.newPassword = `Use at least ${MIN_PASSWORD} characters`;
  else if (newPassword === currentPassword) found.newPassword = "Choose a password you have not used here";
  if (confirmPassword !== newPassword) found.confirmPassword = "The two passwords do not match";
  return found;
}

export const passwordHint = `At least ${MIN_PASSWORD} characters. Longer, with capitals, digits and symbols, is stronger.`;
