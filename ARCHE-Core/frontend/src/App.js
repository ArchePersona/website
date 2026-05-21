import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/AuthContext";
import Disclaimer from "@/Disclaimer";
import Landing from "@/Landing";
import Chat from "@/Chat";
import Login from "@/Login";
import Admin from "@/Admin";
import ProtectedRoute from "@/ProtectedRoute";
import "@/App.css";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Marketing landing — first thing visitors see */}
          <Route path="/" element={<Landing />} />

          {/* Auth */}
          <Route path="/login" element={<Login />} />

          {/* Disclaimer — gates the product, requires auth */}
          <Route
            path="/disclaimer"
            element={
              <ProtectedRoute>
                <Disclaimer />
              </ProtectedRoute>
            }
          />

          {/* The product */}
          <Route
            path="/brunel"
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            }
          />

          {/* Admin — server-side gates with ADMIN_EMAILS env var */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
