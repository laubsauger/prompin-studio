import { Explorer } from './components/Explorer';
import { SyncStatus } from './components/SyncStatus';
import { DragDropOverlay } from './components/DragDropOverlay';
import { IngestionModal } from './components/IngestionModal';
import './App.css';

function App() {
  return (
    <div className="app">
      <SyncStatus />
      <Explorer />
      <DragDropOverlay />
      <IngestionModal />
    </div>
  );
}

export default App;
