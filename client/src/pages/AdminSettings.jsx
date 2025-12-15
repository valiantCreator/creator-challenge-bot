// client/src/pages/AdminSettings.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast"; // Gemini: Import toast
import api from "../api";
import "./AdminSettings.css";

function AdminSettings() {
  const [activeTab, setActiveTab] = useState("general");
  const [loading, setLoading] = useState(true);

  // General Settings State
  const [settings, setSettings] = useState({
    points_per_submission: 0,
    points_per_vote: 0,
    vote_emoji: "👍",
  });
  // Gemini: Removed saveStatus state, using toast instead

  // Badge Settings State
  const [badges, setBadges] = useState([]);
  const [roles, setRoles] = useState([]);
  const [newBadge, setNewBadge] = useState({ roleId: "", pointsRequired: "" });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [settingsRes, badgesRes, rolesRes] = await Promise.all([
        api.get("/api/admin/settings"),
        api.get("/api/admin/badges"),
        api.get("/api/admin/roles"),
      ]);

      setSettings(settingsRes.data);
      setBadges(badgesRes.data);
      setRoles(rolesRes.data);
      setLoading(false);
    } catch (error) {
      console.error("Failed to load settings:", error);
      toast.error("Failed to load settings.");
      setLoading(false);
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
      </div>

      <div className="settings-content">
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
                maxLength="4" // Allow for unicode emojis
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
      </div>
    </div>
  );
}

export default AdminSettings;
