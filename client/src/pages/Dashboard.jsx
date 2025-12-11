// client/src/pages/Dashboard.jsx
import { useState, useEffect } from "react";
import api from "../api";
import ChallengeCard from "../components/ChallengeCard";
import CreateChallengeModal from "../components/CreateChallengeModal";
import "./Dashboard.css";

// Gemini: Accepted 'user' prop to check admin status
function Dashboard({ user }) {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  // Gemini: State for modal visibility
  const [showModal, setShowModal] = useState(false);

  // Helper to fetch data (used on mount and after creation)
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
        </div>

        {/* Gemini: Admin Button placed here */}
        {user && user.isAdmin && (
          <button
            className="new-challenge-btn"
            onClick={() => setShowModal(true)}
          >
            + New Challenge
          </button>
        )}
      </header>

      <div className="challenges-grid">
        {challenges.map((challenge) => (
          <ChallengeCard key={challenge.id} challenge={challenge} />
        ))}
      </div>

      {/* Gemini: Render Modal if state is true */}
      {showModal && (
        <CreateChallengeModal
          user={user}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            fetchChallenges(); // Refresh the list
          }}
        />
      )}
    </div>
  );
}

export default Dashboard;
