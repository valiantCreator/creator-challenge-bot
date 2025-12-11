// client/src/components/CreateChallengeModal.jsx
import { useState, useEffect } from "react";
import api from "../api";
import "./CreateChallengeModal.css";

function CreateChallengeModal({ user, onClose, onSuccess }) {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "Creative",
    channelId: "",
    schedule: "",
    endsAt: "",
  });

  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const res = await api.get("/api/admin/channels");
        setChannels(res.data);
        if (res.data.length > 0) {
          setFormData((prev) => ({ ...prev, channelId: res.data[0].id }));
        }
      } catch (err) {
        console.error("Failed to fetch channels:", err);
        setError("Could not load channels.");
      } finally {
        setLoading(false);
      }
    };
    fetchChannels();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = { ...formData };
      if (!payload.schedule.trim()) delete payload.schedule;
      if (!payload.endsAt) delete payload.endsAt;

      const res = await api.post("/api/admin/challenges", payload);

      if (res.data.success) {
        onSuccess(); // Refresh parent
        onClose(); // Close modal
      }
    } catch (err) {
      console.error("Creation Error:", err);
      setError(err.response?.data?.error || "Failed to create challenge.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h3>🛠️ Create New Challenge</h3>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </header>

        {loading ? (
          <div className="modal-loading">Loading options...</div>
        ) : (
          <form onSubmit={handleSubmit} className="modal-form">
            {error && <div className="modal-error">{error}</div>}

            <div className="form-group">
              <label>Title</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                autoFocus
                placeholder="e.g. Weekly Design Sprint"
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
                rows="3"
                placeholder="Describe the rules..."
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Type</label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                >
                  <option value="Creative">Creative</option>
                  <option value="Technical">Technical</option>
                  <option value="Writing">Writing</option>
                  <option value="Fun">Fun</option>
                </select>
              </div>

              <div className="form-group">
                <label>Post In Channel</label>
                <select
                  name="channelId"
                  value={formData.channelId}
                  onChange={handleChange}
                  required
                >
                  {channels.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      #{ch.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-divider" />

            <div className="form-row">
              <div className="form-group">
                <label>End Date (Optional)</label>
                <input
                  type="date"
                  name="endsAt"
                  value={formData.endsAt}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Cron Schedule (Optional)</label>
                <input
                  type="text"
                  name="schedule"
                  value={formData.schedule}
                  onChange={handleChange}
                  placeholder="0 10 * * 1"
                />
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="cancel-btn"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="submit-btn"
                disabled={submitting}
              >
                {submitting ? "Creating..." : "Launch Challenge 🚀"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default CreateChallengeModal;
