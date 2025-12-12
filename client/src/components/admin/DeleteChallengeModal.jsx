// client/src/components/admin/DeleteChallengeModal.jsx
import { useState } from "react";
import "./DeleteChallengeModal.css"; // Gemini: Import the standard CSS file

export default function DeleteChallengeModal({
  challenge,
  onClose,
  onSuccess,
}) {
  const [deleteThread, setDeleteThread] = useState(true);
  const [revokePoints, setRevokePoints] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);

  if (!challenge) return null;

  const handleDelete = async () => {
    // Basic confirmation
    if (!confirm(`Are you sure you want to delete "${challenge.title}"?`)) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/challenges/${challenge.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deleteThread,
          revokePoints,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete challenge");
      }

      // Success!
      onSuccess(challenge.id);
      onClose();
    } catch (err) {
      console.error("Delete failed:", err);
      setError(err.message);
      setIsDeleting(false);
    }
  };

  return (
    <div className="delete-modal-overlay">
      <div className="delete-modal-content">
        <h2 className="delete-modal-title">🗑️ Delete Challenge?</h2>

        <div className="challenge-summary">
          <h3>{challenge.title}</h3>
          <p>ID: #{challenge.id}</p>
        </div>

        <p className="warning-text">
          This will permanently delete the challenge, all{" "}
          <strong>submissions</strong>, and all <strong>votes</strong>.
        </p>

        <div className="checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              className="checkbox-input"
              checked={deleteThread}
              onChange={(e) => setDeleteThread(e.target.checked)}
            />
            <div className="checkbox-text">
              <span className="checkbox-title">Delete Discord Thread</span>
              <span className="checkbox-desc">
                Removes the thread and all submission messages from Discord.
              </span>
            </div>
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              className="checkbox-input"
              checked={revokePoints}
              onChange={(e) => setRevokePoints(e.target.checked)}
            />
            <div className="checkbox-text">
              <span className="checkbox-title">Revoke Points</span>
              <span className="checkbox-desc">
                Subtracts any points users earned from this challenge (Winner
                Bonuses + Votes).
              </span>
            </div>
          </label>
        </div>

        {error && <div className="error-msg">⚠️ {error}</div>}

        <div className="modal-actions">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="cancel-btn"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="delete-confirm-btn"
          >
            {isDeleting ? (
              <>
                <span className="spinner"></span>
                Deleting...
              </>
            ) : (
              "Confirm Delete"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
