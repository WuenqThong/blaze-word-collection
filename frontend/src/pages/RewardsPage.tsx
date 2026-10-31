import { RewardsTab } from "../features/rewards/RewardsTab";

export function RewardsPage() {
  return (
    <>
      <h3 className="mb-1">Điểm thưởng</h3>
      <p className="text-muted mb-4">Tổng điểm bạn đã tích luỹ và lịch sử giao dịch.</p>
      <RewardsTab />
    </>
  );
}
