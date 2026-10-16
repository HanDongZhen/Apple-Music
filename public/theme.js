// Set the system palette before the first paint; saved preferences hydrate from IndexedDB.
document.documentElement.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches
  ? 'dark'
  : 'light';
