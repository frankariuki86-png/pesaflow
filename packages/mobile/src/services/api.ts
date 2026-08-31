import axios from "axios";

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:4000/api";

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: { "Content-Type": "application/json" },
  timeout: 8000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.warn("Unable to connect to PesaFlow server.");
    return Promise.reject(error);
  },
);

export default api;
