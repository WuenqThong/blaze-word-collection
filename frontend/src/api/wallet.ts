import { apiClient } from "./client";
import type {
  UserProfile,
  ProfileUpdatePayload,
  WalletSummary,
  Withdrawal,
} from "../lib/walletTypes";

export const walletApi = {
  // Profile
  async getProfile(): Promise<UserProfile> {
    const { data } = await apiClient.get<UserProfile>("/me/profile");
    return data;
  },
  async updateProfile(payload: ProfileUpdatePayload): Promise<UserProfile> {
    const { data } = await apiClient.patch<UserProfile>("/me/profile", payload);
    return data;
  },

  // Wallet
  async getWallet(): Promise<WalletSummary> {
    const { data } = await apiClient.get<WalletSummary>("/me/wallet");
    return data;
  },

  // Withdrawals
  async listMine(): Promise<{ items: Withdrawal[]; total: number }> {
    const { data } = await apiClient.get<{ items: Withdrawal[]; total: number }>("/me/withdrawals");
    return data;
  },
  async request(amount_points: number, note?: string): Promise<Withdrawal> {
    const { data } = await apiClient.post<Withdrawal>("/me/withdrawals", { amount_points, note });
    return data;
  },

  // Admin
  async adminList(status?: string): Promise<{ items: Withdrawal[]; total: number }> {
    const { data } = await apiClient.get<{ items: Withdrawal[]; total: number }>("/admin/withdrawals", { params: { status } });
    return data;
  },
  async adminApprove(id: number, note?: string): Promise<Withdrawal> {
    const { data } = await apiClient.post<Withdrawal>(`/admin/withdrawals/${id}/approve`, { note });
    return data;
  },
  async adminReject(id: number, note?: string): Promise<Withdrawal> {
    const { data } = await apiClient.post<Withdrawal>(`/admin/withdrawals/${id}/reject`, { note });
    return data;
  },
  async adminMarkPaid(id: number, note?: string): Promise<Withdrawal> {
    const { data } = await apiClient.post<Withdrawal>(`/admin/withdrawals/${id}/mark-paid`, { note });
    return data;
  },
};
