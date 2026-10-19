import { useRef } from 'react';

import { useLibrary } from '../state/LibraryContext.jsx';
import { haptic } from '../lib/format.js';

/**
 * Wraps the file picker. `webkitdirectory` lets a whole music folder come in at
 * once, which is how most personal libraries are actually organised.
 */
export default function ImportButton({ children, folder = false, className = '', style }) {
  const inputRef = useRef(null);
  const { importFiles } = useLibrary();

  return (
    <>
      <button
        type="button"
        className={className}
        style={style}
        onClick={() => {
          haptic(6);
          inputRef.current?.click();
        }}
      >
        {children}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.mp3,.m4a,.flac,.wav,.aac,.ogg,.opus"
        multiple
        {...(folder ? { webkitdirectory: '', directory: '' } : {})}
        hidden
        onChange={(event) => {
          const { files } = event.target;
          if (files?.length) importFiles(files);
          // Reset so picking the same folder twice still fires a change event.
          event.target.value = '';
        }}
      />
    </>
  );
}
