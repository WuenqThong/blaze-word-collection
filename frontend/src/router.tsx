import { createBrowserRouter, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import { LoginPage } from "./features/auth/LoginPage";
import { RegisterPage } from "./features/auth/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ProjectsListPage } from "./features/projects/ProjectsListPage";
import { ProjectDetailPage } from "./features/projects/ProjectDetailPage";
import { NewProjectPage } from "./features/projects/NewProjectPage";
import { AnnotatePage } from "./features/annotate/AnnotatePage";
import { ReviewQueuePage } from "./features/admin/ReviewQueuePage";
import { FlaggedUsersPage } from "./features/admin/FlaggedUsersPage";
import { RewardsPage } from "./pages/RewardsPage";
import { HistoryPage } from "./pages/HistoryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { WithdrawalsPage } from "./pages/WithdrawalsPage";
import { WithdrawalsAdminPage } from "./features/admin/WithdrawalsAdminPage";
import { ReportsAdminPage } from "./features/admin/ReportsAdminPage";
import { RolePlayListPage } from "./features/roleplay/RolePlayListPage";
import { RolePlaySessionPage } from "./features/roleplay/RolePlaySessionPage";
import { RolePlayHistoryPage } from "./features/roleplay/RolePlayHistoryPage";

export const router = createBrowserRouter([
  // Auth pages full-screen, không dùng Layout
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },

  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: "dashboard", element: <DashboardPage /> },
          { path: "rewards", element: <RewardsPage /> },
          { path: "history", element: <HistoryPage /> },
          { path: "settings", element: <SettingsPage /> },
          { path: "withdrawals", element: <WithdrawalsPage /> },
          { path: "projects", element: <ProjectsListPage /> },
          { path: "projects/:id", element: <ProjectDetailPage /> },
          { path: "projects/:id/annotate", element: <AnnotatePage /> },
          { path: "roleplay", element: <RolePlayListPage /> },
          { path: "roleplay/history", element: <RolePlayHistoryPage /> },
          { path: "roleplay/:id", element: <RolePlaySessionPage /> },
          {
            element: <AdminRoute />,
            children: [
              { path: "projects/new", element: <NewProjectPage /> },
              { path: "admin/review", element: <ReviewQueuePage /> },
              { path: "admin/flagged", element: <FlaggedUsersPage /> },
              { path: "admin/withdrawals", element: <WithdrawalsAdminPage /> },
              { path: "admin/reports", element: <ReportsAdminPage /> },
            ],
          },
        ],
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
