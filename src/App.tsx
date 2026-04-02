import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Index from './pages/Index';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Index />} />
        {/* Adicione outras rotas aqui se necessário */}
      </Routes>
    </Router>
  );
}

export default App;
