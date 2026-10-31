import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./studio.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
// Cache the app and the piano samples so a returning visit plays offline.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // The app works without offline support.
    });
  });
}
