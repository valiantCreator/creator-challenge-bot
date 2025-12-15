// client/src/components/admin/PickWinnerModal.jsx
import { useState } from "react";
import toast from "react-hot-toast"; // Gemini: Import toast
import api from "../../api";
import "./PickWinnerModal.css";

function PickWinnerModal({ submission, challengeId, onClose, onSuccess }) {
  const [bonusPoints, setBonusPoints] = useState(500);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await api.post(`/api/admin/challenges/${challengeId}/winner`, {
        submissionId: submission.id,
        bonusPoints: parseInt(bonusPoints),
      });
      toast.success("Winner Announced! Challenge Closed."); // Gemini: Toast
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to pick winner:", error);
      toast.error("Failed to process winner selection."); // Gemini: Toast
      setIsSubmitting(false);
    }
  };

  return (
    <div className="winner-modal-overlay" onClick={onClose}>
      <div
        className="winner-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="winner-header">
          <h2>👑 Crown Winner</h2>
          <p>This will close the challenge and announce the winner.</p>
        </div>

        <div className="winner-preview">
          <div className="winner-info">
            <div className="winner-name">{submission.username}</div>
            <div style={{ fontSize: "0.85rem", color: "#888" }}>
              Submission #{submission.id}
            </div>
          </div>
        </div>

        <div className="form-group">
          <label>Bonus Points Award</label>
          <input
            type="number"
            value={bonusPoints}
            onChange={(e) => setBonusPoints(e.target.value)}
            min="0"
          />
        </div>

        <div className="modal-actions">
          <button className="cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="confirm-btn"
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Crowning..." : "Confirm Winner"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PickWinnerModal;
