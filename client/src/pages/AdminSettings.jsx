// client/src/pages/AdminSettings.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import cronstrue from "cronstrue"; // Gemini: Import cron parser
import api from "../api";
import "./AdminSettings.css";

function AdminSettings() {
  const [activeTab, setActiveTab] = useState("general");
  const [loading, setLoading] = useState(true);

  // Settings State
  const [settings, setSettings] = useState({
    points_per_submission: 0,
    points_per_vote: 0,
    vote_emoji: "👍",
  });

  // Badge State
  const [badges, setBadges] = useState([]);
  const [roles, setRoles] = useState([]);
  const [newBadge, setNewBadge] = useState({ roleId: "", pointsRequired: "" });

  // Template State
  const [templates, setTemplates] = useState([]);
  const [channels, setChannels] = useState([]); // Gemini: Store channels map
  const [expandedTemplate, setExpandedTemplate] = useState(null); // Gemini: Accordion state

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [settingsRes, badgesRes, rolesRes, templatesRes, channelsRes] =
        await Promise.all([
          api.get("/api/admin/settings"),
          api.get("/api/admin/badges"),
          api.get("/api/admin/roles"),
          api.get("/api/admin/templates"),
          api.get("/api/admin/channels"), // Gemini: Fetch channels for lookup
        ]);

      setSettings(settingsRes.data);
      setBadges(badgesRes.data);
      setRoles(rolesRes.data);
      setTemplates(templatesRes.data);
      setChannels(channelsRes.data);
      setLoading(false);
    } catch (error) {
      console.error("Failed to load settings:", error);
      toast.error("Failed to load settings.");
      setLoading(false);
    }
  };

  // --- Helper: Get Channel Name ---
  const getChannelName = (id) => {
    const ch = channels.find((c) => c.id === id);
    return ch ? `#${ch.name}` : id;
  };

  // --- Helper: Human Readable Cron ---
  const formatSchedule = (cron) => {
    try {
      let human = cronstrue.toString(cron, { verbose: true });

      // Clean up redundancy
      if (human.includes(", every day")) {
        human = human.replace(", every day", "");
        return `Daily ${human.charAt(0).toLowerCase() + human.slice(1)}`;
      }

      // Handle standard "At X" case
      if (human.startsWith("At ")) {
        return `Daily ${human.charAt(0).toLowerCase() + human.slice(1)}`;
      }

      return human;
    } catch (e) {
      return cron;
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    const loadingToast = toast.loading("Saving settings...");
    try {
      await api.post("/api/admin/settings", settings);
      toast.success("Settings saved!", { id: loadingToast });
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Error saving settings.", { id: loadingToast });
    }
  };

  const handleAddBadge = async (e) => {
    e.preventDefault();
    if (!newBadge.roleId || !newBadge.pointsRequired) return;

    try {
      await api.post("/api/admin/badges", newBadge);
      // Refresh badges list
      const res = await api.get("/api/admin/badges");
      setBadges(res.data);
      setNewBadge({ roleId: "", pointsRequired: "" });
      toast.success("Badge added!");
    } catch (error) {
      console.error("Failed to add badge:", error);
      toast.error("Failed to add badge.");
    }
  };

  const handleDeleteBadge = async (id) => {
    if (!window.confirm("Are you sure you want to remove this badge?")) return;
    try {
      await api.delete(`/api/admin/badges/${id}`);
      setBadges(badges.filter((b) => b.id !== id));
      toast.success("Badge removed.");
    } catch (error) {
      console.error("Failed to delete badge:", error);
      toast.error("Failed to delete badge.");
    }
  };

  const handleDeleteTemplate = async (id, e) => {
    e.stopPropagation(); // Prevent accordion toggle
    if (
      !window.confirm(
        "Are you sure? This will stop future challenges from spawning."
      )
    )
      return;
    try {
      await api.delete(`/api/admin/templates/${id}`);
      setTemplates(templates.filter((t) => t.id !== id));
      toast.success("Schedule cancelled.");
    } catch (error) {
      console.error("Failed to delete template:", error);
      toast.error("Failed to cancel schedule.");
    }
  };

  if (loading) return <div className="loading">Loading Settings...</div>;

  return (
    <div className="settings-page">
      <header className="settings-header">
        <div className="header-left">
          <Link to="/" className="back-link">
            ← Back to Dashboard
          </Link>
          <h1>⚙️ Admin Control Center</h1>
        </div>
      </header>

      <div className="settings-tabs">
        <button
          className={activeTab === "general" ? "active" : ""}
          onClick={() => setActiveTab("general")}
        >
          General Config
        </button>
        <button
          className={activeTab === "badges" ? "active" : ""}
          onClick={() => setActiveTab("badges")}
        >
          Badge Roles
        </button>
        <button
          className={activeTab === "schedules" ? "active" : ""}
          onClick={() => setActiveTab("schedules")}
        >
          Schedules
        </button>
      </div>

      <div className="settings-content">
        {/* --- GENERAL TAB --- */}
        {activeTab === "general" && (
          <form onSubmit={handleSaveSettings} className="general-form">
            <div className="form-group">
              <label>Points per Submission</label>
              <input
                type="number"
                value={settings.points_per_submission}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    points_per_submission: e.target.value,
                  })
                }
                min="0"
              />
              <p className="help-text">
                Points awarded automatically for posting.
              </p>
            </div>

            <div className="form-group">
              <label>Points per Vote</label>
              <input
                type="number"
                value={settings.points_per_vote}
                onChange={(e) =>
                  setSettings({ ...settings, points_per_vote: e.target.value })
                }
                min="0"
              />
              <p className="help-text">
                Points awarded when a user receives a vote.
              </p>
            </div>

            <div className="form-group">
              <label>Vote Emoji</label>
              <input
                type="text"
                value={settings.vote_emoji}
                onChange={(e) =>
                  setSettings({ ...settings, vote_emoji: e.target.value })
                }
                maxLength="4"
              />
              <p className="help-text">
                The emoji users click to vote (e.g., 👍, 🔥).
              </p>
            </div>

            <div className="form-actions">
              <button type="submit" className="save-btn">
                Save Changes
              </button>
            </div>
          </form>
        )}

        {/* --- BADGES TAB --- */}
        {activeTab === "badges" && (
          <div className="badges-section">
            <div className="badges-list">
              <h3>Current Milestones</h3>
              {badges.length === 0 ? (
                <p className="empty-text">No badge roles configured.</p>
              ) : (
                badges.map((badge) => (
                  <div key={badge.id} className="badge-item">
                    <div className="badge-info">
                      <span
                        className="role-pill"
                        style={{
                          borderColor: badge.roleColor,
                          color:
                            badge.roleColor === "#000000"
                              ? "#fff"
                              : badge.roleColor,
                        }}
                      >
                        @{badge.roleName}
                      </span>
                      <span className="points-req">
                        Requires <strong>{badge.points_required}</strong> pts
                      </span>
                    </div>
                    <button
                      className="delete-icon-btn"
                      onClick={() => handleDeleteBadge(badge.id)}
                      title="Remove Badge"
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="add-badge-form">
              <h3>Add New Milestone</h3>
              <form onSubmit={handleAddBadge}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Discord Role</label>
                    <select
                      value={newBadge.roleId}
                      onChange={(e) =>
                        setNewBadge({ ...newBadge, roleId: e.target.value })
                      }
                      required
                    >
                      <option value="">Select a Role...</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Points Required</label>
                    <input
                      type="number"
                      value={newBadge.pointsRequired}
                      onChange={(e) =>
                        setNewBadge({
                          ...newBadge,
                          pointsRequired: e.target.value,
                        })
                      }
                      placeholder="e.g. 1000"
                      min="1"
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="add-btn">
                  + Add Badge
                </button>
              </form>
            </div>
          </div>
        )}

        {/* --- SCHEDULES TAB --- */}
        {activeTab === "schedules" && (
          <div className="schedules-section">
            <h3>Active Recurring Schedules</h3>
            {templates.length === 0 ? (
              <p className="empty-text">No recurring challenges scheduled.</p>
            ) : (
              <div className="templates-list">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className={`template-item ${
                      expandedTemplate === template.id ? "expanded" : ""
                    }`}
                    onClick={() =>
                      setExpandedTemplate(
                        expandedTemplate === template.id ? null : template.id
                      )
                    }
                  >
                    <div className="template-header">
                      <div className="template-main-info">
                        <span className="arrow-icon">▶</span>
                        <div className="template-text">
                          <span className="template-title">
                            {template.title}
                          </span>
                          <span className="template-schedule">
                            {formatSchedule(template.cron_schedule)}
                          </span>
                        </div>
                      </div>

                      <button
                        className="delete-icon-btn"
                        onClick={(e) => handleDeleteTemplate(template.id, e)}
                        title="Cancel Schedule"
                      >
                        🗑️
                      </button>
                    </div>

                    {/* Expandable Details */}
                    {expandedTemplate === template.id && (
                      <div className="template-details">
                        <div className="detail-row">
                          <span className="label">Type:</span> {template.type}
                        </div>
                        <div className="detail-row">
                          <span className="label">Channel:</span>{" "}
                          {getChannelName(template.channel_id)}
                        </div>
                        <div className="detail-row">
                          <span className="label">Description:</span>
                          <p>{template.description}</p>
                        </div>
                        <div className="detail-row">
                          <span className="label">Raw Cron:</span>{" "}
                          <code>{template.cron_schedule}</code>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminSettings;
