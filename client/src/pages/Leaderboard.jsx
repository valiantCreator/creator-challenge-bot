// client/src/pages/Leaderboard.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import "./Leaderboard.css";

function Leaderboard() {
  const [period, setPeriod] = useState("all-time"); // 'weekly' | 'monthly' | 'all-time'
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        // Gemini: Fetch enriched data (with avatars) from our new backend endpoint
        const res = await api.get(`/api/leaderboard?period=${period}`);
        setData(res.data);
      } catch (error) {
        console.error("Failed to fetch leaderboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [period]);

  // Helper to render rank icons
  const getRankDisplay = (index) => {
    const rank = index + 1;
    if (rank === 1) return <span className="rank-icon">🥇</span>;
    if (rank === 2) return <span className="rank-icon">🥈</span>;
    if (rank === 3) return <span className="rank-icon">🥉</span>;
    return <span className="rank-number">#{rank}</span>;
  };

  return (
    <div className="leaderboard-page">
      <header className="lb-header">
        <div className="lb-title-group">
          <Link to="/" className="back-link">
            ← Back
          </Link>
          <h2>🏆 Community Leaderboard</h2>
        </div>

        <div className="period-selector">
          <button
            className={period === "weekly" ? "active" : ""}
            onClick={() => setPeriod("weekly")}
          >
            Weekly
          </button>
          <button
            className={period === "monthly" ? "active" : ""}
            onClick={() => setPeriod("monthly")}
          >
            Monthly
          </button>
          <button
            className={period === "all-time" ? "active" : ""}
            onClick={() => setPeriod("all-time")}
          >
            All Time
          </button>
        </div>
      </header>

      <div className="lb-content">
        {loading ? (
          <div className="lb-loading">Loading rankings...</div>
        ) : data.length === 0 ? (
          <div className="lb-empty">No points awarded in this period yet!</div>
        ) : (
          <table className="lb-table">
            <thead>
              <tr>
                <th className="col-rank">Rank</th>
                <th className="col-user">User</th>
                <th className="col-points">Points</th>
              </tr>
            </thead>
            <tbody>
              {data.map((user, index) => (
                <tr key={user.user_id} className="lb-row">
                  <td className="col-rank">{getRankDisplay(index)}</td>
                  <td className="col-user">
                    <div className="user-info">
                      <img
                        src={
                          user.avatar ||
                          "https://cdn.discordapp.com/embed/avatars/0.png"
                        }
                        alt={user.username}
                        className="user-avatar-small"
                      />
                      <span className="user-name">{user.username}</span>
                    </div>
                  </td>
                  <td className="col-points">
                    {user.points.toLocaleString()} pts
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Leaderboard;
