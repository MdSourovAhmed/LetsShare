import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SendPage from './pages/SendPage';
import ReceivePage from './pages/ReceivePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SendPage />} />
        <Route path="/send" element={<SendPage />} />
        <Route path="/receive" element={<ReceivePage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
