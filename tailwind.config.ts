import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {
    colors: { ink: "#132B2D", muted: "#637577", line: "#DDE6E5", canvas: "#F5F8F7", teal: { 50:"#EAF7F5",100:"#D4F0EC",500:"#2A8C82",600:"#1E776F",700:"#175F59",900:"#123E3A" } },
    boxShadow: { card: "0 1px 2px rgba(17,49,48,.04), 0 8px 24px rgba(17,49,48,.05)" },
    fontFamily: { sans: ["Manrope", "Inter", "ui-sans-serif", "system-ui", "sans-serif"] }
  }}, plugins: []
} satisfies Config;
