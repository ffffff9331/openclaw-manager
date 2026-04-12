import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

function removeBootScreen() {
  document.getElementById("app-boot")?.remove();
}

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

window.requestAnimationFrame(removeBootScreen);
window.setTimeout(removeBootScreen, 300);
