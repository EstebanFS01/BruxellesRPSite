import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { ServerProvider } from "@/context/ServerContext";
import { Toaster } from "@/components/ui/sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Factions from "@/pages/Factions";
import Actualites from "@/pages/Actualites";
import Reglement from "@/pages/Reglement";
import Boutique from "@/pages/Boutique";
import Candidature from "@/pages/Candidature";
import Dashboard from "@/pages/Dashboard";
import Admin from "@/pages/Admin";
import Profile from "@/pages/Profile";
import Joueurs from "@/pages/Joueurs";
import JoueurDetail from "@/pages/JoueurDetail";
import EntrepriseDetail from "@/pages/EntrepriseDetail";

function Shell({ children }) {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    api.get("/server/info").then((r) => setInfo(r.data)).catch(() => {});
  }, []);
  return (
    <div className="App grain relative min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 fade-in">{children}</main>
      <Footer info={info} />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <ServerProvider>
          <BrowserRouter>
            <Shell>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/factions" element={<Factions />} />
                <Route path="/actualites" element={<Actualites />} />
                <Route path="/reglement" element={<Reglement />} />
                <Route path="/boutique" element={<Boutique />} />
                <Route path="/joueurs" element={<Joueurs />} />
                <Route path="/joueurs/:username" element={<JoueurDetail />} />
                <Route path="/entreprise/:key" element={<EntrepriseDetail />} />
                <Route path="/candidature" element={<ProtectedRoute><Candidature /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />
              </Routes>
            </Shell>
            <Toaster theme="dark" position="top-right" richColors />
          </BrowserRouter>
        </ServerProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
