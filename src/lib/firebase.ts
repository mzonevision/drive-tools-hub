import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive');
provider.addScope('https://www.googleapis.com/auth/drive.readonly');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/drive.metadata.readonly');
provider.setCustomParameters({
  prompt: 'consent'
});

export interface AppUser {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
}

const TOKEN_KEY = 'mzu_google_drive_access_token_v3';
const USER_KEY = 'mzu_google_user_v3';
const TOKEN_TIME_KEY = 'mzu_google_token_time_v3';

// Google OAuth access tokens expire after 60 minutes.
// We consider them expired after 50 minutes to be safe.
export const isStoredTokenExpired = (): boolean => {
  try {
    const timeStr = sessionStorage.getItem(TOKEN_TIME_KEY);
    if (!timeStr) return false;
    const issuedAt = parseInt(timeStr, 10);
    return Date.now() - issuedAt > 50 * 60 * 1000;
  } catch {
    return false;
  }
};

let cachedAccessToken: string | null = null;
try {
  if (isStoredTokenExpired()) {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_TIME_KEY);
  } else {
    cachedAccessToken = sessionStorage.getItem(TOKEN_KEY);
  }
} catch (e) {}

/**
 * Loads the Google Identity Services (GSI) script if not already available.
 */
export const loadGisScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // @ts-ignore
    if (window.google?.accounts?.oauth2) {
      return resolve();
    }
    const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existing) {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        // @ts-ignore
        if (window.google?.accounts?.oauth2) {
          clearInterval(interval);
          resolve();
        } else if (attempts > 50) {
          clearInterval(interval);
          reject(new Error('Google Identity Services script failed to initialize.'));
        }
      }, 100);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      // @ts-ignore
      if (window.google?.accounts?.oauth2) {
        resolve();
      } else {
        reject(new Error('Google Identity Services loaded but oauth2 is not ready.'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load Google Identity Services.'));
    document.head.appendChild(script);
  });
};

/**
 * Sign in using Google Identity Services (GIS) Token Client.
 * Directly acquires Google Drive OAuth Access Token without relying on identitytoolkit endpoints.
 */
export const signInWithGis = async (): Promise<{ user: AppUser; accessToken: string }> => {
  await loadGisScript();
  return new Promise((resolve, reject) => {
    try {
      // @ts-ignore
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: firebaseConfig.oAuthClientId,
        scope: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/drive.readonly',
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/drive.metadata.readonly',
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/userinfo.email',
          'openid'
        ].join(' '),
        prompt: 'consent',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            return reject(new Error(tokenResponse.error_description || tokenResponse.error));
          }
          const accessToken = tokenResponse.access_token;
          if (!accessToken) {
            return reject(new Error('No access token received from Google Identity Services.'));
          }

          let appUser: AppUser = {
            uid: 'google-user-' + Date.now(),
            displayName: 'Google User',
            email: null,
            photoURL: null,
          };

          try {
            const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (userRes.ok) {
              const profile = await userRes.json();
              appUser = {
                uid: profile.sub || appUser.uid,
                displayName: profile.name || profile.given_name || 'Google User',
                email: profile.email || null,
                photoURL: profile.picture || null,
              };
            }
          } catch (e) {
            console.warn('Could not fetch user info from userinfo endpoint:', e);
          }

          cachedAccessToken = accessToken;
          try {
            sessionStorage.setItem(TOKEN_KEY, accessToken);
            sessionStorage.setItem(USER_KEY, JSON.stringify(appUser));
            sessionStorage.setItem(TOKEN_TIME_KEY, String(Date.now()));
          } catch (e) {}

          resolve({ user: appUser, accessToken });
        },
        error_callback: (err: any) => {
          reject(new Error(err?.message || 'Google OAuth prompt was closed or failed.'));
        }
      });

      client.requestAccessToken();
    } catch (err) {
      reject(err);
    }
  });
};

export const initAuth = (
  onAuthSuccess?: (user: AppUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  // If stored token is older than 50 minutes, purge it immediately
  if (isStoredTokenExpired()) {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_TIME_KEY);
    cachedAccessToken = null;
    if (onAuthFailure) onAuthFailure();
    return;
  }

  // Check sessionStorage first for immediate restore
  const storedToken = sessionStorage.getItem(TOKEN_KEY);
  const storedUserRaw = sessionStorage.getItem(USER_KEY);
  if (storedToken && storedUserRaw) {
    try {
      const storedUser = JSON.parse(storedUserRaw) as AppUser;
      cachedAccessToken = storedToken;
      if (onAuthSuccess) onAuthSuccess(storedUser, storedToken);
    } catch (e) {}
  }

  return onAuthStateChanged(auth, async (firebaseUser: User | null) => {
    if (firebaseUser) {
      const storedToken = cachedAccessToken || sessionStorage.getItem(TOKEN_KEY);
      if (storedToken) {
        cachedAccessToken = storedToken;
        const appUser: AppUser = {
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName,
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL,
        };
        try {
          sessionStorage.setItem(USER_KEY, JSON.stringify(appUser));
        } catch (e) {}
        if (onAuthSuccess) onAuthSuccess(appUser, storedToken);
      } else {
        if (!sessionStorage.getItem(TOKEN_KEY)) {
          if (onAuthFailure) onAuthFailure();
        }
      }
    } else {
      // If Firebase reports null user, but we have a valid GIS token and user session, preserve it!
      const fallbackToken = cachedAccessToken || sessionStorage.getItem(TOKEN_KEY);
      const fallbackUserRaw = sessionStorage.getItem(USER_KEY);
      if (fallbackToken && fallbackUserRaw) {
        try {
          const fallbackUser = JSON.parse(fallbackUserRaw) as AppUser;
          if (onAuthSuccess) onAuthSuccess(fallbackUser, fallbackToken);
          return;
        } catch (e) {}
      }

      cachedAccessToken = null;
      try {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
      } catch (e) {}
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: AppUser; accessToken: string } | null> => {
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Google Sign-In');
    }

    const appUser: AppUser = {
      uid: result.user.uid,
      displayName: result.user.displayName,
      email: result.user.email,
      photoURL: result.user.photoURL,
    };

    cachedAccessToken = credential.accessToken;
    try {
      sessionStorage.setItem(TOKEN_KEY, credential.accessToken);
      sessionStorage.setItem(USER_KEY, JSON.stringify(appUser));
      sessionStorage.setItem(TOKEN_TIME_KEY, String(Date.now()));
    } catch (e) {}
    return { user: appUser, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.warn('Sign in via Firebase encountered an error:', error);
    // If it's a network error (e.g. auth/network-request-failed) or blocked endpoint,
    // automatically fall back to Google Identity Services token client!
    if (
      error?.code === 'auth/network-request-failed' ||
      error?.code === 'auth/internal-error' ||
      error?.message?.includes('network-request-failed')
    ) {
      console.log('Firebase auth/network-request-failed detected. Triggering Google Identity Services fallback...');
      try {
        return await signInWithGis();
      } catch (gisError: any) {
        console.error('GIS fallback also failed:', gisError);
        throw new Error(
          gisError?.message || 'Google Sign-in failed due to network request error. Please verify your internet connection or ad-blocker.'
        );
      }
    }
    throw error;
  }
};

export const getAccessToken = () => cachedAccessToken || sessionStorage.getItem(TOKEN_KEY);

export const logout = async () => {
  try {
    await auth.signOut();
  } catch (e) {}
  cachedAccessToken = null;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_TIME_KEY);
  } catch (e) {}
};
