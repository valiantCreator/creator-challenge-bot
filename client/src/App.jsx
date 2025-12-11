// client/src/App.jsx
import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import api from "./api";
import Dashboard from "./pages/Dashboard";
import ChallengeDetails from "./pages/ChallengeDetails";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      const userParam = params.get("user");

      if (userParam) {
        try {
          const userData = JSON.parse(decodeURIComponent(userParam));
          setUser(userData);
          window.history.replaceState({}, document.title, "/");
          setLoadingUser(false);
          return;
        } catch (err) {
          console.error("Failed to parse user url param:", err);
        }
      }

      try {
        const response = await api.get("/api/auth/me");
        setUser(response.data);
      } catch (err) {
        setUser(null);
      } finally {
        setLoadingUser(false);
      }
    };

    initializeAuth();
  }, []);

  const handleLogin = () => {
    const baseURL = import.meta.env.VITE_API_URL || "";
    window.location.href = `${baseURL}/api/auth/login`;
  };

  const handleLogout = async () => {
    try {
      await api.post("/api/auth/logout");
    } catch (e) {
      console.error("Logout error", e);
    }
    setUser(null);
    window.location.href = "/";
  };

  if (loadingUser) {
    return <div className="app-container">Loading...</div>;
  }

  return (
    <BrowserRouter>
      <div className="app-container">
        <header className="main-header">
          <div className="header-content">
            <Link to="/" className="logo-link">
              <h1>🤖 Creator Challenge Bot</h1>
            </Link>

            <div className="auth-section">
              {user ? (
                <div className="user-profile">
                  {user.isAdmin && <span className="admin-badge">ADMIN</span>}
                  {/* Gemini: Removed the + New Challenge link from here */}

                  {user.avatar && (
                    <img
                      src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`}
                      alt="Avatar"
                      className="user-avatar"
                    />
                  )}
                  <span className="username">{user.username}</span>
                  <button onClick={handleLogout} className="logout-btn">
                    Logout
                  </button>
                </div>
              ) : (
                <button onClick={handleLogin} className="login-btn">
                  Login with Discord
                </button>
              )}
            </div>
          </div>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<Dashboard user={user} />} />
            <Route
              path="/challenge/:id"
              element={<ChallengeDetails user={user} />}
            />
            {/* Gemini: Removed /admin/create route */}
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
