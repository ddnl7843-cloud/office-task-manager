export type MobileDeviceType = 'android' | 'ios' | 'desktop';

export function getDeviceType(userAgent?: string): MobileDeviceType {
  const ua = (userAgent || navigator?.userAgent || '').toLowerCase();

  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

export function getMobileInstallSteps(deviceType: MobileDeviceType | string) {
  const normalized = (deviceType || '').toLowerCase();

  if (normalized === 'ios') {
    return [
      'Open the link in Safari.',
      'Tap the Share button at the bottom of the screen.',
      'Scroll and choose Add to Home Screen.',
      'Tap Add in the top-right corner, then open the app from your home screen.',
    ];
  }

  if (normalized === 'android') {
    return [
      'Open the link in Chrome or your mobile browser.',
      'Tap the menu button in the top-right corner.',
      'Select Install app or Add to Home screen.',
      'Confirm the install and open the app from the home screen.',
    ];
  }

  return [
    'Open this link in your mobile browser.',
    'Use the browser menu to install the app.',
    'Choose Add to Home screen or Install app.',
    'Open the app after installation completes.',
  ];
}

export function buildDownloadText(appUrl: string, deviceType: MobileDeviceType | string) {
  const steps = getMobileInstallSteps(deviceType);
  return [
    'Office Task Manager install instructions',
    '',
    `App link: ${appUrl}`,
    '',
    'Steps:',
    ...steps.map((step, index) => `${index + 1}. ${step}`),
    '',
    'Open the app link on mobile to install it directly from the browser.'
  ].join('\n');
}
