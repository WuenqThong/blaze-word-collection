import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./styles/theme.css";
// Keep the package's unicode ranges so Latin letters and Vietnamese marks use
// the right Inter subset instead of falling back to different font metrics.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import { router } from "./router";
import { ConfirmProvider } from "./components/ConfirmProvider";
import "./styles/collection.css";
import "./styles/dialect.css";
import "./styles/demo.css";
import "./styles/blaze-workspace.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
      <ConfirmProvider>
        <RouterProvider router={router} />
      </ConfirmProvider>
  </StrictMode>,
);
