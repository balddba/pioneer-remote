/**
 * Haptic Feedback Utility for Mobile Touch Interfaces.
 *
 * Provides physical tactile feedback on supported mobile devices using the HTML5
 * Vibration API (`navigator.vibrate`). Enhances user experience during button presses,
 * volume slider adjustments, and status toggles.
 */

/**
 * Supported vibration pattern types for tactile interface feedback.
 *
 * - `light`: Subtle 10ms vibration pulse for continuous controls (e.g. volume step buttons).
 * - `medium`: 20ms vibration pulse for discrete choices (e.g. input preset selection).
 * - `heavy`: Pronounced 35ms vibration pulse for primary actions (e.g. power switch, mute toggle).
 * - `double`: Two 15ms pulses separated by 30ms rest (`[15, 30, 15]`) for state changes or confirmations.
 */
export type HapticFeedbackType = 'light' | 'medium' | 'heavy' | 'double';

/**
 * Triggers a localized vibration pattern on devices supporting the Web Vibration API.
 *
 * Checks for runtime environment safety (SSR / Node.js contexts where `window` is undefined),
 * verifies API availability (`navigator.vibrate`), and gracefully handles hardware restrictions
 * or browser policy exceptions (e.g. iOS WebKit absence, iframe sandbox restrictions, or lack
 * of user activation).
 *
 * @param type - The preset vibration profile to trigger. Defaults to `'light'`.
 *
 * @example
 * ```ts
 * // Subtle tick for volume adjustments
 * triggerHaptic('light');
 *
 * // Stronger feedback when powering on or off
 * triggerHaptic('heavy');
 *
 * // Double-tap pattern on command success
 * triggerHaptic('double');
 * ```
 */
export function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'double' = 'light'): void {
  // Guard against server-side rendering (SSR) environments and browsers lacking Vibration API support
  // (e.g., Apple iOS Safari where navigator.vibrate is intentionally not implemented)
  if (typeof window === 'undefined' || !window.navigator || !window.navigator.vibrate) {
    return;
  }

  try {
    // Map preset feedback types to millisecond vibration patterns
    switch (type) {
      case 'light':
        // 10ms brief tick for rapid repetitive clicks (e.g., volume increments)
        window.navigator.vibrate(10);
        break;
      case 'medium':
        // 20ms distinct bump for selection actions (e.g., input source presets)
        window.navigator.vibrate(20);
        break;
      case 'heavy':
        // 35ms strong pulse for critical state changes (e.g., power or mute)
        window.navigator.vibrate(35);
        break;
      case 'double':
        // Double-pulse cadence: 15ms vibrate, 30ms pause, 15ms vibrate
        window.navigator.vibrate([15, 30, 15]);
        break;
    }
  } catch {
    // Silently ignore browser security restrictions (e.g. SecurityError if iframe lacks allow="vibrate",
    // or NotAllowedError if user activation gesture expired)
  }
}

