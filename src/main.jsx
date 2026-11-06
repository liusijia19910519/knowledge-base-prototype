import React from "react";
import { createRoot } from "react-dom/client";
import { KnowledgeApp } from "./kb/KnowledgeApp.jsx";
import "./kb/kb.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <KnowledgeApp />
  </React.StrictMode>,
);
