// client/src/pages/Dashboard.jsx
// Purpose: The home page that displays a grid of all active challenges.

import { useState, useEffect } from "react";
// Gemini: Use our configured API helper instead of raw axios
import api from "../api";
import ChallengeCard from "../components/ChallengeCard";
import "./Dashboard.css";

function Dashboard() {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Gemini: changed 'axios.get' to 'api.get'
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
  }, []);

  if (loading) return <div className="loading">Loading Challenges...</div>;

  return (
    <div className="dashboard">
      <header className="page-header">
        <h2>Active Challenges</h2>
        <span className="count-badge">{challenges.length} Live</span>
      </header>

      <div className="challenges-grid">
        {challenges.map((challenge) => (
          <ChallengeCard key={challenge.id} challenge={challenge} />
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
