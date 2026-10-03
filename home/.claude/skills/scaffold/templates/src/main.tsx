import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import "./mobile.css"
import { App } from "./App"
import { UpdateNotice } from "./components/UpdateNotice"
import { preventPageZoom } from "./lib/preventPageZoom"

preventPageZoom()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <UpdateNotice />
  </StrictMode>,
)
