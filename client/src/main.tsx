import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Disable StrictMode to prevent double rendering in development
createRoot(document.getElementById("root")!).render(<App />);
