// client/src/App.jsx
// Purpose: Main Router configuration & Authentication Wrapper.
// Gemini: Updated to use 'api' helper and handle cross-domain auth redirects.

import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
// Gemini: Import our configured API helper instead of raw axios
import api from "./api";
import Dashboard from "./pages/Dashboard";
import ChallengeDetails from "./pages/ChallengeDetails";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      // 1. Check if the Backend sent user data in the URL (Redirect method)
      const params = new URLSearchParams(window.location.search);
      const userParam = params.get("user");

      if (userParam) {
        try {
          const userData = JSON.parse(decodeURIComponent(userParam));
          setUser(userData);
          // Clean the URL immediately
          window.history.replaceState({}, document.title, "/");
          setLoadingUser(false);
          return; // We found the user, no need to check API
        } catch (err) {
          console.error("Failed to parse user url param:", err);
        }
      }

      // 2. If no URL param, check the Session Cookie (Persistence method)
      try {
        // Gemini: Use 'api.get' so it hits the correct backend URL
        const response = await api.get("/api/auth/me");
        setUser(response.data);
      } catch (err) {
        // Not logged in (401), or cookie expired
        setUser(null);
      } finally {
        setLoadingUser(false);
      }
    };

    initializeAuth();
  }, []);

  const handleLogin = () => {
    // Gemini: Manually construct the full URL for the browser redirect.
    // 'api.get' is for data; window.location needs the full string.
    const baseURL = import.meta.env.VITE_API_URL || "";
    window.location.href = `${baseURL}/api/auth/login`;
  };

  const handleLogout = async () => {
    try {
      // Gemini: Use 'api.post'
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
            <h1>🤖 Creator Challenge Bot</h1>

            <div className="auth-section">
              {user ? (
                <div className="user-profile">
                  {user.isAdmin && <span className="admin-badge">ADMIN</span>}

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
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
