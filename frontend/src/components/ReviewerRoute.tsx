import { Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { ErrorPage } from "../pages/ErrorPage";
export function ReviewerRoute(){const {user}=useAuth();return ["admin", "reviewer"].includes(user?.role ?? "") || user?.role === "reviewer" ? <Outlet/> : <ErrorPage code={403}/>;}
