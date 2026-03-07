import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { Toaster } from "./components/ui/sonner";
import "./styles.css";

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("Missing root element");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
    <Toaster />
  </React.StrictMode>,
);
