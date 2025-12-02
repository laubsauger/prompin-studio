import { Explorer } from './components/Explorer';
import { SyncStatus } from './components/SyncStatus';
import './App.css';

function App() {
  return (
    <div className="app">
      <SyncStatus />
      <Explorer />
    </div>
  );
}

export default App;
