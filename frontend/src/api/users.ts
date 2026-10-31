import { apiClient } from "./client";
import type { User } from "../lib/types";

export const usersApi = {
  async search(q?: string, role?: string): Promise<User[]> {
    const { data } = await apiClient.get<User[]>("/users", { params: { q, role } });
    return data;
  },
};
