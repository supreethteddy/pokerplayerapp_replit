import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ClerkWrapper } from "./clerk";

createRoot(document.getElementById("root")!).render(
  <ClerkWrapper>
    <App />
  </ClerkWrapper>
);
