
import './App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import EmailAccess from './EmailAccess';
import Cavallini from './Cavallini';

function App() {
  return (
    <BrowserRouter basename={import.meta.env.MODE === 'production' ? '/Cavallini' : '/Cavallini'}>
      <Routes>
        <Route path="/" element={<EmailAccess />} />
        <Route path="/performance" element={<Cavallini />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;