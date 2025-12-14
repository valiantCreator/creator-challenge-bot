// client/src/pages/Profile.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import EditSubmissionModal from "../components/EditSubmissionModal";
import "./Profile.css";

function Profile({ user }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingSubmission, setEditingSubmission] = useState(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/my-submissions");
      setSubmissions(res.data);
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user]);

  if (!user) {
    return (
      <div className="profile-page">
        <div className="login-prompt">
          <h2>Please Log In</h2>
          <p>You need to be logged in to view your profile.</p>
          <Link to="/" className="back-link">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <header className="profile-header">
        <div className="profile-user-info">
          <img
            src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`}
            alt={user.username}
            className="profile-avatar-large"
          />
          <div className="profile-text">
            <h1>{user.username}</h1>
            <span className="profile-role">
              {user.isAdmin ? "Administrator" : "Community Member"}
            </span>
          </div>
        </div>

        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-label">Rank</span>
            <span className="stat-value">
              {user.rank ? `#${user.rank}` : "-"}
            </span>
            <span className="stat-sub">
              of {user.totalParticipants || 0} users
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total Points</span>
            <span className="stat-value">
              {user.points ? user.points.toLocaleString() : 0}
            </span>
            <span className="stat-sub">Lifetime Score</span>
          </div>
        </div>
      </header>

      <div className="profile-content">
        <div className="section-header">
          <h2>My Submissions</h2>
          <Link to="/" className="back-link">
            ← Back to Dashboard
          </Link>
        </div>

        {loading ? (
          <div className="loading">Loading history...</div>
        ) : submissions.length === 0 ? (
          <div className="empty-state">
            <p>You haven't submitted anything yet!</p>
            <Link to="/" className="cta-link">
              Browse Challenges
            </Link>
          </div>
        ) : (
          <div className="submissions-grid">
            {submissions.map((sub) => (
              <div key={sub.id} className="profile-sub-card">
                <div className="sub-card-header">
                  <span className="sub-id">#{sub.id}</span>
                  <span className="sub-date">
                    {new Date(sub.created_at).toLocaleDateString()}
                  </span>
                </div>

                {sub.attachment_url && (
                  <div className="sub-image-container">
                    <img
                      src={sub.attachment_url}
                      alt="Submission"
                      className="sub-image"
                    />
                  </div>
                )}

                <div className="sub-body">
                  <p className="sub-text">
                    {sub.content_text || <em>No caption</em>}
                  </p>
                  {sub.link_url && (
                    <a
                      href={sub.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sub-link"
                    >
                      🔗 External Link
                    </a>
                  )}
                </div>

                <div className="sub-footer">
                  <div className="vote-count">👍 {sub.votes} Votes</div>
                  <button
                    className="edit-btn"
                    onClick={() => setEditingSubmission(sub)}
                  >
                    ✏️ Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editingSubmission && (
        <EditSubmissionModal
          submission={editingSubmission}
          onClose={() => setEditingSubmission(null)}
          onSuccess={() => {
            fetchHistory(); // Refresh list
          }}
        />
      )}
    </div>
  );
}

export default Profile;
