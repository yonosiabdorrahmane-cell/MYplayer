import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';

import { haptic } from '../lib/format.js';

const SPRING = { type: 'spring', stiffness: 420, damping: 42, mass: 1 };

/**
 * A UIKit-style sheet: rounded card that slides up over a dimmed, slightly
 * shrunken backdrop, with drag-to-dismiss that respects flick velocity.
 */
export default function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  leading,
  trailing,
  // Forms need the drag off: pulling on a text field shouldn't dismiss them.
  allowDrag = true,
  height = '58vh',
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
        >
          <div className="absolute inset-0" style={{ background: 'var(--scrim)' }} onPointerDown={onClose} />

          <motion.div
            className="glass glass-thick relative w-full overflow-hidden"
            style={{
              height,
              maxHeight: '92vh',
              borderTopLeftRadius: 26,
              borderTopRightRadius: 26,
              paddingBottom: 'var(--safe-bottom)',
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SPRING}
            drag={allowDrag ? 'y' : false}
            dragDirectionLock
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.9 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 640) {
                haptic(6);
                onClose();
              }
            }}
          >
            {/* Grabber */}
            <div className="flex justify-center pt-2 pb-1">
              <div
                style={{
                  width: 36,
                  height: 5,
                  borderRadius: 3,
                  background: 'var(--label-3)',
                }}
              />
            </div>

            {title && (
              <div className="hairline-b relative flex items-center justify-center px-3 pb-3 pt-1">
                <div className="absolute left-3 flex items-center">{leading}</div>
                <span className="t-headline truncate-1" style={{ maxWidth: '54%' }}>
                  {title}
                </span>
                <div className="absolute right-3 flex items-center">{trailing}</div>
              </div>
            )}

            <div className="ios-scroll" style={{ height: `calc(100% - ${title ? 76 : 30}px)` }}>
              {children}
            </div>

            {footer}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
