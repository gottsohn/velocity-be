import { useMemo } from 'react';
import { Dashboard } from './pages/Dashboard';
import { NotFound } from './pages/NotFound';

function App() {
  const streamId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('stream');
  }, []);

  if (!streamId) {
    return <NotFound />;
  }

  return <Dashboard streamId={streamId} />;
}

export default App;
