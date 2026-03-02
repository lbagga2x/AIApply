import { Amplify } from "aws-amplify";
import {
  signIn,
  signUp,
  signOut,
  confirmSignUp,
  getCurrentUser,
  fetchAuthSession,
} from "aws-amplify/auth";

// Configure Amplify once — called from layout
export function configureAmplify() {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
        userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
      },
    },
  });
}

export { signIn, signUp, signOut, confirmSignUp, getCurrentUser, fetchAuthSession };

/** Get the current user's JWT token for API calls */
export async function getAuthToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() ?? null;
  } catch {
    return null;
  }
}

/** Check if user is signed in.
 *  Uses fetchAuthSession so Amplify auto-refreshes an expired access token
 *  before deciding the user is logged out. getCurrentUser() can throw during
 *  the brief refresh window, causing spurious redirects to /login.
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const session = await fetchAuthSession();
    return !!session.tokens?.idToken;
  } catch {
    return false;
  }
}
