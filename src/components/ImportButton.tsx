import { useRef, useState } from 'react';
import { ArrowDownToLine, LoaderCircle } from 'lucide-react';
import { importAudio } from '../library/import';
import { useMusic } from '../storage/store';
export function ImportButton({
  className = 'button',
  children = 'Import music',
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={!!progress}
        onClick={() => input.current?.click()}
      >
        {progress ? <LoaderCircle size={17} className="spin" /> : <ArrowDownToLine size={17} />}
        <span>{progress || children}</span>
      </button>
      <input
        ref={input}
        type="file"
        className="sr-only"
        tabIndex={-1}
        multiple
        accept=".flac,.wav,.mp3,.m4a,.aac,.ogg,.opus,.aiff,audio/*"
        aria-label="Import audio files"
        onChange={async (event) => {
          const files = [...(event.target.files || [])];
          event.target.value = '';
          if (!files.length) return;
          setProgress('Reading your music…');
          try {
            const result = await importAudio(files, (done, total) =>
              setProgress(`${done} of ${total}`),
            );
            useMusic
              .getState()
              .notify(
                `${result.imported} ${result.imported === 1 ? 'track' : 'tracks'} imported${result.failures.length ? `. ${result.failures.length} failed: ${result.failures[0]}` : '. Original files, unchanged.'}`,
              );
          } catch (error) {
            useMusic
              .getState()
              .notify(
                error instanceof Error
                  ? error.message
                  : 'Import failed. Please check browser storage.',
              );
          } finally {
            setProgress(null);
          }
        }}
      />
    </>
  );
}
