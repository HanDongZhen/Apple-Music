import { useMemo, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpRight,
  ChevronRight,
  Disc3,
  Heart,
  Play,
  Plus,
  Radio,
  Search,
  Shuffle,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useMusic } from '../storage/store';
import { albumsOf, searchTracks } from '../library/catalog';
import { albumKey, quality, time } from '../utils/format';
import type { Track } from '../types';
import { Artwork, EmptyState, IconButton, Modal } from '../components/ui';
import { AudioDetails, TrackList, TrackMenu } from '../components/TrackList';
import { ImportButton } from '../components/ImportButton';
import { usePalette } from '../glass/palette';
import { Glass } from '../glass/Glass';

function SectionTitle({ title, to, caption }: { title: string; to?: string; caption?: string }) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {caption && <p>{caption}</p>}
      </div>
      {to && (
        <Link className="text-link" to={to}>
          View all <ChevronRight size={15} />
        </Link>
      )}
    </div>
  );
}
export function AlbumGrid({ tracks, limited = false }: { tracks: Track[]; limited?: boolean }) {
  const albums = albumsOf(tracks);
  return (
    <div className={`album-grid ${limited ? 'home-albums' : ''}`}>
      {(limited ? albums.slice(0, 6) : albums).map((album) => (
        <article key={album.id} className="album-card">
          <Link to={`/album/${encodeURIComponent(album.id)}`} className="album-cover-link">
            <Artwork
              layoutId={`album-${album.id}`}
              src={album.artwork}
              alt={`${album.title} artwork`}
            />
            <span className="cover-arrow">
              <ArrowUpRight size={19} />
            </span>
          </Link>
          <Link to={`/album/${encodeURIComponent(album.id)}`} className="album-title">
            {album.title}
          </Link>
          <Link to={`/artist/${encodeURIComponent(album.artist)}`} className="album-artist">
            {album.artist}
          </Link>
        </article>
      ))}
    </div>
  );
}
export function HomePage() {
  const tracks = useMusic((state) => state.tracks);
  const favorites = useMusic((state) => state.favorites);
  const history = useMusic((state) => state.history);
  const demo = tracks.every((track) => track.demo);
  const recent = tracks
    .filter((track) => history[track.id])
    .sort((a, b) => history[b.id].lastPlayed - history[a.id].lastPlayed);
  const loved = tracks.filter((track) => favorites.includes(track.id));
  const mostPlayed = tracks
    .filter((track) => history[track.id])
    .sort((a, b) => history[b.id].count - history[a.id].count)
    .slice(0, 5);
  return (
    <div className="page home-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">YOUR MUSIC. YOUR MOMENT.</p>
          <h1>
            Home<span className="heading-dot">.</span>
          </h1>
        </div>
        <span className="home-greeting">A little closer to the music.</span>
      </header>
      <section className="home-hero" aria-label="Your private collection">
        <img className="hero-landscape" src="/artwork/quiet-hours.svg" alt="" />
        <div className="hero-shade" />
        <div className="hero-content">
          <span className="hero-kicker">
            <span />
            YOUR PERSONAL SOUNDTRACK
          </span>
          <h2>
            Less noise.
            <br />
            More music.
          </h2>
          <p>
            A familiar song. A little room to breathe.
            <br />
            Rediscover the music that feels like you.
          </p>
          <div className="hero-actions">
            <Link className="button hero-button" to="/albums">
              <Play size={16} fill="currentColor" />
              Explore your collection
            </Link>
            <span className="hero-note">Always yours.</span>
          </div>
        </div>
        <span className="hero-caption">
          THE QUIET HOURS COLLECTION <span>01 — ∞</span>
        </span>
      </section>
      {demo && (
        <div className="demo-notice">
          <span className="demo-dot" />
          <p>
            <strong>A glimpse of your next listening space.</strong> These 6 previews have no audio
            attached.
          </p>
          <ImportButton className="inline-import" />
        </div>
      )}
      <section>
        <SectionTitle
          title={demo ? 'A place for your favorites' : 'Recently added'}
          to="/albums"
          caption={
            demo
              ? 'A few familiar names. Your own collection comes next.'
              : 'The newest additions to your listening world.'
          }
        />
        <AlbumGrid
          tracks={demo ? tracks : [...tracks].sort((a, b) => b.addedAt - a.addedAt)}
          limited
        />
      </section>
      <div className="home-bottom-grid">
        <section>
          <SectionTitle
            title={recent.length ? 'Back in rotation' : demo ? 'Familiar favorites' : 'Your songs'}
            to={recent.length ? '/recent' : '/songs'}
            caption={
              recent.length
                ? 'Pick up where you left off.'
                : demo
                  ? 'Metadata previews · original artwork studies'
                  : 'Every track has a place here.'
            }
          />
          <TrackList tracks={(recent.length ? recent : tracks).slice(0, 4)} compact />
        </section>
        <section className="listening-card">
          <span className="small-kicker">A SPACE OF YOUR OWN</span>
          <div className="record-illustration">
            <div />
            <Disc3 size={40} strokeWidth={0.8} />
          </div>
          <h3>
            Every detail.
            <br />
            Every feeling.
          </h3>
          <p>
            Your original files, beautifully at home.
            <br />
            FLAC, WAV, MP3 and M4A.
          </p>
          <Link to="/settings" className="text-link">
            Make yourself at home <ArrowUpRight size={15} />
          </Link>
        </section>
      </div>
      {loved.length > 0 && (
        <section>
          <SectionTitle title="Loved by you" to="/favorites" />
          <TrackList tracks={loved.slice(0, 4)} />
        </section>
      )}
      {mostPlayed.length > 0 && (
        <section>
          <SectionTitle title="Most played" caption="The songs you keep coming back to." />
          <TrackList tracks={mostPlayed} compact />
        </section>
      )}
      <footer className="page-footer">
        <span className="brand-small">Mr Han Music</span>
        <span>Music, on your terms.</span>
        <span>Your private listening space</span>
      </footer>
    </div>
  );
}

export function LibraryPage({ view = 'songs' }: { view?: string }) {
  const tracks = useMusic((state) => state.tracks);
  const favorites = useMusic((state) => state.favorites);
  const history = useMusic((state) => state.history);
  const playlists = useMusic((state) => state.playlists);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('added');
  const [filter, setFilter] = useState('all');
  const [create, setCreate] = useState(false);
  const [name, setName] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const base =
    view === 'favorites'
      ? tracks.filter((track) => favorites.includes(track.id))
      : view === 'recent'
        ? tracks.filter((track) => history[track.id])
        : selectedPlaylist
          ? tracks.filter((track) =>
              playlists
                .find((playlist) => playlist.id === selectedPlaylist)
                ?.trackIds.includes(track.id),
            )
          : tracks;
  const filtered = useMemo(
    () =>
      searchTracks(base, query)
        .filter((track) => filter !== 'lossless' || /Lossless/.test(quality(track)))
        .sort((a, b) =>
          view === 'recent'
            ? history[b.id].lastPlayed - history[a.id].lastPlayed
            : sort === 'title'
              ? a.title.localeCompare(b.title, 'zh')
              : sort === 'artist'
                ? a.artist.localeCompare(b.artist, 'zh')
                : b.addedAt - a.addedAt,
        ),
    [base, query, sort, filter, view, history],
  );
  const title =
    {
      songs: 'Songs',
      albums: 'Albums',
      artists: 'Artists',
      playlists: 'Playlists',
      favorites: 'Favorites',
      recent: 'Recently played',
      new: 'Recently added',
    }[view] || 'Library';
  return (
    <div className="page library-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">YOUR COLLECTION</p>
          <h1>{title}</h1>
          <p className="page-subtitle">
            {tracks.some((track) => track.demo)
              ? 'Demo library · Import your files to make it yours.'
              : `${tracks.length} songs. Entirely your own.`}
          </p>
        </div>
        <ImportButton />
      </header>
      <nav className="library-tabs" aria-label="Library categories">
        {[
          ['songs', 'Songs'],
          ['albums', 'Albums'],
          ['artists', 'Artists'],
          ['playlists', 'Playlists'],
        ].map(([key, label]) => (
          <Link key={key} className={view === key ? 'active' : ''} to={`/${key}`}>
            {label}
          </Link>
        ))}
      </nav>
      <div className="library-toolbar">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Filter library"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find something you love"
          />
          {query && (
            <IconButton label="Clear filter" onClick={() => setQuery('')}>
              <X size={15} />
            </IconButton>
          )}
        </label>
        <div className="sort-controls">
          <label>
            <span className="sr-only">Filter quality</span>
            <select
              aria-label="Filter quality"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="all">All audio</option>
              <option value="lossless">Lossless</option>
            </select>
          </label>
          <SlidersHorizontal size={16} />
          <select
            aria-label="Sort songs"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="added">Recently added</option>
            <option value="title">Title</option>
            <option value="artist">Artist</option>
          </select>
        </div>
      </div>
      {view === 'playlists' && !selectedPlaylist ? (
        <>
          <div className="playlist-grid">
            <button className="new-playlist" onClick={() => setCreate(true)}>
              <Plus size={30} />
              <span>New playlist</span>
            </button>
            {playlists.map((playlist) => (
              <button
                className="playlist-card"
                key={playlist.id}
                onClick={() => setSelectedPlaylist(playlist.id)}
              >
                <Artwork
                  src={tracks.find((track) => playlist.trackIds.includes(track.id))?.artworkUrl}
                  alt=""
                />
                <strong>{playlist.name}</strong>
                <span>{playlist.trackIds.length} songs</span>
              </button>
            ))}
          </div>
        </>
      ) : filtered.length ? (
        view === 'albums' ? (
          <AlbumGrid tracks={filtered} />
        ) : view === 'artists' ? (
          <div className="artist-grid">
            {[...new Set(filtered.map((track) => track.artist))].map((artist) => (
              <Link
                to={`/artist/${encodeURIComponent(artist)}`}
                key={artist}
                className="artist-card"
              >
                <Artwork
                  src={filtered.find((track) => track.artist === artist)?.artworkUrl}
                  alt=""
                />
                <h3>{artist}</h3>
                <span>{filtered.filter((track) => track.artist === artist).length} songs</span>
              </Link>
            ))}
          </div>
        ) : (
          <>
            {selectedPlaylist && (
              <div className="section-title">
                <h2>{playlists.find((playlist) => playlist.id === selectedPlaylist)?.name}</h2>
                <button className="text-link" onClick={() => setSelectedPlaylist(null)}>
                  All playlists
                </button>
              </div>
            )}
            <TrackList tracks={filtered} />
          </>
        )
      ) : (
        <EmptyState
          title={
            view === 'favorites'
              ? 'Keep your favorites close'
              : view === 'recent'
                ? 'Your listening story starts here'
                : 'Nothing here just yet'
          }
          detail={
            view === 'favorites'
              ? 'Tap a heart on a song to find it here.'
              : view === 'recent'
                ? 'Play your imported music and your recent listening will appear here.'
                : 'Try a different search, or import a few songs.'
          }
          action={<ImportButton />}
        />
      )}
      {view === 'favorites' && (
        <div className="favorite-entities">
          {albumsOf(tracks).filter((album) => favorites.includes(`album:${album.id}`)).length >
            0 && (
            <>
              <SectionTitle title="Favorite albums" />
              <AlbumGrid
                tracks={tracks.filter((track) => favorites.includes(`album:${albumKey(track)}`))}
              />
            </>
          )}
          {[...new Set(tracks.map((track) => track.artist))]
            .filter((artist) => favorites.includes(`artist:${artist}`))
            .map((artist) => (
              <Link
                className="favorite-artist-link"
                to={`/artist/${encodeURIComponent(artist)}`}
                key={artist}
              >
                <Heart size={16} />
                {artist}
              </Link>
            ))}
        </div>
      )}
      <AnimatePresence>
        {create && (
          <Modal title="New playlist" onClose={() => setCreate(false)}>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (name.trim()) {
                  useMusic.getState().addPlaylist(name);
                  setCreate(false);
                  setName('');
                }
              }}
            >
              <label className="field-label" htmlFor="new-playlist-name">
                Playlist name
              </label>
              <input
                id="new-playlist-name"
                value={name}
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
                placeholder="Songs for a slow Sunday"
              />
              <button className="button primary" disabled={!name.trim()}>
                Create playlist
              </button>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SearchPage() {
  const [query, setQuery] = useState('');
  const tracks = useMusic((state) => state.tracks);
  const results = searchTracks(tracks, query);
  const artists = [...new Set(results.map((track) => track.artist))];
  return (
    <div className="page search-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">SOMETHING ON YOUR MIND?</p>
          <h1>Search</h1>
        </div>
      </header>
      <Glass material="search" className="big-search">
        <Search size={23} />
        <input
          autoFocus
          aria-label="Search songs, artists and albums"
          placeholder="Songs, artists, albums"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query && (
          <IconButton label="Clear search" onClick={() => setQuery('')}>
            <X size={20} />
          </IconButton>
        )}
        <kbd>⌘ K</kbd>
      </Glass>
      {!query ? (
        <>
          <SectionTitle
            title="Find your next moment"
            caption="Search your collection in English or 中文."
          />
          <div className="browse-cards">
            <Link to="/favorites" className="browse-card rose">
              <Heart size={37} strokeWidth={1.2} />
              <h2>Your favorites</h2>
              <ArrowUpRight />
            </Link>
            <Link to="/recent" className="browse-card blue">
              <Disc3 size={40} strokeWidth={1.1} />
              <h2>Recently played</h2>
              <ArrowUpRight />
            </Link>
          </div>
        </>
      ) : results.length ? (
        <>
          <SectionTitle
            title="Songs"
            caption={`${results.length} ${results.length === 1 ? 'match' : 'matches'} in your library`}
          />
          <TrackList tracks={results} />
          <SectionTitle title="Albums" />
          <AlbumGrid tracks={results} limited />
          <SectionTitle title="Artists" />
          <div className="search-artists">
            {artists.map((artist) => (
              <Link className="button" to={`/artist/${encodeURIComponent(artist)}`} key={artist}>
                {artist}
                <ChevronRight size={15} />
              </Link>
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          title="No matches, yet"
          detail={`Nothing in your library matches “${query}”. Try a title, artist or album name.`}
        />
      )}
    </div>
  );
}

export function AlbumPage() {
  const { id } = useParams();
  const tracks = useMusic((state) => state.tracks);
  const favorites = useMusic((state) => state.favorites);
  const album = albumsOf(tracks).find((item) => item.id === id);
  const first = album?.tracks[0];
  const palette = usePalette(first?.artworkUrl);
  const [details, setDetails] = useState(false);
  const [menu, setMenu] = useState(false);
  if (!album || !first)
    return (
      <div className="page">
        <EmptyState
          title="Album not found"
          detail="This album is not in the current library."
          action={
            <Link className="button" to="/albums">
              Browse albums
            </Link>
          }
        />
      </div>
    );
  const liked = favorites.includes(`album:${album.id}`);
  const start = (shuffle: boolean) => {
    useMusic.setState({ shuffle });
    const track = shuffle ? album.tracks[Math.floor(Math.random() * album.tracks.length)] : first;
    useMusic.getState().play(
      track.id,
      album.tracks.map((song) => song.id),
    );
  };
  return (
    <div
      className="page album-page"
      style={
        {
          '--album-color': palette.dominant,
          '--album-secondary': palette.secondary,
        } as CSSProperties
      }
    >
      <div className="album-ambient" />
      <Link className="back-link" to="/albums">
        ‹ Albums
      </Link>
      <header className="album-hero">
        <button
          className="album-art-button"
          aria-label="Open album in full player"
          onClick={() => {
            useMusic.setState({
              currentId: first.id,
              position: 0,
              playerOpen: true,
              desiredPlaying: false,
            });
          }}
        >
          <Artwork
            layoutId={`album-${album.id}`}
            src={album.artwork}
            alt={`${album.title} artwork`}
          />
        </button>
        <div className="album-info">
          <span className="eyebrow">{first.demo ? 'DEMO ALBUM PREVIEW' : 'ALBUM'}</span>
          <h1>{album.title}</h1>
          <Link className="album-artist-link" to={`/artist/${encodeURIComponent(album.artist)}`}>
            {album.artist}
            <ChevronRight size={18} />
          </Link>
          <p>
            {[first.genre, first.year].filter(Boolean).join(' · ')} · {album.tracks.length}{' '}
            {album.tracks.length === 1 ? 'song' : 'songs'}
          </p>
          <button className="quality-tag" onClick={() => setDetails(true)}>
            <span className="quality-wave">≋</span>
            {quality(first)}
            <ChevronRight size={12} />
          </button>
          <div className="album-actions">
            <button className="button primary" onClick={() => start(false)}>
              <Play size={17} fill="currentColor" />
              Play
            </button>
            <button className="button" onClick={() => start(true)}>
              <Shuffle size={17} />
              Shuffle
            </button>
            <IconButton
              label={liked ? 'Unfavorite album' : 'Favorite album'}
              className={liked ? 'favorite' : ''}
              onClick={() => useMusic.getState().favorite(`album:${album.id}`)}
            >
              <Heart size={21} fill={liked ? 'currentColor' : 'none'} />
            </IconButton>
            <IconButton label="Album options" onClick={() => setMenu(true)}>
              <Plus size={22} />
            </IconButton>
          </div>
        </div>
      </header>
      <TrackList tracks={album.tracks} numbered />
      {first.demo ? (
        <p className="album-footnote">
          Preview metadata only. The illustration is an original artwork study, not the official
          album cover. Import your own audio and artwork to complete this album.
        </p>
      ) : (
        <p className="album-footnote">
          {album.tracks.length} songs ·{' '}
          {time(album.tracks.reduce((sum, track) => sum + track.duration, 0))} total
          <br />
          Original source files. No transcoding.
        </p>
      )}
      <AnimatePresence>
        {details && <AudioDetails track={first} onClose={() => setDetails(false)} />}
        {menu && <TrackMenu track={first} onClose={() => setMenu(false)} />}
      </AnimatePresence>
    </div>
  );
}

export function ArtistPage() {
  const { id = '' } = useParams();
  const tracks = useMusic((state) => state.tracks).filter((track) => track.artist === id);
  const favorites = useMusic((state) => state.favorites);
  const history = useMusic((state) => state.history);
  const liked = favorites.includes(`artist:${id}`);
  if (!tracks.length)
    return (
      <div className="page">
        <EmptyState
          title="Artist not found"
          detail="Try another artist from your library."
          action={
            <Link to="/artists" className="button">
              Browse artists
            </Link>
          }
        />
      </div>
    );
  return (
    <div className="page artist-page">
      <Link to="/artists" className="back-link">
        ‹ Artists
      </Link>
      <header className="artist-hero">
        <div
          className="artist-hero-background"
          style={{ backgroundImage: `url(${JSON.stringify(tracks[0].artworkUrl)})` }}
        />
        <div className="artist-artwork">
          <Artwork src={tracks[0].artworkUrl} alt="Artwork from your collection" />
        </div>
        <div>
          <span className="eyebrow">IN YOUR COLLECTION</span>
          <h1>{id}</h1>
          <p>
            {tracks.length} songs · {albumsOf(tracks).length} albums
          </p>
          <div className="album-actions">
            <button
              className="button primary"
              onClick={() =>
                useMusic.getState().play(
                  tracks[0].id,
                  tracks.map((track) => track.id),
                )
              }
            >
              <Play size={17} fill="currentColor" />
              Play
            </button>
            <button
              className={`button ${liked ? 'favorite' : ''}`}
              onClick={() => useMusic.getState().favorite(`artist:${id}`)}
            >
              <Heart size={17} fill={liked ? 'currentColor' : 'none'} />
              {liked ? 'Favorited' : 'Favorite'}
            </button>
          </div>
        </div>
      </header>
      <SectionTitle title="Top songs" caption="From your library and listening history." />
      <TrackList
        tracks={[...tracks].sort(
          (a, b) => (history[b.id]?.count || 0) - (history[a.id]?.count || 0),
        )}
      />
      <SectionTitle title="Albums" />
      <AlbumGrid tracks={tracks} />
    </div>
  );
}

export function RadioPage() {
  const tracks = useMusic((state) => state.tracks).filter((track) => !track.demo);
  return (
    <div className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">LET THE MUSIC FIND YOU</p>
          <h1>Radio</h1>
        </div>
      </header>
      <section className="radio-hero">
        <Radio size={52} strokeWidth={1} />
        <span className="eyebrow">YOUR OWN FREQUENCY</span>
        <h2>
          A station made
          <br />
          of your collection.
        </h2>
        <p>
          A continuous shuffle of the music you bring.
          <br />
          No subscriptions. No strangers in the queue.
        </p>
        {tracks.length ? (
          <button
            className="button primary"
            onClick={() => {
              useMusic.setState({ shuffle: true, repeat: 'all' });
              const track = tracks[Math.floor(Math.random() * tracks.length)];
              useMusic.getState().play(
                track.id,
                tracks.map((item) => item.id),
              );
            }}
          >
            <Play size={17} fill="currentColor" />
            Start library radio
          </button>
        ) : (
          <ImportButton className="button primary">Import music to start</ImportButton>
        )}
        <span className="fine-print">Library shuffle · no broadcast stations connected</span>
      </section>
    </div>
  );
}

export function SettingsPage() {
  const state = useMusic();
  return (
    <div className="page settings-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">MAKE YOURSELF AT HOME</p>
          <h1>Settings</h1>
        </div>
      </header>
      <section className="settings-section">
        <h2>Appearance</h2>
        <div className="settings-row">
          <div>
            <h3>Theme</h3>
            <p>Find the light that feels right.</p>
          </div>
          <div className="segmented">
            {(['system', 'light', 'dark'] as const).map((theme) => (
              <button
                aria-pressed={state.theme === theme}
                className={state.theme === theme ? 'active' : ''}
                key={theme}
                onClick={() => useMusic.setState({ theme })}
              >
                {theme}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-row">
          <div>
            <h3>Glass quality</h3>
            <p>Balance optical depth with battery and performance.</p>
          </div>
          <select
            aria-label="Glass quality"
            value={state.glassQuality}
            onChange={(event) =>
              useMusic.setState({ glassQuality: event.target.value as typeof state.glassQuality })
            }
          >
            {['auto', 'high', 'balanced', 'reduced'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
        <p className="fine-print">
          Auto uses device concurrency and reduced-motion preferences. High adds subtle SVG
          refraction on supported browsers. Reduced retains readable surfaces with less blur.
        </p>
      </section>
      <section className="settings-section">
        <h2>Lyrics</h2>
        {(
          [
            [
              'translation',
              'Translations',
              'Show translations when your lyric file includes them.',
            ],
            ['pronunciation', 'Pronunciation', 'Show pronunciation guides when available.'],
          ] as const
        ).map(([key, title, detail]) => (
          <div className="settings-row" key={key}>
            <div>
              <h3>{title}</h3>
              <p>{detail}</p>
            </div>
            <button
              className={`switch ${state[key] ? 'on' : ''}`}
              role="switch"
              aria-checked={state[key]}
              aria-label={title}
              onClick={() => useMusic.setState({ [key]: !state[key] })}
            >
              <span />
            </button>
          </div>
        ))}
      </section>
      <section className="settings-section">
        <h2>Your library</h2>
        <div className="settings-row">
          <div>
            <h3>Bring your own music</h3>
            <p>Files stay in this browser’s storage, in their original format.</p>
          </div>
          <ImportButton />
        </div>
        <p className="fine-print">
          Keep a separate backup of your files. Browser storage can be cleared or evicted. Remote
          libraries can be connected using library.json and the private Cloudflare media service.
        </p>
        <div className="settings-row">
          <div>
            <h3>Browser storage</h3>
            <p>Ask the browser to protect your imported collection from automatic eviction.</p>
          </div>
          <button
            className="button"
            onClick={async () => {
              const granted = await navigator.storage?.persist?.().catch(() => false);
              state.notify(
                granted
                  ? 'Persistent storage enabled on this browser.'
                  : 'This browser did not grant persistent storage. Keep your source files backed up.',
              );
            }}
          >
            Keep on device
          </button>
        </div>
      </section>
      <section className="settings-section">
        <h2>Playback, honestly</h2>
        <p>
          Audio plays through the native browser decoder. Mr Han Music does not transcode, normalize
          or process your audio. Quality labels describe your source files; final output depends on
          your browser, OS and audio device.
        </p>
        <div className="keyboard-shortcuts">
          <span>
            <kbd>Space</kbd> Play / pause
          </span>
          <span>
            <kbd>← / →</kbd> Seek 5 seconds
          </span>
          <span>
            <kbd>L</kbd> Lyrics
          </span>
          <span>
            <kbd>Q</kbd> Queue
          </span>
          <span>
            <kbd>⌘ / Ctrl K</kbd> Search
          </span>
        </div>
      </section>
      <footer className="settings-about">
        <img src="/icons/icon.svg" alt="" />
        <div>
          <strong>Mr Han Music</strong>
          <p>Version 1.0 · A private listening space.</p>
        </div>
      </footer>
    </div>
  );
}
export function NotFoundPage() {
  return (
    <motion.div className="page">
      <EmptyState
        title="A little off track"
        detail="This page doesn’t exist. Your music is still right here."
        action={
          <Link to="/" className="button primary">
            Back to Home
          </Link>
        }
      />
    </motion.div>
  );
}
