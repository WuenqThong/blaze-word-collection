import { createBrowserRouter, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import { LoginPage } from "./features/auth/LoginPage";
import { RegisterPage } from "./features/auth/RegisterPage";

import { PublicLayout, LandingPage, AboutDataPage } from "./features/dialect/PublicPages";
import { ContributionWizard } from "./features/dialect/ContributionWizard";
import { ContributionsPage, ContributionDetailPage, DialectProfilePage } from "./features/dialect/ContributionPages";
import { DialectDashboard, DialectReviewPage, SourcesPage, DatasetsPage, ParticipantsPage, LegacyPage } from "./features/dialect/AdminPages";
import { ErrorPage } from "./pages/ErrorPage";
import { ReviewerRoute } from "./components/ReviewerRoute";
import { AuthProvider } from "./features/auth/AuthContext";
import { demoRoute } from "./features/demo/routes";
export const router = createBrowserRouter([
  // Auth pages full-screen, không dùng Layout
  { path: "/login", element: <AuthProvider><LoginPage /></AuthProvider> },
  { path: "/register", element: <AuthProvider><RegisterPage /></AuthProvider> },
  { path: "/", element: <Navigate to="/demo" replace/> },
  { path: "/play", element: <Navigate to="/demo/play" replace/> },
  demoRoute,

  {path: "/collection", element: <AuthProvider><PublicLayout /></AuthProvider>, children: [{index:true, element:<LandingPage/>}]},
  {path: "/about-data", element: <AuthProvider><PublicLayout /></AuthProvider>, children: [{index:true, element:<AboutDataPage/>}]},
  {
    path: "/",
    element: <AuthProvider><Layout /></AuthProvider>,
    children: [

      {
        element: <ProtectedRoute />,
        children: [
          { path: "dashboard", element: <DialectDashboard /> },
          { path: "legacy/audio", lazy: async () => ({Component:(await import("./pages/DashboardPage")).DashboardPage}) },
          { path: "legacy", element: <LegacyPage /> },
          { path: "legacy/settings", lazy: async () => ({Component:(await import("./pages/SettingsPage")).SettingsPage}) },
          { path: "contribute", element: <Navigate to="/contribute/new" replace /> },
          { path: "contribute/new", element: <ContributionWizard /> },
          { path: "my/contributions", element: <ContributionsPage /> },
          { path: "my/contributions/:id", element: <ContributionDetailPage /> },
          { element: <ReviewerRoute />, children: [{path:"review",element:<DialectReviewPage/>}] },
          { path: "rewards", lazy: async () => ({Component:(await import("./pages/RewardsPage")).RewardsPage}) },
          { path: "history", lazy: async () => ({Component:(await import("./pages/HistoryPage")).HistoryPage}) },
          { path: "settings", element: <DialectProfilePage /> },
          { path: "withdrawals", lazy: async () => ({Component:(await import("./pages/WithdrawalsPage")).WithdrawalsPage}) },
          { path: "projects", lazy: async () => ({Component:(await import("./features/projects/ProjectsListPage")).ProjectsListPage}) },
          { path: "projects/:id", lazy: async () => ({Component:(await import("./features/projects/ProjectDetailPage")).ProjectDetailPage}) },
          { path: "projects/:id/annotate", lazy: async () => ({Component:(await import("./features/annotate/AnnotatePage")).AnnotatePage}) },
          { path: "roleplay", lazy: async () => ({Component:(await import("./features/roleplay/RolePlayListPage")).RolePlayListPage}) },
          { path: "roleplay/history", lazy: async () => ({Component:(await import("./features/roleplay/RolePlayHistoryPage")).RolePlayHistoryPage}) },
          { path: "roleplay/:id", lazy: async () => ({Component:(await import("./features/roleplay/RolePlaySessionPage")).RolePlaySessionPage}) },
          {
            element: <AdminRoute />,
            children: [
              {path:"admin/contributions",element:<ContributionsPage admin/>},
              {path:"admin/disputes",element:<DialectReviewPage disputes/>},
              {path:"admin/sources",element:<SourcesPage/>},
              {path:"admin/datasets",element:<DatasetsPage/>},
              {path:"admin/participants",element:<ParticipantsPage/>},
              { path: "projects/new", lazy: async () => ({Component:(await import("./features/projects/NewProjectPage")).NewProjectPage}) },
              { path: "admin/review", lazy: async () => ({Component:(await import("./features/admin/ReviewQueuePage")).ReviewQueuePage}) },
              { path: "admin/flagged", lazy: async () => ({Component:(await import("./features/admin/FlaggedUsersPage")).FlaggedUsersPage}) },
              { path: "admin/withdrawals", lazy: async () => ({Component:(await import("./features/admin/WithdrawalsAdminPage")).WithdrawalsAdminPage}) },
              { path: "admin/reports", lazy: async () => ({Component:(await import("./features/admin/ReportsAdminPage")).ReportsAdminPage}) },
            ],
          },
        ],
      },
      { path: "*", element: <ErrorPage /> },
    ],
  },
]);
