import {StrictMode,useState,useSyncExternalStore} from 'react';
import {createRoot} from 'react-dom/client';
import {editor} from './editor-port';
import '../../../styles.css';
import './prototype.css';

const paintLegacy=()=>{document.querySelector('#legacy-readout')!.textContent=`Legacy subscriber: ${editor.getSnapshot().name} / ${editor.getSnapshot().width}px`;};
editor.subscribe(paintLegacy);paintLegacy();
function Inspector(){
  const value=useSyncExternalStore(editor.subscribe,editor.getSnapshot);
  const [width,setWidth]=useState(''),[error,setError]=useState('');
  return <section aria-label="React inspector" className="prototype-panel"><h2>Inspector</h2><label>Layer name<input value={value.name} onChange={event=>editor.setName(event.target.value)}/></label><form onSubmit={event=>{event.preventDefault();try{editor.setWidth(width);setError('');setWidth('');}catch(error){setError(String((error as Error).message));}}}><label>Width expression<input placeholder={String(value.width)} value={width} onChange={event=>setWidth(event.target.value)}/></label><button className="btn" type="submit">Apply width</button></form><p role="alert">{error}</p><p>Hug parent: <output aria-label="Parent width">{value.frameWidth}</output> × {value.frameHeight}. Fill child: {value.fillWidth}.</p></section>;
}
function App(){
  const value=useSyncExternalStore(editor.subscribe,editor.getSnapshot);
  const [mounted,setMounted]=useState(true),[status,setStatus]=useState(''),[dark,setDark]=useState(false);
  return <main className="prototype"><header><h1>Standalone architecture prototype</h1><p>React owns this panel. Sigma owns the document, layout and undo. This isolated fixture never writes to your files.</p></header><nav aria-label="Prototype tools"><button className="btn" onClick={editor.undo}>Undo</button><button className="btn" onClick={editor.redo}>Redo</button><button className="btn" onClick={()=>{editor.reopen();setStatus('Reopened with stable layer IDs and values.');}}>Serialize and reopen</button><button className="btn" onClick={()=>setMounted(!mounted)}>{mounted?'Unmount inspector':'Mount inspector'}</button><button className="btn" onClick={()=>{document.documentElement.dataset.theme=dark?'light':'dark';setDark(!dark);}}>Toggle appearance</button></nav><div className="prototype-grid">{mounted&&<Inspector/>}<section className="prototype-preview" aria-label="Layout preview"><svg width="100%" height="180" viewBox="0 0 1100 180" role="img" aria-label="Sigma layout fixture"><g transform="translate(16 20)"><rect width={value.frameWidth} height={value.frameHeight} className="prototype-frame"/><rect x={value.firstX} y={value.firstY} width={value.width} height="40" className="prototype-first"/><rect x={value.fillX} y={value.fillY} width={value.fillWidth} height="40" className="prototype-fill"/></g></svg><p>{value.name}: {value.width}px. Store notification: {value.revision}.</p></section></div><p role="status">{status}</p></main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
