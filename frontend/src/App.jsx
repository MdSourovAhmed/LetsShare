import { Routes, Route } from "react-router-dom";
import Layout from "./components/ui/Layout.jsx";
import SendPage from "./pages/SendPage.jsx";
import ReceivePage from "./pages/ReceivePage.jsx";
import HomePage from "./pages/HomePage.jsx";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/send" element={<SendPage />} />
        <Route path="/receive" element={<ReceivePage />} />
      </Routes>
    </Layout>
  );
}
