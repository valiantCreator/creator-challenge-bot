// client/src/components/ChallengeCard.jsx
// Purpose: A reusable card component to display a single challenge summary.

import { Link } from "react-router-dom";
import "./ChallengeCard.css";

function ChallengeCard({ challenge }) {
  // Determine the color of the "Type" badge based on the challenge type
  const getTypeColor = (type) => {
    const t = type.toLowerCase();
    if (t.includes("design")) return "badge-purple";
    if (t.includes("video") || t.includes("posting")) return "badge-red";
    if (t.includes("test")) return "badge-gray";
    return "badge-blue";
  };

  return (
    <div className="challenge-card">
      <div className="card-header">
        <span className={`badge ${getTypeColor(challenge.type)}`}>
          {challenge.type}
        </span>
        <span className="challenge-id">#{challenge.id}</span>
      </div>

      <h3>{challenge.title}</h3>
      <p className="description">{challenge.description}</p>

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
