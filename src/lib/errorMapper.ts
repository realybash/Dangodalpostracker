export const getFriendlyErrorMessage = (errorCode: string): string => {
  switch (errorCode) {
    case 'auth/email-already-in-use':
      return 'An account already exists with this phone number or recovery email. Please sign in instead.';
    case 'auth/weak-password':
      return 'The passcode/PIN is too weak (minimum 6 characters required).';
    case 'auth/network-request-failed':
      return 'A network error occurred. Please verify your internet connection and try again.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect PIN or passcode.';
    case 'auth/user-not-found':
      return 'Account not found. Please verify the credentials or register first.';
    case 'permission-denied':
      return 'Database access denied. Please contact support.';
    case 'already-exists':
      return 'An account with these details already exists.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
};
