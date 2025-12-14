// client/src/components/EditSubmissionModal.jsx
import { useState } from "react";
import api from "../api";
// Gemini: Use the new dedicated CSS file
import "./EditSubmissionModal.css";

function EditSubmissionModal({ submission, onClose, onSuccess }) {
  const [caption, setCaption] = useState(submission.content_text || "");
  const [link, setLink] = useState(submission.link_url || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await api.patch(`/api/submissions/${submission.id}`, {
        caption,
        link,
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Failed to update submission:", err);
      setError(err.response?.data?.error || "Failed to update submission.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // Gemini: Added onClick to close when clicking the background
    <div className="modal-overlay" onClick={onClose}>
      {/* Gemini: stopPropagation prevents closing when clicking INSIDE the modal */}
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>✏️ Edit Submission</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="error-banner">{error}</div>}

          <div className="form-group">
            <label>Caption / Notes</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Update your caption..."
              rows={4}
            />
          </div>

          <div className="form-group">
            <label>External Link (Optional)</label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditSubmissionModal;
