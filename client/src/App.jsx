// client/src/App.jsx
// Purpose: Main Router configuration & Authentication Wrapper.
// Gemini: Updated to handle Discord OAuth2 login state (v0.9).

import { useState, useEffect } from "react"; // Gemini: Added hooks for state management
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import ChallengeDetails from "./pages/ChallengeDetails";
import "./App.css";

function App() {
  // Gemini: State to store the logged-in user
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Gemini: Check URL for "?user=..." (The backend sends this after login)
    const params = new URLSearchParams(window.location.search);
    const userParam = params.get("user");

    if (userParam) {
      try {
        // Decode the JSON string back into an object
        const userData = JSON.parse(decodeURIComponent(userParam));
        setUser(userData);

        // Gemini: Clean the URL so the query param disappears (looks cleaner)
        window.history.replaceState({}, document.title, "/");
      } catch (err) {
        console.error("Failed to parse user data:", err);
      }
    }
  }, []);

  const handleLogin = () => {
    // Gemini: Redirect to our backend API to start the OAuth handshake
    window.location.href = "/api/auth/login";
  };

  const handleLogout = () => {
    setUser(null);
    window.location.href = "/";
  };

  return (
    <BrowserRouter>
      <div className="app-container">
        <header className="main-header">
          <div className="header-content">
            <h1>🤖 Creator Challenge Bot</h1>

            {/* Gemini: Authentication UI Section */}
            <div className="auth-section">
              {user ? (
                <div className="user-profile">
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
            {/* Gemini: Pass user state to pages so they can enable "Submit" buttons later */}
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
