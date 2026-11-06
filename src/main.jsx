import React from "react";
import { createRoot } from "react-dom/client";
import { KnowledgeCenterPage, StandaloneDocumentPage } from "./App.jsx";
import "./styles.css";
import "./knowledge-product.css";

function openDocument(name) {
  const url = new URL(window.location.href);
  url.searchParams.set("document", name);
  window.location.assign(url.toString());
}

function KnowledgeProduct() {
  const documentName = new URLSearchParams(window.location.search).get("document");
  if (documentName) {
    return (
      <div className="knowledge-doc-shell">
        <a className="knowledge-doc-back" href="./">返回知识库</a>
        <StandaloneDocumentPage name={documentName} />
      </div>
    );
  }
  return (
    <div className="knowledge-product">
      <KnowledgeCenterPage productTitle="知识库" enablePlaza enableCreate onOpenDocument={openDocument} />
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <KnowledgeProduct />
  </React.StrictMode>,
);
