import React from 'react';
import ReactDOM from 'react-dom/client';
import './shadcn.css';
import App from './App';
import '../styles.css';
import './header-toolbar-styles.css';
import './share-styles.css';

import Portal from './components/Portal';

// The public demo front page lives at /portal (or #/portal). Everything else is the app.
const isPortal = window.location.pathname.startsWith('/portal') || window.location.hash === '#/portal';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isPortal ? <Portal /> : <App />}
  </React.StrictMode>
);
