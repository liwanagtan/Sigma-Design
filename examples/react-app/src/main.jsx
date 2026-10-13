import { createRoot } from 'react-dom/client';
import './styles/components.css';
import { Button } from './components/Button.jsx';
import { Badge } from './components/Badge.jsx';
import { Card } from './components/Card.jsx';

function App() {
  return (
    <main style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Projects</h1>
        <Badge tone="success">3 active</Badge>
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <Card title="Website">The marketing site.</Card>
        <Card title="Mobile app" action="View">iOS and Android.</Card>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button>New project</Button>
        <Button variant="secondary">Import</Button>
        <Button variant="danger">Delete</Button>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
