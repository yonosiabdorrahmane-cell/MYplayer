import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';

import Icon from './Icon.jsx';
import { haptic } from '../lib/format.js';

const MenuContext = createContext(null);

export const useMenu = () => {
  const value = useContext(MenuContext);
  if (!value) throw new Error('useMenu must be used inside <MenuProvider>');
  return value;
};

const MENU_WIDTH = 254;
const EDGE = 12;

export function MenuProvider({ children }) {
  const [menu, setMenu] = useState(null);

  const open = useCallback((anchor, items, preview) => {
    if (!items?.length) return;
    haptic([12]);
    setMenu({ anchor, items, preview });
  }, []);

  const close = useCallback(() => setMenu(null), []);

  const value = useMemo(() => ({ open, close, isOpen: Boolean(menu) }), [close, menu, open]);

  return (
    <MenuContext.Provider value={value}>
      {children}
      {createPortal(<MenuOverlay menu={menu} onClose={close} />, document.body)}
    </MenuContext.Provider>
  );
}

function MenuOverlay({ menu, onClose }) {
  useEffect(() => {
    if (!menu) return undefined;
    const onKey = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu, onClose]);

  const items = menu?.items ?? [];
  const height = items.length * 45 + 8;
  const anchor = menu?.anchor;

  // Prefer opening below the anchor; flip above when there isn't room.
  const viewportH = typeof window === 'undefined' ? 800 : window.innerHeight;
  const viewportW = typeof window === 'undefined' ? 390 : window.innerWidth;

  const below = anchor ? viewportH - anchor.bottom > height + 24 : true;
  const top = anchor ? (below ? anchor.bottom + 8 : anchor.top - height - 8) : 0;
  const left = anchor
    ? Math.min(Math.max(anchor.left, EDGE), viewportW - MENU_WIDTH - EDGE)
    : EDGE;

  const originX = anchor ? Math.min(Math.max(anchor.left + 24 - left, 16), MENU_WIDTH - 16) : 0;

  return (
    <AnimatePresence>
      {menu && (
        <motion.div
          className="fixed inset-0 z-[90]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
          onPointerDown={onClose}
          style={{
            background: 'var(--scrim)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
          }}
        >
          <motion.div
            className="glass glass-thick absolute overflow-hidden"
            style={{
              top,
              left,
              width: MENU_WIDTH,
              borderRadius: 22,
              transformOrigin: `${originX}px ${below ? 0 : height}px`,
            }}
            initial={{ opacity: 0, scale: 0.76 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.86, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 560, damping: 30, mass: 0.8 }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {items.map((item, index) => (
              <button
                key={item.label}
                type="button"
                className="row-press flex w-full items-center justify-between px-4"
                style={{
                  height: 45,
                  color: item.destructive ? '#ff453a' : 'var(--label)',
                  boxShadow: index < items.length - 1 ? 'inset 0 -0.5px 0 var(--separator)' : 'none',
                }}
                onClick={() => {
                  haptic(6);
                  onClose();
                  // Let the dismissal animation start before the action re-renders.
                  requestAnimationFrame(() => item.onSelect?.());
                }}
              >
                <span className="t-body">{item.label}</span>
                {item.icon && <Icon name={item.icon} size={19} />}
              </button>
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Press-and-hold gesture. Cancels on scroll or drift so it never fires while
 * the user is flicking through a list.
 */
export function useLongPress(onTrigger, { delay = 460 } = {}) {
  const timerRef = useRef(null);
  const startRef = useRef(null);
  const firedRef = useRef(false);

  const cancel = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    startRef.current = null;
  }, []);

  const onPointerDown = useCallback(
    (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      firedRef.current = false;
      startRef.current = { x: event.clientX, y: event.clientY };
      const target = event.currentTarget;
      timerRef.current = setTimeout(() => {
        firedRef.current = true;
        onTrigger(target.getBoundingClientRect(), target);
      }, delay);
    },
    [delay, onTrigger],
  );

  const onPointerMove = useCallback(
    (event) => {
      const start = startRef.current;
      if (!start) return;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) cancel();
    },
    [cancel],
  );

  const onClickCapture = useCallback((event) => {
    // Swallow the click that follows a successful long press.
    if (firedRef.current) {
      event.preventDefault();
      event.stopPropagation();
      firedRef.current = false;
    }
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu: (event) => event.preventDefault(),
    onClickCapture,
  };
}
