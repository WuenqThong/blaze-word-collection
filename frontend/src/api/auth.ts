import { apiClient } from "./client";
import type { User } from "../lib/types";

export interface RegisterPayload {
  email: string;
  full_name: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

interface AuthResponse {
  user: User;
}

export const authApi = {
  async register(payload: RegisterPayload): Promise<User> {
    const { data } = await apiClient.post<AuthResponse>("/auth/register", payload);
    return data.user;
  },
  async login(payload: LoginPayload): Promise<User> {
    const { data } = await apiClient.post<AuthResponse>("/auth/login", payload);
    return data.user;
  },
  async logout(): Promise<void> {
    await apiClient.post("/auth/logout");
  },
  async updateMe(payload: { full_name: string }): Promise<User> {
    const { data } = await apiClient.patch<User>("/auth/me", payload);
    return data;
  },
  async changePassword(payload: { current_password: string; new_password: string }): Promise<void> {
    await apiClient.post("/auth/password", payload);
  },
  async me(): Promise<User> {
    const { data } = await apiClient.get<User>("/auth/me");
    return data;
  },
};
