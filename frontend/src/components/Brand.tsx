import { Link } from "react-router-dom";

export function Brand() {
  return <Link to="/" className="collection-brand" aria-label="Blaze — Trang chủ">
    <img className="collection-logo" src="/brand/blaze-logo.png" width="36" height="36" alt="" />
    <span className="collection-wordmark">Blaze</span>
  </Link>;
}
