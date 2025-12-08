// client/src/api.js
import axios from "axios";

// Create an axios instance with the base URL configured
const api = axios.create({
  // If VITE_API_URL is set (on Render), use it.
  // Otherwise (on localhost), use empty string '' which lets the Vite proxy handle it.
  baseURL: import.meta.env.VITE_API_URL || "",
  withCredentials: true, // Crucial for cookies/sessions to work across subdomains
});

export default api;
