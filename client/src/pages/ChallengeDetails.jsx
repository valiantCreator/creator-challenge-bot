// client/src/pages/ChallengeDetails.jsx
// Purpose: Displays the full gallery of submissions for a specific challenge.
// Gemini: Updated to use 'api' helper for Render deployment.

import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
// Gemini: Use our configured API helper instead of raw axios
import api from "../api";
import "./ChallengeDetails.css";

function ChallengeDetails({ user }) {
  const { id } = useParams(); // Get the ID from the URL (e.g., /challenge/5)
  const [challenge, setChallenge] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // State for the Submission Form
  const [caption, setCaption] = useState("");
  const [link, setLink] = useState("");
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Gemini: Fetch both challenge details and submissions in parallel
    const fetchData = async () => {
      try {
        const [chalRes, subRes] = await Promise.all([
          // Gemini: Changed axios.get to api.get
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
      alert("Please add a file, caption, or link!");
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
      // Gemini: Changed axios.post to api.post
      await api.post(`/api/challenges/${id}/submit`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Reset form
      setCaption("");
      setLink("");
      setFile(null);
      setIsSubmitting(false);
      alert("Submission successful!");

      // Refresh the list to show the new item
      // Gemini: Changed axios.get to api.get
      const newSubRes = await api.get(`/api/challenges/${id}/submissions`);
      setSubmissions(newSubRes.data);
    } catch (error) {
      console.error("Submission error:", error);
      alert("Failed to submit. Please try again.");
      setIsSubmitting(false);
    }
  };

  // Handle the delete action
  const handleDelete = async (submissionId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this submission? This cannot be undone."
      )
    ) {
      return;
    }

    try {
      // Gemini: Changed axios.delete to api.delete
      await api.delete(`/api/submissions/${submissionId}`);
      // Remove the item from the UI immediately
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

      {/*Submission Form Section */}
      {/* Only show if user is logged in */}
      {user ? (
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

                {/* Admin Controls */}
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
