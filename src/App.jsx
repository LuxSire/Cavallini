
import './App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import EmailAccess from './EmailAccess';
import Cavallini from './Cavallini';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<EmailAccess />} />
        <Route path="/cavallini" element={<Cavallini />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;