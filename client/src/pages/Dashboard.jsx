// client/src/pages/Dashboard.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import ChallengeCard from "../components/ChallengeCard";
import CreateChallengeModal from "../components/CreateChallengeModal";
import DeleteChallengeModal from "../components/admin/DeleteChallengeModal";
import "./Dashboard.css";

// Gemini: Accepted 'user' prop to check admin status
function Dashboard({ user }) {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showClosed, setShowClosed] = useState(false); // Gemini: Toggle State

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [challengeToDelete, setChallengeToDelete] = useState(null); // Stores challenge obj or null

  // Helper to fetch data
  const fetchChallenges = () => {
    setLoading(true);
    // Gemini: Fetch based on toggle state
    const endpoint = showClosed
      ? "/api/challenges?status=all"
      : "/api/challenges";

    api
      .get(endpoint)
      .then((res) => {
        setChallenges(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching challenges:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchChallenges();
  }, [showClosed]); // Re-fetch when toggle changes

  return (
    <div className="dashboard">
      <header className="page-header">
        <div className="header-left">
          <h2>{showClosed ? "All Challenges" : "Active Challenges"}</h2>
          <span className="count-badge">{challenges.length}</span>

          {/* Gemini: Added Leaderboard Link */}
          <Link to="/leaderboard" className="leaderboard-link-btn">
            🏆 Leaderboard
          </Link>
        </div>

        <div className="header-actions-right">
          {/* Gemini: Toggle Button */}
          {user && user.isAdmin && (
            <>
              {/* Gemini: Settings Button */}
              <Link to="/admin/settings" className="settings-link-btn">
                ⚙️ Settings
              </Link>

              <button
                className={`toggle-archive-btn ${showClosed ? "active" : ""}`}
                onClick={() => setShowClosed(!showClosed)}
              >
                {showClosed ? "Hide Closed" : "Show Archive"}
              </button>

              <button
                className="new-challenge-btn"
                onClick={() => setShowCreateModal(true)}
              >
                + New Challenge
              </button>
            </>
          )}
        </div>
      </header>

      {loading ? (
        <div className="loading">Loading Challenges...</div>
      ) : challenges.length === 0 ? (
        <div className="empty-state">No challenges found.</div>
      ) : (
        <div className="challenges-grid">
          {challenges.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              isAdmin={user?.isAdmin}
              onDelete={(ch) => setChallengeToDelete(ch)}
            />
          ))}
        </div>
      )}

      {/* Gemini: Create Modal */}
      {showCreateModal && (
        <CreateChallengeModal
          user={user}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            fetchChallenges(); // Refresh the list
          }}
        />
      )}

      {/* Gemini: Delete Modal */}
      {challengeToDelete && (
        <DeleteChallengeModal
          challenge={challengeToDelete}
          onClose={() => setChallengeToDelete(null)}
          onSuccess={(deletedId) => {
            // Optimistic update: remove from list immediately without full refetch
            setChallenges((prev) => prev.filter((c) => c.id !== deletedId));
          }}
        />
      )}
    </div>
  );
}

export default Dashboard;
