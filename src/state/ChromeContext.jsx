import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ChromeContext = createContext({ collapsed: false, reportScroll: () => {} });

export const useChrome = () => useContext(ChromeContext);

/**
 * Tracks whether the floating chrome should pull in to its compact form.
 *
 * Scrolling down past the top of a list shrinks the tab bar to icons so more of
 * the content shows through the glass; any upward scroll brings it back. A
 * small threshold keeps it from twitching on scroll jitter.
 */
export function ChromeProvider({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const lastRef = useRef(0);

  const reportScroll = useCallback((scrollTop) => {
    const previous = lastRef.current;
    const delta = scrollTop - previous;

    if (Math.abs(delta) < 6) return;
    lastRef.current = scrollTop;

    if (scrollTop < 40) setCollapsed(false);
    else if (delta > 0) setCollapsed(true);
    else setCollapsed(false);
  }, []);

  const value = useMemo(() => ({ collapsed, reportScroll }), [collapsed, reportScroll]);

  return <ChromeContext.Provider value={value}>{children}</ChromeContext.Provider>;
}
