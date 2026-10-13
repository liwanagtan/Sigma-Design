// Sigma's components page: every component in every variant, rendered by the app's own code (and bundler),
// for Sigma to capture (Check against code). Ids are the manifest's "element" selectors.
import { createRoot } from 'react-dom/client';
import 'sigma-design/bridge';
import './styles/components.css';
import { Button } from './components/Button.jsx';
import { Badge } from './components/Badge.jsx';
import { Card } from './components/Card.jsx';

const row = { display: 'flex', gap: 16, alignItems: 'center' };

createRoot(document.getElementById('root')).render(
  <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 24, padding: 24 }}>
    <div style={row}>
      <Button id="button-primary">Continue</Button>
      <Button id="button-secondary" variant="secondary">Continue</Button>
      <Button id="button-danger" variant="danger">Continue</Button>
    </div>
    <div style={row}>
      <Badge id="badge-neutral">Draft</Badge>
      <Badge id="badge-success" tone="success">Active</Badge>
      <Badge id="badge-warning" tone="warning">Paused</Badge>
    </div>
    <Card id="card" title="Website">The marketing site, with its blog and docs.</Card>
  </main>,
);
