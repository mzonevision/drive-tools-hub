import firebaseConfig from '../../firebase-applet-config.json';

/**
 * Ultra-Robust Google API and Picker Loader
 */

let isPickerLoaded = false;
let pickerLoadingPromise: Promise<void> | null = null;

/**
 * Checks if the Google Picker API is already available in the global scope.
 */
const isPickerAvailable = () => {
  // @ts-ignore
  return !!(window.google && window.google.picker && window.google.picker.PickerBuilder);
};

/**
 * Loads the Google Picker API scripts.
 */
export const loadGoogleApi = (): Promise<void> => {
  if (isPickerAvailable()) {
    isPickerLoaded = true;
    return Promise.resolve();
  }

  if (pickerLoadingPromise) return pickerLoadingPromise;

  pickerLoadingPromise = new Promise((resolve, reject) => {
    console.log('D-VAC: Checking for GAPI availability...');

    // Function to initiate the picker module load
    const initPickerLoad = () => {
      // @ts-ignore
      if (typeof gapi === 'undefined') {
        pickerLoadingPromise = null;
        reject(new Error('GAPI global object missing. Please check if your ad-blocker is blocking apis.google.com.'));
        return;
      }

      console.log('D-VAC: Calling gapi.load("picker")...');
      try {
        // @ts-ignore
        gapi.load('picker', {
          callback: () => {
            console.log('D-VAC: gapi.load callback fired.');
            // Wait for objects to settle
            let attempts = 0;
            const check = setInterval(() => {
              attempts++;
              if (isPickerAvailable()) {
                clearInterval(check);
                console.log('D-VAC: Picker module ready.');
                isPickerLoaded = true;
                resolve();
              } else if (attempts > 100) { // 10 seconds
                clearInterval(check);
                pickerLoadingPromise = null;
                reject(new Error('Picker module objects failed to initialize after load.'));
              }
            }, 100);
          },
          onerror: (err: any) => {
            console.error('D-VAC: GAPI Picker Load Error:', err);
            pickerLoadingPromise = null;
            reject(new Error('Failed to load Google Picker library module.'));
          },
          timeout: 45000, // Increased timeout to 45 seconds
          ontimeout: () => {
            if (isPickerAvailable()) {
              console.log('D-VAC: Picker available despite timeout.');
              isPickerLoaded = true;
              resolve();
            } else {
              console.error('D-VAC: Google Picker load timed out (45s).');
              pickerLoadingPromise = null;
              reject(new Error('Google Picker load timed out. This is often caused by ad-blockers, slow network, or restricted cookies. Please try refreshing.'));
            }
          }
        });
      } catch (e: any) {
        console.error('D-VAC: GAPI Load Catch:', e);
        pickerLoadingPromise = null;
        reject(e);
      }
    };

    // Check if gapi is already present (from index.html script tag)
    // @ts-ignore
    if (window.gapi) {
      initPickerLoad();
    } else {
      // Fallback: poll for gapi for a few seconds if it's still loading from index.html
      let gapiCheckAttempts = 0;
      const gapiCheckInterval = setInterval(() => {
        gapiCheckAttempts++;
        // @ts-ignore
        if (window.gapi) {
          clearInterval(gapiCheckInterval);
          initPickerLoad();
        } else if (gapiCheckAttempts > 50) { // 5 seconds
          clearInterval(gapiCheckInterval);
          // If still not there, try injecting it manually as a last resort
          console.log('D-VAC: GAPI not found, injecting script tag manually...');
          const script = document.createElement('script');
          script.src = 'https://apis.google.com/js/api.js';
          script.async = true;
          script.onload = () => initPickerLoad();
          script.onerror = () => {
            pickerLoadingPromise = null;
            reject(new Error('Failed to load Google API script.'));
          };
          document.body.appendChild(script);
        }
      }, 100);
    }
  });

  return pickerLoadingPromise;
};

/**
 * Opens the Google Picker to select a video file.
 */
export const openPicker = async (
  accessToken: string,
  onPicked: (file: { id: string; name: string }) => void
) => {
  try {
    await loadGoogleApi();
  } catch (error: any) {
    console.error('D-VAC: Picker Load Final Catch:', error);
    throw error;
  }

  if (!isPickerAvailable()) {
    throw new Error('Google Picker API not ready. Please refresh the page.');
  }

  // @ts-ignore
  const pickerOrigin = window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0
    ? window.location.ancestorOrigins[window.location.ancestorOrigins.length - 1]
    : window.location.origin;

  try {
    // @ts-ignore
    const view = new google.picker.DocsView(google.picker.ViewId.DOCS);
    view.setMimeTypes('video/mp4,video/x-matroska,video/quicktime,video/x-msvideo,video/webm');
    
    // @ts-ignore
    const sharedView = new google.picker.DocsView(google.picker.ViewId.DOCS)
      .setOwnedByMe(false)
      .setMimeTypes('video/mp4,video/x-matroska,video/quicktime,video/x-msvideo,video/webm');

    // @ts-ignore
    const builder = new google.picker.PickerBuilder()
      .addView(view)
      .addView(sharedView)
      .setOAuthToken(accessToken);

    if (firebaseConfig.apiKey) {
      builder.setDeveloperKey(firebaseConfig.apiKey);
    }
    if (firebaseConfig.appId) {
      builder.setAppId(firebaseConfig.appId);
    }

    const picker = builder
      .setCallback((data: any) => {
        // @ts-ignore
        if (data.action === google.picker.Action.PICKED) {
          const file = data.docs[0];
          onPicked({ id: file.id, name: file.name });
        }
      })
      .setOrigin(pickerOrigin)
      .setTitle('Select a video to convert')
      .build();

    picker.setVisible(true);
  } catch (e) {
    console.error('D-VAC: Picker Builder Error:', e);
    throw new Error('Could not create Picker window. This might be blocked by your browser settings or a pop-up blocker.');
  }
};
