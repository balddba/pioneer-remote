import React from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

/**
 * Representation of an individual toast notification message.
 */
export interface ToastMessage {
  /**
   * Unique identifier used for list rendering keys and dismissal targeting.
   */
  id: string;

  /**
   * Visual and semantic notification variant.
   * - `'success'`: Indicates successful command delivery or operation (emerald styling).
   * - `'error'`: Indicates network failure, timeout, or rejected command (rose styling).
   * - `'info'`: Neutral informational update (slate styling).
   */
  type: 'success' | 'error' | 'info';

  /**
   * Human-readable text content displayed inside the toast pill.
   */
  text: string;
}

/**
 * Props for the {@link ToastContainer} component.
 */
interface ToastProps {
  /**
   * Array of active toast messages currently displayed.
   */
  toasts: ToastMessage[];

  /**
   * Callback invoked when a user clicks the dismiss button on a toast message.
   *
   * @param id - The unique ID of the toast to remove.
   */
  onDismiss: (id: string) => void;
}

/**
 * Overlay container for rendering transient toast notifications.
 *
 * Positioned fixed at the bottom-center of the viewport. Uses `pointer-events-none` on the
 * outer wrapper so clicks pass through to background controls, while individual toast items
 * re-enable pointer events for interactive dismissal.
 *
 * @param props - Component properties conforming to {@link ToastProps}.
 * @returns Rendered toast stack overlay or `null` if no toasts exist.
 */
export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  // If there are no active toasts, don't mount unnecessary DOM elements
  if (toasts.length === 0) return null;

  return (
    // Fixed container centered at bottom of viewport; pointer-events-none allows clicks through to underlying UI
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col space-y-2 w-[90%] max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          // Individual toast cards re-enable pointer events for the dismiss button
          className={`pointer-events-auto flex items-center justify-between p-3 rounded-2xl border shadow-xl backdrop-blur-md transition-all animate-bounce-short ${
            t.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
              : t.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : 'bg-slate-900/90 border-slate-700 text-slate-200'
          }`}
        >
          {/* Notification icon and text message with truncation for long strings */}
          <div className="flex items-center space-x-2.5 overflow-hidden">
            {t.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span className="text-xs font-medium truncate">{t.text}</span>
          </div>

          {/* Manual dismiss button */}
          <button
            onClick={() => onDismiss(t.id)}
            className="p-1 hover:bg-white/10 rounded-lg shrink-0 ml-2"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
