// client/src/api.js
import axios from "axios";

// Create an axios instance
const api = axios.create({
  // Gemini: No baseURL needed for Single Origin deployment.
  // It defaults to the current domain, so requests go to /api/... relative to the site.
  withCredentials: true,
});

export default api;
