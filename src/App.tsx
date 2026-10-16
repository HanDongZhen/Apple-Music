import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Album,
  ArrowDownToLine,
  ChevronLeft,
  ChevronRight,
  Disc3,
  Heart,
  History,
  Home,
  Library,
  ListMusic,
  Music2,
  Plus,
  Radio,
  Search,
  Settings2,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { Glass, GlassFilters } from './glass/Glass';
import { useMusic } from './storage/store';
import { Runtime } from './components/Runtime';
import { IconButton } from './components/ui';
import { ImportButton } from './components/ImportButton';
import {
  AlbumPage,
  ArtistPage,
  HomePage,
  LibraryPage,
  NotFoundPage,
  RadioPage,
  SearchPage,
  SettingsPage,
} from './features/Pages';
import { FullPlayer, MiniPlayer, QueuePanel } from './player/Player';

function Sidebar() {
  return (
    <Glass material="navigation" className="sidebar">
      <Link to="/" className="brand">
        <img src="/icons/icon.svg" alt="" />
        <span>
          Mr Han <strong>Music</strong>
        </span>
      </Link>
      <Link to="/search" className="sidebar-search">
        <Search size={16} />
        <span>Search your music</span>
        <kbd>⌘ K</kbd>
      </Link>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {[
          [Home, 'Home', '/'],
          [Sparkles, 'New', '/new'],
          [Radio, 'Radio', '/radio'],
        ].map(([Icon, label, path]) => {
          const Glyph = Icon as typeof Home;
          return (
            <NavLink end key={String(path)} to={String(path)}>
              <Glyph size={20} />
              <span>{String(label)}</span>
            </NavLink>
          );
        })}
        <span className="nav-section-label">YOUR LIBRARY</span>
        {[
          [History, 'Recently Added', '/library'],
          [Music2, 'Songs', '/songs'],
          [Album, 'Albums', '/albums'],
          [Users, 'Artists', '/artists'],
          [ListMusic, 'Playlists', '/playlists'],
          [Heart, 'Favorites', '/favorites'],
        ].map(([Icon, label, path]) => {
          const Glyph = Icon as typeof Home;
          return (
            <NavLink key={String(path)} to={String(path)}>
              <Glyph size={19} />
              <span>{String(label)}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-import">
          <span className="sidebar-import-icon">
            <ArrowDownToLine size={20} />
          </span>
          <h3>A home for your music.</h3>
          <p>
            Bring the songs.
            <br />
            We’ll set the mood.
          </p>
          <ImportButton className="button sidebar-import-button">
            <span>Add your music</span>
            <Plus size={14} />
          </ImportButton>
        </div>
        <NavLink className="settings-nav" to="/settings" aria-label="Settings">
          <Settings2 size={18} />
          <span>Settings</span>
          <span className="version">1.0</span>
        </NavLink>
        <div className="sidebar-signature">
          <span className="private-dot" />
          JUST YOU & THE MUSIC
        </div>
      </div>
    </Glass>
  );
}
function MobileTabs() {
  const [compact, setCompact] = useState(false);
  const location = useLocation();
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const handler = () => {
      setCompact(window.scrollY > 100);
      clearTimeout(timeout);
      timeout = setTimeout(() => setCompact(false), 900);
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('scroll', handler);
    };
  }, []);
  return (
    <div className={`mobile-tabs-wrap ${compact ? 'compact-tabs' : ''}`}>
      <Glass material="tabbar" className="mobile-tabs">
        <nav aria-label="Mobile navigation">
          {[
            [Home, 'Home', '/'],
            [Sparkles, 'New', '/new'],
            [Radio, 'Radio', '/radio'],
            [Library, 'Library', '/songs'],
          ].map(([Icon, label, path]) => {
            const Glyph = Icon as typeof Home;
            return (
              <NavLink
                to={String(path)}
                end
                key={String(path)}
                className={({ isActive }) =>
                  isActive ||
                  (label === 'Library' &&
                    ['/library', '/albums', '/artists', '/playlists', '/favorites'].includes(
                      location.pathname,
                    ))
                    ? 'active'
                    : ''
                }
              >
                <Glyph size={21} />
                <span>{String(label)}</span>
              </NavLink>
            );
          })}
        </nav>
      </Glass>
      <Glass material="tabbar" className="mobile-search-tab">
        <NavLink to="/search" aria-label="Search">
          <Search size={24} />
        </NavLink>
      </Glass>
    </div>
  );
}
function Toast() {
  const toast = useMusic((state) => state.toast);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => useMusic.setState({ toast: null }), 6500);
    return () => clearTimeout(timer);
  }, [toast]);
  return (
    <AnimatePresence mode="wait">
      {toast && (
        <motion.div
          className="toast-wrap"
          key={toast.id}
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ opacity: 0, y: 8 }}
        >
          <Glass material="popover" className="toast">
            <span role="status">{toast.message}</span>
            <IconButton
              label="Dismiss notification"
              onClick={() => useMusic.setState({ toast: null })}
            >
              <X size={17} />
            </IconButton>
          </Glass>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const playerOpen = useMusic((state) => state.playerOpen);
  const queueOpen = useMusic((state) => state.queueOpen);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        useMusic.setState({ playerOpen: false, queueOpen: false });
        navigate('/search');
        return;
      }
      const target = event.target as HTMLElement;
      if (target.closest('input,textarea,select,[contenteditable="true"],button,a,[role="dialog"]'))
        return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const state = useMusic.getState();
      if (event.code === 'Space') {
        event.preventDefault();
        state.toggle();
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        state.seek(state.position + 5);
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        state.seek(state.position - 5);
      }
      if (event.key.toLowerCase() === 'l')
        useMusic.setState({ playerOpen: true, lyricsOpen: !state.lyricsOpen });
      if (event.key.toLowerCase() === 'q') useMusic.setState({ queueOpen: !state.queueOpen });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);
  return (
    <>
      <Runtime />
      <GlassFilters />
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div className="app-shell" inert={playerOpen || queueOpen ? true : undefined}>
        <Sidebar />
        <main id="main-content">
          <header className="topbar">
            <div className="history-controls">
              <IconButton
                label="Go back"
                disabled={(window.history.state?.idx ?? 0) === 0}
                onClick={() => navigate(-1)}
              >
                <ChevronLeft size={19} />
              </IconButton>
              <IconButton label="Go forward" onClick={() => navigate(1)}>
                <ChevronRight size={19} />
              </IconButton>
              <span>Your listening space</span>
            </div>
            <Link className="mobile-brand" to="/">
              <img src="/icons/icon.svg" alt="" />
              Mr Han Music
            </Link>
            <div className="topbar-right">
              <span className="private-library">
                <span />
                PRIVATE LIBRARY
              </span>
              <Link to="/settings" className="profile-button" aria-label="Your settings">
                H
              </Link>
            </div>
          </header>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 7 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              <Routes location={location}>
                <Route path="/" element={<HomePage />} />
                <Route path="/new" element={<LibraryPage view="new" />} />
                <Route path="/radio" element={<RadioPage />} />
                <Route path="/library" element={<LibraryPage view="new" />} />
                {['songs', 'albums', 'artists', 'playlists', 'favorites', 'recent'].map((view) => (
                  <Route path={`/${view}`} key={view} element={<LibraryPage view={view} />} />
                ))}
                <Route path="/search" element={<SearchPage />} />
                <Route path="/album/:id" element={<AlbumPage />} />
                <Route path="/artist/:id" element={<ArtistPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>
        <MiniPlayer />
        <MobileTabs />
      </div>
      <AnimatePresence>
        {playerOpen && <FullPlayer />}
        {queueOpen && <QueuePanel />}
      </AnimatePresence>
      <Toast />
      <div className="offline-shell-note">
        <Disc3 size={16} />
      </div>
    </>
  );
}
