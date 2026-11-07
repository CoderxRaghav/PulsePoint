import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from "firebase/auth";

// Firebase client configuration read from public environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Check whether required Firebase configuration values are present.
 * Prevents application crashes when environment variables are not yet provided.
 */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.apiKey !== "your_api_key_here" &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;
let githubProvider: GithubAuthProvider | null = null;

if (typeof window !== "undefined") {
  if (isFirebaseConfigured) {
    try {
      app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      auth = getAuth(app);
      googleProvider = new GoogleAuthProvider();
      googleProvider.setCustomParameters({
        prompt: "select_account",
      });
      githubProvider = new GithubAuthProvider();
      githubProvider.addScope("read:user");
      githubProvider.addScope("user:email");
    } catch (err) {
      console.warn("Failed to initialize Firebase client SDK:", err);
    }
  }
}

export { app, auth, googleProvider, githubProvider };

export interface GoogleSignInResult {
  success: boolean;
  user?: User;
  error?: string;
  isConfigMissing?: boolean;
  redirecting?: boolean;
  cancelled?: boolean;
}

let authInitializationPromise: Promise<User | null> | null = null;
let googleSignInInFlight: Promise<GoogleSignInResult> | null = null;
let authInitializationError: string | null = null;

/**
 * Completes a possible OAuth redirect exactly once before consumers make
 * routing decisions from Firebase's persisted auth state.
 */
export function initializeAuth(): Promise<User | null> {
  if (!auth) return Promise.resolve(null);
  if (!authInitializationPromise) {
    authInitializationPromise = getRedirectResult(auth)
      .then((result) => result?.user ?? auth!.currentUser)
      .catch((error: unknown) => {
        // The auth-state observer remains the source of truth. A redirect
        // result error must not turn an already-restored session into a logout.
        if (auth!.currentUser) return auth!.currentUser;
        authInitializationError = errorMessage(error, "Google");
        throw error;
      });
  }
  return authInitializationPromise;
}

/** Returns an actionable redirect-completion error, if one occurred. */
export function getAuthInitializationError() {
  return authInitializationError;
}

function errorCode(error: unknown) {
  return (error as { code?: string } | undefined)?.code;
}

function errorMessage(error: unknown, provider: "Google" | "GitHub") {
  const code = errorCode(error);
  switch (code) {
    case "auth/popup-closed-by-user":
      return "Sign-in was cancelled before completion. Please try again.";
    case "auth/cancelled-popup-request":
      return "Another sign-in request is already in progress.";
    case "auth/network-request-failed":
      return "Network connection failed. Please verify your internet connection.";
    case "auth/unauthorized-domain":
      return "This domain is not authorized in Firebase Console. Add this app's domain under Authentication > Settings > Authorized domains.";
    case "auth/operation-not-allowed":
      return `${provider} sign-in is not enabled in your Firebase Project. Enable it under Authentication > Sign-in method.`;
    case "auth/account-exists-with-different-credential":
      return "An account already exists with the same email but a different sign-in method. Please use the original sign-in method.";
    default:
      return (error as { message?: string } | undefined)?.message || `Unable to complete ${provider} sign-in. Please verify Firebase project settings.`;
  }
}

/**
 * Initiate Google Sign-In with Firebase Authentication via popup.
 * Handles configuration checks, popup blocking, cancellation, and provider errors.
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  if (!isFirebaseConfigured || !auth || !googleProvider) {
    return {
      success: false,
      isConfigMissing: true,
      error:
        "Firebase is not configured yet. Please add your web app credentials to .env.local as described in the Firebase setup guide.",
    };
  }

  if (googleSignInInFlight) return googleSignInInFlight;

  googleSignInInFlight = (async () => {
    // Do not open a second window for a session restored while the auth page
    // was hydrating.
    await initializeAuth().catch(() => null);
    if (auth.currentUser) return { success: true, user: auth.currentUser };

    try {
      const result = await signInWithPopup(auth, googleProvider);
      return { success: true, user: result.user };
    } catch (error: unknown) {
      // A popup can be blocked after Firebase has already restored/created a
      // session. Auth state wins over the transient popup error in that case.
      if (auth.currentUser) return { success: true, user: auth.currentUser };

      if (errorCode(error) === "auth/popup-blocked") {
        try {
          await signInWithRedirect(auth, googleProvider);
          return { success: true, redirecting: true };
        } catch (redirectError: unknown) {
          if (auth.currentUser) return { success: true, user: auth.currentUser };
          return { success: false, error: errorMessage(redirectError, "Google") };
        }
      }

      return {
        success: false,
        cancelled: errorCode(error) === "auth/popup-closed-by-user" || errorCode(error) === "auth/cancelled-popup-request",
        error: errorMessage(error, "Google"),
      };
    }
  })();

  try {
    return await googleSignInInFlight;
  } finally {
    googleSignInInFlight = null;
  }
}

/**
 * Initiate GitHub Sign-In with Firebase Authentication via popup.
 * Handles configuration checks, popup blocking, cancellation, and provider errors.
 */
export async function signInWithGithub(): Promise<GoogleSignInResult> {
  if (!isFirebaseConfigured || !auth || !githubProvider) {
    return {
      success: false,
      isConfigMissing: true,
      error:
        "Firebase is not configured yet. Please add your web app credentials to .env.local as described in the Firebase setup guide.",
    };
  }

  try {
    const result = await signInWithPopup(auth, githubProvider);
    return {
      success: true,
      user: result.user,
    };
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };
    const errorCode = error?.code;

    switch (errorCode) {
      case "auth/popup-closed-by-user":
        return {
          success: false,
          error: "Sign-in was cancelled before completion. Please try again.",
        };
      case "auth/popup-blocked":
        return {
          success: false,
          error:
            "The GitHub sign-in popup was blocked by your browser. Please allow popups for localhost and try again.",
        };
      case "auth/cancelled-popup-request":
        return {
          success: false,
          error: "Only one sign-in window can be open at a time.",
        };
      case "auth/network-request-failed":
        return {
          success: false,
          error: "Network connection failed. Please verify your internet connection.",
        };
      case "auth/unauthorized-domain":
        return {
          success: false,
          error:
            "This domain is not authorized in Firebase Console. Add 'localhost' under Authentication > Settings > Authorized domains.",
        };
      case "auth/operation-not-allowed":
        return {
          success: false,
          error:
            "GitHub sign-in is not enabled in your Firebase Project. Enable it under Authentication > Sign-in method > GitHub.",
        };
      case "auth/account-exists-with-different-credential":
        return {
          success: false,
          error:
            "An account already exists with the same email but a different sign-in method. Please sign in with Google or your original method.",
        };
      default:
        return {
          success: false,
          error:
            error?.message ||
            "Unable to complete GitHub sign-in. Please verify Firebase project settings.",
        };
    }
  }
}

/**
 * Sign out the currently active Firebase user.
 */
export async function logOut(): Promise<void> {
  if (auth) {
    await signOut(auth);
  }
}

/**
 * Subscribe to Firebase auth state changes.
 */
export function subscribeToAuthChanges(callback: (user: User | null) => void): () => void {
  if (!auth) {
    callback(null);
    return () => {};
  }
  let unsubscribe = () => {};
  let active = true;

  void initializeAuth()
    .catch(() => null)
    .finally(() => {
      if (active) unsubscribe = onAuthStateChanged(auth!, callback);
    });

  return () => {
    active = false;
    unsubscribe();
  };
}

