// client/src/App.jsx
// Purpose: Main Router configuration.

import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import ChallengeDetails from "./pages/ChallengeDetails"; // Gemini: Import the new page
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <header className="main-header">
          <h1>🤖 Creator Challenge Bot</h1>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            {/* Gemini: Update the route to use the real component */}
            <Route path="/challenge/:id" element={<ChallengeDetails />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
