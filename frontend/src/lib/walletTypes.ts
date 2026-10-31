export interface UserProfile {
  user_id: number;
  full_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  date_of_birth: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_holder: string | null;
  updated_at: string | null;
}

export interface ProfileUpdatePayload {
  phone?: string;
  address?: string;
  date_of_birth?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_holder?: string;
}

export interface WalletSummary {
  score_confirmed: number;
  score_pending: number;
  confirmed_vnd: number;
  point_to_vnd: number;
  min_withdrawal_points: number;
  pending_withdrawal_points: number;
  available_points: number;
}

export type WithdrawalStatus = "pending" | "approved" | "rejected" | "paid";

export interface Withdrawal {
  id: number;
  user_id: number;
  user_full_name: string | null;
  user_email: string | null;
  amount_points: number;
  amount_vnd: number;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_holder: string | null;
  status: WithdrawalStatus;
  note: string | null;
  admin_note: string | null;
  requested_at: string;
  processed_at: string | null;
  paid_at: string | null;
}

export const WITHDRAWAL_STATUS_LABEL: Record<WithdrawalStatus, { text: string; cls: string }> = {
  pending: { text: "Chờ duyệt", cls: "status-pending" },
  approved: { text: "Đã duyệt — chờ chuyển", cls: "status-approved" },
  rejected: { text: "Bị từ chối", cls: "status-rejected" },
  paid: { text: "Đã chuyển khoản", cls: "status-approved" },
};

export function formatVnd(n: number): string {
  return n.toLocaleString("vi-VN") + " ₫";
}
