import { useCallback, useRef, useState } from 'react';

import Icon from './Icon.jsx';
import { useChrome } from '../state/ChromeContext.jsx';

/**
 * A navigation screen with iOS's collapsing large title.
 *
 * The bar itself is clear until content passes under it, at which point a sheet
 * of glass fades in behind. Bar buttons are their own small glass capsules that
 * float over the content rather than sitting in a solid bar.
 */
export default function Screen({
  title,
  largeTitle = true,
  onBack,
  backLabel = 'Back',
  trailing,
  subtitle,
  header,
  children,
  scrollRef,
  contentClassName = '',
  bottomInset = 0,
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const internalRef = useRef(null);
  const ref = scrollRef ?? internalRef;
  const { reportScroll } = useChrome();

  const onScroll = useCallback(
    (event) => {
      const { scrollTop: top } = event.currentTarget;
      setScrollTop(top);
      reportScroll(top);
    },
    [reportScroll],
  );

  const clamp = (value) => Math.min(1, Math.max(0, value));

  // Large titles hand off to the compact title once they scroll under the bar.
  const handoff = largeTitle ? clamp((scrollTop - 18) / 26) : 1;
  const barSolid = largeTitle ? handoff : clamp(scrollTop / 8);
  const stretch = scrollTop < 0 ? 1 + Math.min(-scrollTop, 120) / 420 : 1;

  return (
    <div className="aurora-surface relative h-full w-full">
      {/* --- Navigation bar ------------------------------------------- */}
      <div
        className="absolute inset-x-0 top-0 z-30"
        style={{ paddingTop: 'var(--safe-top)', pointerEvents: 'none' }}
      >
        <div
          className="glass absolute inset-0"
          style={{
            opacity: barSolid,
            transition: 'opacity 0.2s linear',
            // A bar spans the full width, so it reads better squared off.
            borderRadius: 0,
            boxShadow: 'none',
          }}
        />

        <div
          className="relative flex items-center justify-between px-3"
          style={{ height: 'var(--nav-h)', pointerEvents: 'auto' }}
        >
          <div className="flex min-w-0 flex-1 items-center">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label={backLabel}
                className="glass glass-thin glass-press flex items-center justify-center"
                style={{ width: 36, height: 36, borderRadius: 18, color: 'var(--tint)' }}
              >
                <span className="relative z-10 flex" style={{ marginLeft: -2 }}>
                  <Icon name="chevron.left" size={19} />
                </span>
              </button>
            )}
          </div>

          <div
            className="pointer-events-none absolute inset-x-0 flex flex-col items-center justify-center"
            style={{
              height: 'var(--nav-h)',
              opacity: handoff,
              transform: `translateY(${(1 - handoff) * 7}px)`,
            }}
          >
            <span className="t-headline truncate-1" style={{ maxWidth: '54vw' }}>
              {title}
            </span>
            {subtitle && (
              <span
                className="t-caption2 truncate-1"
                style={{ color: 'var(--label-2)', maxWidth: '54vw' }}
              >
                {subtitle}
              </span>
            )}
          </div>

          <div className="flex flex-1 items-center justify-end gap-2">{trailing}</div>
        </div>
      </div>

      {/* --- Scrolling content ---------------------------------------- */}
      <div
        ref={ref}
        onScroll={onScroll}
        className={`ios-scroll h-full ${contentClassName}`}
        style={{
          paddingTop: `calc(var(--safe-top) + var(--nav-h))`,
          paddingBottom: bottomInset,
        }}
      >
        {largeTitle && (
          <div className="px-4 pb-1 pt-1.5">
            <h1
              className="t-large-title"
              style={{
                transform: `scale(${stretch})`,
                transformOrigin: 'left bottom',
                willChange: 'transform',
              }}
            >
              {title}
            </h1>
          </div>
        )}

        {header}
        {children}
      </div>
    </div>
  );
}

/** Circular glass button for the nav bar's trailing slot. */
export function BarButton({ icon, label, onClick, tint = 'var(--tint)', children }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="glass glass-thin glass-press flex items-center justify-center"
      style={{ width: 36, height: 36, borderRadius: 18, color: tint }}
      title={label}
    >
      <span className="relative z-10 flex">{children ?? <Icon name={icon} size={19} />}</span>
    </button>
  );
}
