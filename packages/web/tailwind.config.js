export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#60A5FA",
        emerald: "#10B981",
        teal: "#14B8A6",
        cyan: "#22D3EE",
        purple: "#A78BFA",
        gold: "#F59E0B",
        coral: "#F97316",
        red: "#EF4444",
        navy: "#102A43",
        background: "#F5F8FA",
        surface: "#FFFFFF",
        text: "#17212B",
        muted: "#667085",
        border: "#E1E8EF",
      },
      boxShadow: {
        soft: "0 20px 60px rgba(16, 42, 67, 0.08)",
      },
    },
  },
  plugins: [],
};
