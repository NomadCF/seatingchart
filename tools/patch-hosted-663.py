from pathlib import Path

path = Path('index.html')
s = path.read_text(encoding='utf-8')


def replace_once(old, new, label):
    global s
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    s = s.replace(old, new, 1)


replace_once('<meta name="app-version" content="6.6.2" />', '<meta name="app-version" content="6.6.3" />', 'version meta')
replace_once(
    '<meta name="theme-color" content="#1e3a8a" />\n  \n  <meta name="build-date" content="2026-09-04T12:39:00Z" />',
    '<meta name="theme-color" content="#1e3a8a" />\n  <link rel="manifest" href="./manifest.webmanifest" />\n  <link rel="icon" href="./app-icon.svg" type="image/svg+xml" />\n  <link rel="apple-touch-icon" href="./app-icon-192.png" />\n  <meta name="mobile-web-app-capable" content="yes" />\n  \n  <meta name="build-date" content="2026-09-04T13:23:57Z" />',
    'PWA head metadata'
)
replace_once("version: '6.6.2',", "version: '6.6.3',", 'APP_CONFIG version')
replace_once("buildDate: '2026-09-04T12:39:00Z',", "buildDate: '2026-09-04T13:23:57Z',", 'APP_CONFIG build date')
replace_once('googlePickerAppId: "",', "googlePickerAppId: '288395515246',", 'Picker App ID')

replace_once(
    "const RELEASE_HISTORY = [\n  {\n    version: '6.6.2',",
    """const RELEASE_HISTORY = [
  {
    version: '6.6.3',
    date: 'September 4, 2026',
    title: 'Hosted PWA completion and Drive Picker deployment readiness',
    current: true,
    changes: [
      'Completed the hosted PWA package with a web app manifest, service worker, install icons, offline application-shell caching, and update-aware service-worker registration.',
      'Changed deployment diagnostics to report real service-worker registration and page-control state instead of treating browser support alone as a successful PWA deployment.',
      'Configured the Google Picker App ID from the existing Google Cloud project number and added precise diagnostics for the remaining browser API key requirement.',
      'Improved Google Picker unavailable messaging so shared-Drive access problems identify the missing deployment credential instead of silently falling back.',
      'Kept Google Analytics enabled by default while preserving the existing user opt-out control.'
    ]
  },
  {
    version: '6.6.2',""",
    'release history insertion'
)
replace_once(
    "version: '6.6.2',\n    date: 'September 4, 2026',\n    title: 'Full code review, workflow repairs, and dead-style cleanup',\n    current: true,",
    "version: '6.6.2',\n    date: 'September 4, 2026',\n    title: 'Full code review, workflow repairs, and dead-style cleanup',\n    current: false,",
    'prior release current flag'
)

replace_once(
    """function googlePickerConfigured() {
  const cfg = googleDriveConfig();
  const hostedOrigin = location.protocol === 'https:' || (location.protocol === 'http:' && ['localhost','127.0.0.1'].includes(location.hostname));
  return !!(hostedOrigin && cfg.clientId && cfg.pickerApiKey && cfg.pickerAppId);
}
""",
    """function googlePickerConfigurationStatus() {
  const cfg = googleDriveConfig();
  const hostedOrigin = location.protocol === 'https:' || (location.protocol === 'http:' && ['localhost','127.0.0.1'].includes(location.hostname));
  const missing = [];
  if (!hostedOrigin) missing.push('HTTPS hosted origin');
  if (!cfg.clientId) missing.push('OAuth client ID');
  if (!cfg.pickerApiKey) missing.push('Browser API key');
  if (!cfg.pickerAppId) missing.push('Cloud project number');
  return { ready: missing.length === 0, missing, hostedOrigin };
}

function googlePickerConfigured() {
  return googlePickerConfigurationStatus().ready;
}
""",
    'Picker readiness helper'
)

replace_once(
    """    if (!googlePickerConfigured()) {
      if (!options.silent) setLiveStatusMessage('Google Picker is not enabled for this deployment. Use the planner Drive save list instead.');
      return false;
    }
""",
    """    if (!googlePickerConfigured()) {
      const pickerStatus = googlePickerConfigurationStatus();
      if (!options.silent) setLiveStatusMessage(`Google Picker is not ready for this deployment. Missing: ${pickerStatus.missing.join(', ')}. Use the planner Drive save list until deployment configuration is complete.`);
      return false;
    }
""",
    'Picker unavailable message'
)

replace_once(
    """    const diagnostics = await BrowserDataStore.diagnostics();
    const secure = window.isSecureContext; const protocol=location.protocol; const embedded=appIsEmbeddedFrame(); const linked=linkedSaveApiSupported(); const driveConfigured=googleDriveConfigured();
    const rows=[
""",
    """    const diagnostics = await BrowserDataStore.diagnostics();
    const secure = window.isSecureContext; const protocol=location.protocol; const embedded=appIsEmbeddedFrame(); const linked=linkedSaveApiSupported(); const driveConfigured=googleDriveConfigured();
    const pickerStatus = googlePickerConfigurationStatus();
    const pwaStatus = window.__plannerPwaStatus || {};
    const pwaSupported = 'serviceWorker' in navigator;
    const pwaValue = !pwaSupported
      ? 'Unsupported by this browser'
      : protocol !== 'https:'
        ? 'Requires HTTPS hosted package'
        : pwaStatus.error
          ? `Registration failed: ${pwaStatus.error}`
          : pwaStatus.registered
            ? (pwaStatus.controlling ? 'Registered, offline cache ready, and controlling this page' : 'Registered; control activates after navigation/reload')
            : 'Registration pending';
    const rows=[
""",
    'deployment diagnostics setup'
)

replace_once(
    """      ['Google Drive OAuth',driveConfigured?(secure&&!embedded?'Configured and origin may authorize':'Configured, but current environment may block OAuth'):'Client ID not configured',driveConfigured&&secure&&!embedded?'good':'warn'],
      ['Embedded frame',embedded?'Yes; file pickers/OAuth may be restricted':'No','good'],
      ['PWA/service worker',('serviceWorker' in navigator)&&protocol==='https:'?'Supported':'Requires HTTPS hosted package',('serviceWorker' in navigator)&&protocol==='https:'?'good':'warn'],
""",
    """      ['Google Drive OAuth',driveConfigured?(secure&&!embedded?'Configured and origin may authorize':'Configured, but current environment may block OAuth'):'Client ID not configured',driveConfigured&&secure&&!embedded?'good':'warn'],
      ['Google Drive Picker',pickerStatus.ready?'Configured for shared-file selection':`Missing ${pickerStatus.missing.join(', ')}`,pickerStatus.ready?'good':'warn'],
      ['Embedded frame',embedded?'Yes; file pickers/OAuth may be restricted':'No','good'],
      ['PWA/service worker',pwaValue,pwaStatus.registered&&pwaStatus.controlling?'good':'warn'],
""",
    'deployment diagnostic rows'
)

replace_once(
    """async function registerHostedServiceWorker() {
  if (!('serviceWorker' in navigator)) return false;
  if (!/^https?:$/.test(location.protocol) || location.hostname === 'example.test') return false;
  try {
    const registration = await navigator.serviceWorker.register('./service-worker.js', { scope: './', updateViaCache: 'none' });
    window.__plannerServiceWorkerRegistration = registration;
    const announceWaitingUpdate = () => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        window.dispatchEvent(new CustomEvent('planner-update-available', { detail: { registration } }));
      }
    };
    announceWaitingUpdate();
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) announceWaitingUpdate();
      });
    });
    return true;
  } catch (error) {
    recordStorageFailure('service-worker-register', 'service-worker.js', error);
    return false;
  }
}
""",
    """async function registerHostedServiceWorker() {
  const status = window.__plannerPwaStatus = {
    supported: 'serviceWorker' in navigator,
    eligibleOrigin: /^https?:$/.test(location.protocol) && location.hostname !== 'example.test',
    registered: false,
    controlling: Boolean(navigator.serviceWorker?.controller),
    error: ''
  };
  const announceStatus = () => window.dispatchEvent(new CustomEvent('planner-pwa-status-changed', { detail: { ...status } }));
  if (!status.supported || !status.eligibleOrigin) {
    announceStatus();
    return false;
  }
  try {
    const registration = await navigator.serviceWorker.register('./service-worker.js', { scope: './', updateViaCache: 'none' });
    window.__plannerServiceWorkerRegistration = registration;
    status.registered = true;
    status.controlling = Boolean(navigator.serviceWorker.controller);
    announceStatus();
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      status.controlling = Boolean(navigator.serviceWorker.controller);
      announceStatus();
    });
    const announceWaitingUpdate = () => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        window.dispatchEvent(new CustomEvent('planner-update-available', { detail: { registration } }));
      }
    };
    announceWaitingUpdate();
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) announceWaitingUpdate();
      });
    });
    return true;
  } catch (error) {
    status.error = String(error?.message || error || 'Unknown service-worker registration error');
    announceStatus();
    recordStorageFailure('service-worker-register', 'service-worker.js', error);
    return false;
  }
}
""",
    'service worker registration status'
)

path.write_text(s, encoding='utf-8')
print('Patched hosted app to 6.6.3')
