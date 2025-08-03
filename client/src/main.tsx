import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { loadOneSignalScript } from "@/lib/onesignal";

// Load OneSignal for push notifications
loadOneSignalScript();

createRoot(document.getElementById("root")!).render(<App />);
