import { Navigate, useLocation } from "react-router-dom";

/** Older entry URLs share the current contribution form, including parent links. */
export function ContributionEntry() {
  const {search}=useLocation();
  const params=new URLSearchParams(search);
  const parent=params.get("parent");
  if(parent && /^\d+$/.test(parent)) params.set("parent",`c:${parent}`);
  return <Navigate to={`/demo/contribute${params.size ? `?${params}` : ""}`} replace/>;
}
