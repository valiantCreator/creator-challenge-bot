// client/src/pages/ChallengeDetails.jsx
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api";
import PickWinnerModal from "../components/admin/PickWinnerModal";
import EditSubmissionModal from "../components/EditSubmissionModal";
import SubmissionDetailModal from "../components/SubmissionDetailModal";
import "./ChallengeDetails.css";

function ChallengeDetails({ user }) {
  const { id } = useParams();
  const [challenge, setChallenge] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // State for Submission Form
  const [caption, setCaption] = useState("");
  const [link, setLink] = useState("");
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal States
  const [winnerCandidate, setWinnerCandidate] = useState(null);
  const [editingSubmission, setEditingSubmission] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  const fetchData = async () => {
    try {
      const [chalRes, subRes] = await Promise.all([
        api.get(`/api/challenges/${id}`),
        api.get(`/api/challenges/${id}/submissions`),
      ]);

      setChallenge(chalRes.data);
      setSubmissions(subRes.data);
      setLoading(false);
    } catch (err) {
      console.error("Error loading details:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  // Handle File Selection
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  // Handle New Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    // Validation: Require at least one content field
    if (!file && !caption && !link) {
      toast.error("Please add a file, caption, or link!");
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append("caption", caption);
    formData.append("link", link);
    if (file) {
      formData.append("file", file);
    }

    try {
      await api.post(`/api/challenges/${id}/submit`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Reset form
      setCaption("");
      setLink("");
      setFile(null);
      setIsSubmitting(false);
      toast.success("Submission successful!");
      fetchData();
    } catch (error) {
      console.error("Submission error:", error);
      const msg = error.response?.data?.error || "Failed to submit.";
      toast.error(msg);
      setIsSubmitting(false);
    }
  };

  // Vote Handler
  const handleVote = async (submissionId) => {
    if (!user) return toast.error("Please log in to vote!");

    try {
      const response = await api.post(`/api/submissions/${submissionId}/vote`);
      const { action } = response.data;

      // Optimistic Update: Increment or Decrement
      setSubmissions((prev) =>
        prev.map((sub) => {
          if (sub.id === submissionId) {
            const newVotes = action === "added" ? sub.votes + 1 : sub.votes - 1;
            if (selectedSubmission?.id === submissionId) {
              setSelectedSubmission((prev) => ({ ...prev, votes: newVotes }));
            }
            return { ...sub, votes: newVotes };
          }
          return sub;
        })
      );

      // Gemini: Optional subtle toast for voting
      if (action === "added") toast.success("Vote added!");
    } catch (error) {
      const msg = error.response?.data?.error || "Failed to vote.";
      toast.error(msg);
    }
  };

  // Handle Delete
  const handleDelete = async (submissionId) => {
    if (!window.confirm("Are you sure? This cannot be undone.")) return;

    try {
      await api.delete(`/api/submissions/${submissionId}`);
      setSubmissions(submissions.filter((sub) => sub.id !== submissionId));
      setSelectedSubmission(null);
      toast.success("Submission deleted.");
    } catch (error) {
      toast.error("Failed to delete.");
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
          {/* Gemini: Added Date Display */}
          {challenge.ends_at && (
            <span className="deadline-badge">
              📅 Ends{" "}
              {new Date(parseInt(challenge.ends_at)).toLocaleDateString()}
            </span>
          )}
          {challenge.cron_schedule && (
            <span className="deadline-badge">🔄 Recurring</span>
          )}
          {/* Gemini: Show Closed Status */}
          {!challenge.is_active && (
            <span
              className="deadline-badge"
              style={{ color: "#ed4245", borderColor: "#ed4245" }}
            >
              🔒 CLOSED
            </span>
          )}
        </div>
      </header>

      {/* Submission Form - Hide if closed */}
      {user && challenge.is_active ? (
        <div className="submission-form-container">
          <h3>Submit Your Entry</h3>
          <form onSubmit={handleSubmit} className="submission-form">
            <input
              type="url"
              placeholder="Add a link (optional)..."
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="text-input"
            />
            <textarea
              placeholder="Write a caption..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows="3"
            />
            <div className="form-actions">
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileChange}
                className="file-input"
              />
              <button
                type="submit"
                className="submit-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Uploading..." : "Post Submission"}
              </button>
            </div>
            {file && <div className="file-preview">Selected: {file.name}</div>}
          </form>
        </div>
      ) : !challenge.is_active ? (
        <div className="login-prompt">
          <p>🔒 This challenge is closed for new submissions.</p>
        </div>
      ) : (
        <div className="login-prompt">
          <p>Want to submit an entry? Please log in above!</p>
        </div>
      )}

      <div className="gallery-grid">
        {submissions.length === 0 ? (
          <div className="empty-state">
            No submissions yet! Be the first to submit.
          </div>
        ) : (
          submissions.map((sub) => (
            <div
              key={sub.id}
              className="submission-card clickable"
              onClick={(e) => {
                if (e.target.tagName === "BUTTON" || e.target.tagName === "A")
                  return;
                setSelectedSubmission(sub);
              }}
            >
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

                <div className="submission-footer">
                  <span className="author">
                    by <strong>{sub.username}</strong>
                  </span>

                  {/* Gemini: Vote Section */}
                  <div className="vote-section">
                    <span className="votes">👍 {sub.votes}</span>
                    {user && (
                      <button
                        className={`vote-btn ${
                          user.id === sub.user_id ? "disabled" : ""
                        }`}
                        onClick={() => handleVote(sub.id)}
                        disabled={user.id === sub.user_id}
                      >
                        {user.id === sub.user_id ? "Own" : "Vote"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Gemini: Admin Controls with Text Labels */}
                <div className="admin-controls">
                  {user && user.id === sub.user_id && (
                    <button
                      className="edit-mini-btn"
                      onClick={() => setEditingSubmission(sub)}
                      title="Edit"
                    >
                      ✏️ <span className="btn-label">Edit</span>
                    </button>
                  )}

                  {user && user.isAdmin && (
                    <>
                      {challenge.is_active && (
                        <button
                          className="crown-btn"
                          onClick={() => setWinnerCandidate(sub)}
                        >
                          👑 <span className="btn-label">Crown</span>
                        </button>
                      )}
                      <button
                        className="delete-btn"
                        onClick={() => handleDelete(sub.id)}
                      >
                        🗑️ <span className="btn-label">Delete</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Winner Modal */}
      {winnerCandidate && (
        <PickWinnerModal
          submission={winnerCandidate}
          challengeId={challenge.id}
          onClose={() => setWinnerCandidate(null)}
          onSuccess={() => {
            fetchData();
          }}
        />
      )}

      {editingSubmission && (
        <EditSubmissionModal
          submission={editingSubmission}
          onClose={() => setEditingSubmission(null)}
          onSuccess={() => {
            fetchData();
          }}
        />
      )}

      {selectedSubmission && (
        <SubmissionDetailModal
          submission={selectedSubmission}
          user={user}
          challengeIsActive={challenge.is_active}
          onClose={() => setSelectedSubmission(null)}
          onVote={handleVote}
          onEdit={(sub) => setEditingSubmission(sub)}
          onDelete={handleDelete}
          onCrown={setWinnerCandidate}
        />
      )}
    </div>
  );
}

export default ChallengeDetails;
