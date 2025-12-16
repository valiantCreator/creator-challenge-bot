// client/src/components/SubmissionDetailModal.jsx
import "./SubmissionDetailModal.css";

function SubmissionDetailModal({
  submission,
  user,
  onClose,
  onVote,
  onEdit,
  onDelete,
  onCrown,
  challengeIsActive,
}) {
  if (!submission) return null;

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <button className="lightbox-close" onClick={onClose}>
          &times;
        </button>

        <div className="lightbox-layout">
          {/* Left Column: Media */}
          <div className="lightbox-media">
            {submission.attachment_url ? (
              <img src={submission.attachment_url} alt="Full Submission" />
            ) : (
              <div className="lightbox-no-media">No Image</div>
            )}
          </div>

          {/* Right Column: Details */}
          <div className="lightbox-details">
            <div className="lightbox-header">
              <h3>Submission #{submission.id}</h3>
              <span className="author">by {submission.username}</span>
            </div>

            <div className="lightbox-body">
              {submission.content_text && (
                <p className="caption">"{submission.content_text}"</p>
              )}

              {submission.link_url && (
                <a
                  href={submission.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="external-link"
                >
                  🔗 {submission.link_url}
                </a>
              )}
            </div>

            <div className="lightbox-footer">
              <div className="vote-area">
                <span className="vote-count">👍 {submission.votes} Votes</span>
                {user && (
                  <button
                    className={`vote-btn-large ${
                      user.id === submission.user_id ? "disabled" : ""
                    }`}
                    onClick={() => onVote(submission.id)}
                    disabled={user.id === submission.user_id}
                  >
                    {user.id === submission.user_id
                      ? "Your Submission"
                      : "Vote This Entry"}
                  </button>
                )}
              </div>

              <div className="action-row">
                {/* User Edit */}
                {user && user.id === submission.user_id && (
                  <button
                    className="action-btn edit"
                    onClick={() => onEdit(submission)}
                  >
                    ✏️ Edit
                  </button>
                )}

                {/* Admin Actions */}
                {user && user.isAdmin && (
                  <>
                    {challengeIsActive && (
                      <button
                        className="action-btn crown"
                        onClick={() => onCrown(submission)}
                      >
                        👑 Crown
                      </button>
                    )}
                    <button
                      className="action-btn delete"
                      onClick={() => onDelete(submission.id)}
                    >
                      🗑️ Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SubmissionDetailModal;
