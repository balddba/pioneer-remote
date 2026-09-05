/**
 * Utility for triggering subtle haptic feedback on mobile devices.
 */
export function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'double' = 'light'): void {
  if (typeof window === 'undefined' || !window.navigator || !window.navigator.vibrate) {
    return;
  }

  try {
    switch (type) {
      case 'light':
        window.navigator.vibrate(10);
        break;
      case 'medium':
        window.navigator.vibrate(20);
        break;
      case 'heavy':
        window.navigator.vibrate(35);
        break;
      case 'double':
        window.navigator.vibrate([15, 30, 15]);
        break;
    }
  } catch {
    // Ignore unsupported device errors silently
  }
}
