export type Role = "admin" | "annotator" | "reviewer";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  created_at: string;
  last_login_at: string | null;
}

export interface ApiError {
  detail: string;
}
