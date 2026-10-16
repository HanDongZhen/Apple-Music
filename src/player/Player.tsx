import { useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown,
  ChevronDown,
  Heart,
  ListMusic,
  Maximize2,
  MessageSquareText,
  MoreHorizontal,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  LoaderCircle,
  ArrowUp,
  X,
  GripVertical,
} from 'lucide-react';
import { useMusic } from '../storage/store';
import { time, quality } from '../utils/format';
import { Glass } from '../glass/Glass';
import { usePalette } from '../glass/palette';
import { Artwork, EmptyState, IconButton, Modal } from '../components/ui';
import { AudioDetails, TrackMenu } from '../components/TrackList';
import { LyricsView } from '../lyrics/LyricsView';
import { spring } from '../motion/tokens';

function Transport({ large = false }: { large?: boolean }) {
  const state = useMusic();
  const busy = state.status === 'loading' || state.status === 'buffering';
  return (
    <div className={`transport ${large ? 'large' : ''}`}>
      <IconButton
        className={`secondary-control ${state.shuffle ? 'selected' : ''}`}
        label="Shuffle"
        aria-pressed={state.shuffle}
        onClick={() => useMusic.setState({ shuffle: !state.shuffle })}
      >
        <Shuffle size={large ? 21 : 16} />
      </IconButton>
      <IconButton label="Previous track" onClick={state.previous}>
        <SkipBack size={large ? 30 : 20} fill="currentColor" />
      </IconButton>
      <IconButton
        className="play-button"
        label={state.desiredPlaying ? 'Pause' : 'Play'}
        onClick={state.toggle}
      >
        {busy ? (
          <LoaderCircle className="spin" size={large ? 34 : 25} />
        ) : state.desiredPlaying ? (
          <Pause size={large ? 39 : 27} fill="currentColor" />
        ) : (
          <Play size={large ? 39 : 27} fill="currentColor" />
        )}
      </IconButton>
      <IconButton
        label="Next track"
        onClick={() => state.next()}
        disabled={!state.queue.length && state.repeat !== 'all'}
      >
        <SkipForward size={large ? 30 : 20} fill="currentColor" />
      </IconButton>
      <IconButton
        className={`secondary-control ${state.repeat !== 'off' ? 'selected' : ''}`}
        label={`Repeat: ${state.repeat}`}
        aria-pressed={state.repeat !== 'off'}
        onClick={() =>
          useMusic.setState({
            repeat: state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off',
          })
        }
      >
        {state.repeat === 'one' ? (
          <Repeat1 size={large ? 21 : 16} />
        ) : (
          <Repeat size={large ? 21 : 16} />
        )}
      </IconButton>
    </div>
  );
}
function Progress({ compact = false }: { compact?: boolean }) {
  const position = useMusic((state) => state.position);
  const duration = useMusic((state) => state.duration);
  const buffered = useMusic((state) => state.buffered);
  return (
    <div className={`progress-control ${compact ? 'compact' : ''}`}>
      <input
        aria-label="Playback position"
        type="range"
        min={0}
        max={duration || 1}
        step={0.1}
        value={Math.min(position, duration || 1)}
        disabled={!duration}
        onChange={(event) => useMusic.getState().seek(Number(event.target.value))}
        style={
          {
            '--played': `${duration ? (position / duration) * 100 : 0}%`,
            '--buffered': `${duration ? (buffered / duration) * 100 : 0}%`,
          } as CSSProperties
        }
      />
      <div className="progress-labels">
        <span>{time(position)}</span>
        <span>{duration ? `−${time(duration - position)}` : '—:—'}</span>
      </div>
    </div>
  );
}
function Volume({ expanded = false }: { expanded?: boolean }) {
  const volume = useMusic((state) => state.volume);
  const [beforeMute, setBeforeMute] = useState(0.75);
  return (
    <div className={`volume-control ${expanded ? 'expanded' : ''}`}>
      <IconButton
        label={volume ? 'Mute' : 'Unmute'}
        onClick={() => {
          if (volume) {
            setBeforeMute(volume);
            useMusic.getState().setVolume(0);
          } else useMusic.getState().setVolume(beforeMute);
        }}
      >
        {volume ? <Volume2 size={17} /> : <VolumeX size={17} />}
      </IconButton>
      <input
        type="range"
        aria-label="Volume"
        min="0"
        max="1"
        step="0.01"
        value={volume}
        onChange={(event) => useMusic.getState().setVolume(Number(event.target.value))}
        style={{ '--played': `${volume * 100}%` } as CSSProperties}
      />
      {expanded && <Volume2 size={19} />}
    </div>
  );
}
export function MiniPlayer() {
  const currentId = useMusic((state) => state.currentId);
  const track = useMusic((state) => state.tracks.find((item) => item.id === currentId));
  const playerOpen = useMusic((state) => state.playerOpen);
  const queueOpen = useMusic((state) => state.queueOpen);
  const favorites = useMusic((state) => state.favorites);
  if (!track) return null;
  return (
    <motion.div
      className={`mini-player-wrap ${playerOpen ? 'player-is-open' : ''}`}
      initial={{ y: 25, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={spring.sheet}
    >
      <Glass material="mini-player" className="mini-player">
        <button
          className="mini-track"
          aria-label="Open Now Playing"
          onClick={() => useMusic.setState({ playerOpen: true })}
        >
          <Artwork layoutId="playing-artwork" src={track.artworkUrl} alt="" />
          <span>
            <strong>{track.title}</strong>
            <span>{track.artist}</span>
          </span>
        </button>
        <IconButton
          label="Favorite current track"
          className={`mini-favorite ${favorites.includes(track.id) ? 'favorite' : ''}`}
          onClick={() => useMusic.getState().favorite(track.id)}
        >
          <Heart size={19} fill={favorites.includes(track.id) ? 'currentColor' : 'none'} />
        </IconButton>
        <div className="mini-center">
          <Transport />
          <Progress compact />
        </div>
        <div className="mini-right">
          <span className="mini-quality">{track.demo ? 'PREVIEW' : quality(track)}</span>
          <Volume />
          <IconButton
            label="Open lyrics"
            onClick={() => useMusic.setState({ playerOpen: true, lyricsOpen: true })}
          >
            <MessageSquareText size={19} />
          </IconButton>
          <IconButton
            label="Open queue"
            className={queueOpen ? 'selected' : ''}
            onClick={() => useMusic.setState({ queueOpen: !queueOpen })}
          >
            <ListMusic size={20} />
          </IconButton>
          <IconButton
            className="mini-expand"
            label="Expand player"
            onClick={() => useMusic.setState({ playerOpen: true })}
          >
            <Maximize2 size={17} />
          </IconButton>
        </div>
      </Glass>
    </motion.div>
  );
}

export function FullPlayer() {
  const state = useMusic();
  const track = state.tracks.find((item) => item.id === state.currentId);
  const palette = usePalette(track?.artworkUrl);
  const [details, setDetails] = useState(false);
  const [menu, setMenu] = useState(false);
  const [artwork, setArtwork] = useState(false);
  if (!track) return null;
  const favorite = state.favorites.includes(track.id);
  return (
    <>
      <Modal
        title="Now Playing"
        className="full-player-layer"
        onClose={() => useMusic.setState({ playerOpen: false })}
      >
        <div
          className="full-player"
          style={
            {
              '--ambient-1': palette.dominant,
              '--ambient-2': palette.secondary,
              '--ambient-warm': palette.warm,
              '--ambient-cool': palette.cool,
              '--ambient-shadow': palette.shadow,
            } as CSSProperties
          }
        >
          <div className="ambient-field">
            <i />
            <i />
            <i />
          </div>
          <div className="player-grain" />
          <div className="player-topbar">
            <IconButton
              label="Minimize player"
              onClick={() => useMusic.setState({ playerOpen: false })}
            >
              <ChevronDown size={25} />
            </IconButton>
            <div>
              <span>PLAYING FROM YOUR LIBRARY</span>
              <strong>{track.album}</strong>
            </div>
            <IconButton label="Track options" onClick={() => setMenu(true)}>
              <MoreHorizontal size={24} />
            </IconButton>
          </div>
          <div className={`full-player-inner ${state.lyricsOpen ? 'with-lyrics' : ''}`}>
            <div className="player-main">
              <motion.button
                className={`player-artwork-button ${state.status === 'playing' ? 'is-playing' : ''}`}
                aria-label="View full-screen artwork"
                onClick={() => setArtwork(true)}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={0.08}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 90 || info.velocity.y > 500)
                    useMusic.setState({ playerOpen: false });
                }}
              >
                <Artwork
                  layoutId="playing-artwork"
                  src={track.artworkUrl}
                  alt={`${track.album} artwork`}
                />
              </motion.button>
              <div className="player-track-info">
                <div>
                  <h2>{track.title}</h2>
                  <p>{track.artist}</p>
                </div>
                <IconButton
                  label="Favorite playing song"
                  className={favorite ? 'favorite' : ''}
                  onClick={() => state.favorite(track.id)}
                >
                  <Heart size={24} fill={favorite ? 'currentColor' : 'none'} />
                </IconButton>
              </div>
              <button className="player-quality" onClick={() => setDetails(true)}>
                <span>≋</span>
                {quality(track)}
                <span className="source-label">SOURCE</span>
              </button>
              <Progress />
              <Transport large />
              <Volume expanded />
              <div className="player-bottom-controls">
                <IconButton
                  label="Toggle lyrics"
                  aria-pressed={state.lyricsOpen}
                  className={state.lyricsOpen ? 'selected' : ''}
                  onClick={() => useMusic.setState({ lyricsOpen: !state.lyricsOpen })}
                >
                  <MessageSquareText size={22} />
                </IconButton>
                <span>
                  {state.status === 'buffering'
                    ? 'Buffering…'
                    : state.status === 'loading'
                      ? 'Loading audio…'
                      : track.demo
                        ? 'Demo preview · no audio attached'
                        : 'Original sound. Personal space.'}
                </span>
                <IconButton
                  label="Show Playing Next"
                  aria-pressed={state.queueOpen}
                  onClick={() => useMusic.setState({ queueOpen: !state.queueOpen })}
                >
                  <ListMusic size={23} />
                </IconButton>
              </div>
              {state.error && (
                <div className="playback-error" role="status">
                  <p>{state.error}</p>
                  {track.audioUrl && <button onClick={state.toggle}>Retry playback</button>}
                </div>
              )}
            </div>
            <AnimatePresence mode="wait">
              {state.lyricsOpen && (
                <motion.div
                  key="lyrics"
                  className="lyrics-column"
                  initial={{ opacity: 0, x: 24, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, x: 16, filter: 'blur(8px)' }}
                  transition={spring.soft}
                >
                  <LyricsView track={track} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Modal>
      <AnimatePresence>
        {details && <AudioDetails track={track} onClose={() => setDetails(false)} />}
        {menu && <TrackMenu track={track} onClose={() => setMenu(false)} />}
        {artwork && (
          <Modal title="Artwork" className="artwork-dialog" onClose={() => setArtwork(false)}>
            <Artwork
              layoutId="playing-artwork"
              src={track.artworkUrl}
              alt={`${track.album} artwork`}
            />
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}

export function QueuePanel() {
  const state = useMusic();
  const [dragged, setDragged] = useState<number | null>(null);
  const current = state.tracks.find((track) => track.id === state.currentId);
  return (
    <Modal
      title="Playing Next"
      className="queue-dialog"
      onClose={() => useMusic.setState({ queueOpen: false })}
    >
      {current && (
        <>
          <span className="eyebrow">NOW PLAYING</span>
          <div className="queue-current">
            <Artwork src={current.artworkUrl} alt="" />
            <div>
              <h3>{current.title}</h3>
              <p>{current.artist}</p>
            </div>
            <span className={`equalizer ${state.status !== 'playing' ? 'paused' : ''}`}>
              <i />
              <i />
              <i />
            </span>
          </div>
        </>
      )}
      <div className="queue-subheading">
        <h3>
          Up next <span>· {state.queue.length}</span>
        </h3>
        {state.queue.length > 0 && (
          <button className="text-link" onClick={() => useMusic.setState({ queue: [] })}>
            Clear
          </button>
        )}
      </div>
      {state.queue.length ? (
        <ol className="queue-list">
          {state.queue.map((entry, index) => {
            const track = state.tracks.find((item) => item.id === entry.trackId);
            if (!track) return null;
            return (
              <li
                key={entry.id}
                draggable
                onDragStart={(event) => {
                  setDragged(index);
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragged !== null) state.reorderQueue(dragged, index);
                  setDragged(null);
                }}
                onDragEnd={() => setDragged(null)}
                className={dragged === index ? 'is-dragged' : ''}
              >
                <GripVertical size={16} className="drag-handle" />
                <button
                  className="queue-song"
                  aria-label={`Play queued ${track.title}`}
                  onClick={() =>
                    useMusic.setState({
                      currentId: track.id,
                      position: 0,
                      duration: 0,
                      desiredPlaying: true,
                      request: state.request + 1,
                      queue: state.queue.slice(index + 1),
                      backStack: state.currentId
                        ? [...state.backStack, state.currentId]
                        : state.backStack,
                    })
                  }
                >
                  <Artwork src={track.artworkUrl} alt="" />
                  <span>
                    <strong>{track.title}</strong>
                    <span>{track.artist}</span>
                  </span>
                </button>
                <div className="queue-reorder">
                  <IconButton
                    label={`Move ${track.title} up`}
                    disabled={index === 0}
                    onClick={() => state.reorderQueue(index, index - 1)}
                  >
                    <ArrowUp size={13} />
                  </IconButton>
                  <IconButton
                    label={`Move ${track.title} down`}
                    disabled={index === state.queue.length - 1}
                    onClick={() => state.reorderQueue(index, index + 1)}
                  >
                    <ArrowDown size={13} />
                  </IconButton>
                </div>
                <IconButton
                  label={`Remove ${track.title} from queue`}
                  onClick={() => state.removeQueue(entry.id)}
                >
                  <X size={16} />
                </IconButton>
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyState
          title="Room for one more song"
          detail="Use a song’s menu to play it next or add it to the end of your queue."
        />
      )}
      <p className="fine-print">Drag to reorder, or use the arrow buttons.</p>
    </Modal>
  );
}
