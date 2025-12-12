// client/src/components/ChallengeCard.jsx
// Purpose: A reusable card component to display a single challenge summary.
// Gemini: Updated with Admin Delete Button.

import { Link } from "react-router-dom";
import "./ChallengeCard.css";

function ChallengeCard({ challenge, isAdmin, onDelete }) {
  // Determine the color of the "Type" badge based on the challenge type
  const getTypeColor = (type) => {
    const t = type.toLowerCase();
    if (t.includes("design")) return "badge-purple";
    if (t.includes("video") || t.includes("posting")) return "badge-red";
    if (t.includes("test")) return "badge-gray";
    return "badge-blue";
  };

  // Format the deadline or show recurring status
  const formatDeadline = () => {
    if (challenge.ends_at) {
      // Use the raw timestamp (already in UTC from backend if fixed there,
      // or raw milliseconds). toLocaleDateString handles local conversion.
      const date = new Date(parseInt(challenge.ends_at));
      return `📅 Ends: ${date.toLocaleDateString()}`;
    }
    if (challenge.cron_schedule) {
      return "🔄 Recurring";
    }
    return null;
  };

  return (
    <div className="challenge-card">
      <div className="card-header">
        <span className={`badge ${getTypeColor(challenge.type)}`}>
          {challenge.type}
        </span>

        <div className="header-actions">
          {/* Gemini: Admin Delete Button */}
          {isAdmin && (
            <button
              className="delete-icon-btn"
              onClick={(e) => {
                e.preventDefault(); // Prevent navigation if wrapped in link
                onDelete(challenge);
              }}
              title="Delete Challenge"
            >
              🗑️
            </button>
          )}
          <span className="challenge-id">#{challenge.id}</span>
        </div>
      </div>

      <h3>{challenge.title}</h3>
      <p className="description">{challenge.description}</p>

      {/* Gemini: Display Date info */}
      <div className="card-meta">
        <span className="deadline-text">{formatDeadline()}</span>
      </div>

      <div className="card-footer">
        {/* This link will take us to the details page later */}
        <Link to={`/challenge/${challenge.id}`} className="view-btn">
          View Submissions →
        </Link>
      </div>
    </div>
  );
}

export default ChallengeCard;
