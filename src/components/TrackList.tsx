import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Play,
  MoreHorizontal,
  Heart,
  ListPlus,
  Disc3,
  UserRound,
  Info,
  Plus,
  ListEnd,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMusic } from '../storage/store';
import type { Track } from '../types';
import { albumKey, quality, resolution, time } from '../utils/format';
import { Artwork, IconButton, Modal } from './ui';

export function AudioDetails({ track, onClose }: { track: Track; onClose: () => void }) {
  return (
    <Modal title="Audio details" onClose={onClose}>
      <div className="details-track">
        <Artwork src={track.artworkUrl} alt="" />
        <div>
          <h3>{track.title}</h3>
          <p>{track.artist}</p>
        </div>
      </div>
      <div className="detail-list">
        {[
          ['Source codec', track.codec || 'Not configured'],
          ['Source resolution', resolution(track.bitDepth, track.sampleRate)],
          [
            'Channels',
            track.channels === 2
              ? 'Stereo · 2 channels'
              : track.channels?.toString() || 'Not available',
          ],
          ['Bitrate', track.bitrate ? `${Math.round(track.bitrate / 1000)} kbps` : 'Not available'],
          [
            'File size',
            track.fileSize ? `${(track.fileSize / 1024 / 1024).toFixed(1)} MB` : 'Not available',
          ],
          ['Duration', track.duration ? time(track.duration) : 'Not available'],
          ['Playback', 'Native browser decoder'],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <p className="fine-print">
        These details describe the source file. Your browser, operating system and audio device
        determine the output format. Bit-perfect output is not guaranteed.
      </p>
    </Modal>
  );
}
export function TrackMenu({ track, onClose }: { track: Track; onClose: () => void }) {
  const navigate = useNavigate();
  const state = useMusic();
  const [page, setPage] = useState<'menu' | 'playlists' | 'credits'>('menu');
  const [name, setName] = useState('');
  const finish = (action: () => void) => {
    action();
    onClose();
  };
  const goTo = (path: string) => {
    useMusic.setState({ playerOpen: false, queueOpen: false });
    navigate(path);
  };
  return (
    <Modal
      title={
        page === 'playlists'
          ? 'Add to playlist'
          : page === 'credits'
            ? 'Track credits'
            : track.title
      }
      onClose={onClose}
      className="context-dialog"
    >
      {page === 'menu' ? (
        <div className="menu-list">
          <button onClick={() => finish(() => state.enqueue(track.id, true))}>
            <ListPlus />
            Play Next
          </button>
          <button onClick={() => finish(() => state.enqueue(track.id))}>
            <ListEnd />
            Play Last
          </button>
          <button
            className={state.favorites.includes(track.id) ? 'favorite' : ''}
            onClick={() => finish(() => state.favorite(track.id))}
          >
            <Heart fill={state.favorites.includes(track.id) ? 'currentColor' : 'none'} />
            {state.favorites.includes(track.id) ? 'Remove from Favorites' : 'Favorite'}
          </button>
          <button onClick={() => setPage('playlists')}>
            <Plus />
            Add to Playlist
          </button>
          <hr />
          <button
            onClick={() => finish(() => goTo(`/album/${encodeURIComponent(albumKey(track))}`))}
          >
            <Disc3 />
            Go to Album
          </button>
          <button onClick={() => finish(() => goTo(`/artist/${encodeURIComponent(track.artist)}`))}>
            <UserRound />
            Go to Artist
          </button>
          <button onClick={() => setPage('credits')}>
            <Info />
            View Credits
          </button>
        </div>
      ) : page === 'credits' ? (
        <div className="detail-list">
          <div>
            <span>Title</span>
            <strong>{track.title}</strong>
          </div>
          <div>
            <span>Artist</span>
            <strong>{track.artist}</strong>
          </div>
          <div>
            <span>Album artist</span>
            <strong>{track.albumArtist || track.artist}</strong>
          </div>
          <div>
            <span>Album</span>
            <strong>{track.album}</strong>
          </div>
          <div>
            <span>Year</span>
            <strong>{track.year || 'Unknown'}</strong>
          </div>
          <p className="fine-print">
            Only metadata provided by your file or library is shown. Composer and production credits
            have not been supplied.
          </p>
        </div>
      ) : (
        <div className="menu-list">
          {state.playlists.map((playlist) => (
            <button
              key={playlist.id}
              onClick={() => finish(() => state.addToPlaylist(playlist.id, track.id))}
            >
              <ListPlus />
              {playlist.name}
            </button>
          ))}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (name.trim()) finish(() => state.addPlaylist(name, track.id));
            }}
          >
            <label className="field-label" htmlFor="playlist-name">
              New playlist
            </label>
            <input
              id="playlist-name"
              placeholder="Give it a name"
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <button className="button primary" disabled={!name.trim()}>
              Create playlist
            </button>
          </form>
        </div>
      )}
    </Modal>
  );
}
export function TrackList({
  tracks,
  compact = false,
  numbered = false,
}: {
  tracks: Track[];
  compact?: boolean;
  numbered?: boolean;
}) {
  const currentId = useMusic((state) => state.currentId);
  const status = useMusic((state) => state.status);
  const favorites = useMusic((state) => state.favorites);
  const [menu, setMenu] = useState<Track | null>(null);
  const [details, setDetails] = useState<Track | null>(null);
  return (
    <>
      <div className={`track-list ${compact ? 'compact' : ''}`} role="list" aria-label="Songs">
        {!compact && (
          <div className="track-table-head" aria-hidden="true">
            <span>SONG</span>
            <span>ALBUM</span>
            <span>QUALITY</span>
            <span>TIME</span>
          </div>
        )}
        {tracks.map((track, index) => (
          <div
            className={`track-row ${currentId === track.id ? 'is-current' : ''}`}
            role="listitem"
            key={track.id}
          >
            <button
              className="track-main"
              onClick={() =>
                useMusic.getState().play(
                  track.id,
                  tracks.map((item) => item.id),
                )
              }
              aria-label={`Play ${track.title} by ${track.artist}`}
            >
              {numbered ? (
                <span className="track-number">
                  {currentId === track.id && status === 'playing' ? (
                    <span className="equalizer">
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : (
                    <>
                      <span>{index + 1}</span>
                      <Play size={15} fill="currentColor" />
                    </>
                  )}
                </span>
              ) : (
                <span className="row-artwork">
                  <Artwork src={track.artworkUrl} alt="" />
                  <span className="row-play">
                    <Play size={16} fill="currentColor" />
                  </span>
                </span>
              )}
              <span className="track-copy">
                <strong>{track.title}</strong>
                <span>{track.artist}</span>
              </span>
            </button>
            {!compact && <span className="track-album">{track.album}</span>}
            {!compact && (
              <button className="quality-tag" onClick={() => setDetails(track)}>
                {quality(track)}
              </button>
            )}
            <span className="track-time">{track.duration ? time(track.duration) : '—'}</span>
            <IconButton
              label={`${favorites.includes(track.id) ? 'Unfavorite' : 'Favorite'} ${track.title}`}
              className={`row-favorite ${favorites.includes(track.id) ? 'favorite' : ''}`}
              onClick={() => useMusic.getState().favorite(track.id)}
            >
              <Heart size={16} fill={favorites.includes(track.id) ? 'currentColor' : 'none'} />
            </IconButton>
            <IconButton
              label={`More for ${track.title}`}
              className="row-more"
              onClick={() => setMenu(track)}
            >
              <MoreHorizontal size={20} />
            </IconButton>
          </div>
        ))}
      </div>
      <AnimatePresence>
        {menu && <TrackMenu track={menu} onClose={() => setMenu(null)} />}
        {details && <AudioDetails track={details} onClose={() => setDetails(null)} />}
      </AnimatePresence>
    </>
  );
}
