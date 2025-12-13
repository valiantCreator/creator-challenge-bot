// client/src/pages/Dashboard.jsx
import { useState, useEffect } from "react";
// Gemini: Import Link for navigation
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

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [challengeToDelete, setChallengeToDelete] = useState(null); // Stores challenge obj or null

  // Helper to fetch data
  const fetchChallenges = () => {
    setLoading(true);
    api
      .get("/api/challenges")
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
  }, []);

  if (loading && challenges.length === 0)
    return <div className="loading">Loading Challenges...</div>;

  return (
    <div className="dashboard">
      <header className="page-header">
        <div className="header-left">
          <h2>Active Challenges</h2>
          <span className="count-badge">{challenges.length} Live</span>

          {/* Gemini: Added Leaderboard Link */}
          <Link to="/leaderboard" className="leaderboard-link-btn">
            🏆 Leaderboard
          </Link>
        </div>

        {/* Gemini: Admin Create Button */}
        {user && user.isAdmin && (
          <button
            className="new-challenge-btn"
            onClick={() => setShowCreateModal(true)}
          >
            + New Challenge
          </button>
        )}
      </header>

      <div className="challenges-grid">
        {challenges.map((challenge) => (
          <ChallengeCard
            key={challenge.id}
            challenge={challenge}
            isAdmin={user?.isAdmin} // Pass admin status
            onDelete={(ch) => setChallengeToDelete(ch)} // Open delete modal
          />
        ))}
      </div>

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
