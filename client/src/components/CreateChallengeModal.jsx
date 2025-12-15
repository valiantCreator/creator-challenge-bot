// client/src/components/CreateChallengeModal.jsx
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import api from "../api";
import "./CreateChallengeModal.css";

function CreateChallengeModal({ user, onClose, onSuccess }) {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Tab State: 'one-time' or 'recurring'
  const [activeTab, setActiveTab] = useState("one-time");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "Creative",
    channelId: "",
    endsAt: "",
  });

  const [scheduleConfig, setScheduleConfig] = useState({
    frequency: "weekly",
    dayOfWeek: "1",
    dayOfMonth: "1",
    time: "10:00",
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

  const handleScheduleChange = (e) => {
    const { name, value } = e.target;
    setScheduleConfig((prev) => ({ ...prev, [name]: value }));
  };

  const generateCron = () => {
    if (activeTab !== "recurring") return "";
    const [hour, minute] = scheduleConfig.time.split(":");
    if (scheduleConfig.frequency === "daily") return `${minute} ${hour} * * *`;
    if (scheduleConfig.frequency === "weekly")
      return `${minute} ${hour} * * ${scheduleConfig.dayOfWeek}`;
    if (scheduleConfig.frequency === "monthly")
      return `${minute} ${hour} ${scheduleConfig.dayOfMonth} * *`;
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = { ...formData };

      if (activeTab === "recurring") {
        payload.schedule = generateCron();
        delete payload.endsAt;
      } else {
        if (!payload.endsAt) delete payload.endsAt;
      }

      const res = await api.post("/api/admin/challenges", payload);
      if (res.data.success) {
        toast.success("Challenge Created Successfully! 🚀"); // Gemini: Toast
        onSuccess(); // Refresh parent
        onClose(); // Close modal
      }
    } catch (err) {
      console.error("Creation Error:", err);
      const msg = err.response?.data?.error || "Failed to create challenge.";
      setError(msg);
      toast.error(msg);
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

            {/* --- Shared Fields --- */}
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

            {/* --- Scheduling Tabs --- */}
            <div className="schedule-tabs">
              <button
                type="button"
                className={`tab-btn ${
                  activeTab === "one-time" ? "active" : ""
                }`}
                onClick={() => setActiveTab("one-time")}
              >
                📅 One-Time
              </button>
              <button
                type="button"
                className={`tab-btn ${
                  activeTab === "recurring" ? "active" : ""
                }`}
                onClick={() => setActiveTab("recurring")}
              >
                🔄 Recurring
              </button>
              {/* Sliding Indicator Background handled via CSS sibling selector logic or absolute div if needed, 
                  but active class styling is simpler and robust */}
            </div>

            {/* --- Tab Content --- */}
            <div className="tab-content-container">
              {activeTab === "one-time" && (
                <div className="tab-pane fade-in">
                  <div className="form-group">
                    <label>End Date (Optional)</label>
                    <input
                      type="date"
                      name="endsAt"
                      value={formData.endsAt}
                      onChange={handleChange}
                    />
                    <p className="hint-text">Leave blank for open-ended.</p>
                  </div>
                </div>
              )}

              {activeTab === "recurring" && (
                <div className="tab-pane fade-in">
                  <div className="scheduler-box">
                    <div className="form-row">
                      <div className="form-group">
                        <label>Frequency</label>
                        <select
                          name="frequency"
                          value={scheduleConfig.frequency}
                          onChange={handleScheduleChange}
                        >
                          <option value="weekly">Weekly</option>
                          <option value="daily">Daily</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Time (UTC)</label>
                        <input
                          type="time"
                          name="time"
                          value={scheduleConfig.time}
                          onChange={handleScheduleChange}
                          required
                        />
                      </div>
                    </div>

                    {scheduleConfig.frequency === "weekly" && (
                      <div className="form-group">
                        <label>Day of Week</label>
                        <select
                          name="dayOfWeek"
                          value={scheduleConfig.dayOfWeek}
                          onChange={handleScheduleChange}
                        >
                          <option value="1">Monday</option>
                          <option value="2">Tuesday</option>
                          <option value="3">Wednesday</option>
                          <option value="4">Thursday</option>
                          <option value="5">Friday</option>
                          <option value="6">Saturday</option>
                          <option value="0">Sunday</option>
                        </select>
                      </div>
                    )}

                    {scheduleConfig.frequency === "monthly" && (
                      <div className="form-group">
                        <label>Day of Month (1-31)</label>
                        <input
                          type="number"
                          name="dayOfMonth"
                          value={scheduleConfig.dayOfMonth}
                          onChange={handleScheduleChange}
                          min="1"
                          max="31"
                        />
                      </div>
                    )}

                    <div className="cron-preview">
                      Generates: <code>{generateCron()}</code>
                    </div>
                  </div>
                </div>
              )}
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
                {submitting
                  ? "Creating..."
                  : activeTab === "recurring"
                  ? "Schedule Template"
                  : "Launch Challenge 🚀"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default CreateChallengeModal;
