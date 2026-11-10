import { Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { ErrorPage } from "../pages/ErrorPage";
export function ReviewerRoute(){const {user}=useAuth();return user?.role === "admin" || user?.role === "reviewer" ? <Outlet/> : <ErrorPage code={403}/>;}
