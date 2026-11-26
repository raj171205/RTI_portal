import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import HomePage from "./pages/HomePage";
import RTIDetailPage from "./pages/RTIDetailPage";
import AuthPage from "./pages/AuthPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/applications/:id" element={<RTIDetailPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}