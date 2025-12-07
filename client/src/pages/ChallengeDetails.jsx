// client/src/pages/ChallengeDetails.jsx
// Purpose: Displays the full gallery of submissions for a specific challenge.
// Gemini: Updated to include Admin Delete functionality (v0.9.2).

import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import "./ChallengeDetails.css";

// Gemini: 'user' prop passed from App.jsx contains { isAdmin: true/false }
function ChallengeDetails({ user }) {
  const { id } = useParams(); // Get the ID from the URL (e.g., /challenge/5)
  const [challenge, setChallenge] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Gemini: Fetch both challenge details and submissions in parallel
    const fetchData = async () => {
      try {
        const [chalRes, subRes] = await Promise.all([
          axios.get(`/api/challenges/${id}`),
          axios.get(`/api/challenges/${id}/submissions`),
        ]);

        setChallenge(chalRes.data);
        setSubmissions(subRes.data);
        setLoading(false);
      } catch (err) {
        console.error("Error loading details:", err);
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  // Gemini: Handle the delete action
  const handleDelete = async (submissionId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this submission? This cannot be undone."
      )
    ) {
      return;
    }

    try {
      await axios.delete(`/api/submissions/${submissionId}`);
      // Remove the item from the UI immediately so we don't need to refresh
      setSubmissions(submissions.filter((sub) => sub.id !== submissionId));
    } catch (error) {
      alert("Failed to delete. You might not be authorized.");
      console.error(error);
    }
  };

  if (loading) return <div className="loading">Loading Gallery...</div>;
  if (!challenge) return <div className="error">Challenge not found.</div>;

  return (
    <div className="details-page">
      <Link to="/" className="back-link">
        ← Back to Dashboard
      </Link>

      <header className="details-header">
        <h1>{challenge.title}</h1>
        <p>{challenge.description}</p>
        <div className="meta-info">
          <span className="badge">{challenge.type}</span>
          <span>{submissions.length} Submissions</span>
        </div>
      </header>

      <div className="gallery-grid">
        {submissions.length === 0 ? (
          <div className="empty-state">
            No submissions yet! Be the first to submit in Discord.
          </div>
        ) : (
          submissions.map((sub) => (
            <div key={sub.id} className="submission-card">
              {/* Image Attachment */}
              {sub.attachment_url && (
                <div className="media-preview">
                  <img
                    src={sub.attachment_url}
                    alt="Submission"
                    loading="lazy"
                  />
                </div>
              )}

              <div className="submission-content">
                {/* Text Content */}
                {sub.content_text && (
                  <p className="submission-text">"{sub.content_text}"</p>
                )}

                {/* External Link */}
                {sub.link_url && (
                  <a
                    href={sub.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="submission-link"
                  >
                    🔗 Open Link
                  </a>
                )}

                <div className="submission-footer">
                  <span className="author">
                    by <strong>{sub.username}</strong>
                  </span>
                  <span className="votes">👍 {sub.votes}</span>
                </div>

                {/* Gemini: Admin Controls - Only visible to Admins */}
                {user && user.isAdmin && (
                  <button
                    className="delete-btn"
                    onClick={() => handleDelete(sub.id)}
                    title="Admin Delete"
                  >
                    🗑️ Delete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ChallengeDetails;
