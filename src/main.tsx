import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import App from './App';
import './styles.css';

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application error', error, info.componentStack);
  }
  render() {
    return this.state.failed ? (
      <div className="fatal-error">
        <img src="/icons/icon.svg" alt="" />
        <h1>Let’s find the music again.</h1>
        <p>
          The app encountered an unexpected error. Your imported files remain in browser storage.
        </p>
        <button className="button primary" onClick={() => window.location.reload()}>
          Reload Mr Han Music
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </BrowserRouter>
  </ErrorBoundary>,
);
