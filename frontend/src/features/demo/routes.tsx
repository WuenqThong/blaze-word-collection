export const demoRoute = {
  path: "/demo",
  hydrateFallbackElement: (
    <p role="status" className="collection-empty">
      Đang mở giao diện DEMO…
    </p>
  ),
  lazy: async () => ({ Component: (await import("./DemoLayout")).DemoRoot }),
  children: [
    { path: "internal", element: <section className="demo-panel"><h1>Thử nghiệm nội bộ</h1><p>Chọn vai trò ở công cụ phía trên để thử phân luồng. Đây là mô phỏng trên trình duyệt, không phải đăng nhập hoặc phân quyền máy chủ.</p><a href="/demo/admin/dashboard">Mở quản trị</a><br /><a href="/demo/admin/review">Mở hàng chờ reviewer</a></section> },
    {
      index: true,
      lazy: async () => ({ Component: (await import("./HomeDemo")).HomeDemo }),
    },
    {
      path: "rights",
      lazy: async () => ({
        Component: (await import("./HomeDemo")).RightsDemo,
      }),
    },
    {
      path: "play",
      lazy: async () => ({
        Component: (await import("./GamePages")).StartGame,
      }),
    },
    {
      path: "game/:id",
      lazy: async () => ({ Component: (await import("./GamePages")).GamePage }),
    },
    {
      path: "contribute",
      lazy: async () => ({
        Component: (await import("./ContributionDemo")).ContributionDemo,
      }),
    },
    {
      path: "account",
      lazy: async () => ({ Component: (await import("./AccountDemo")).AccountDemo }),
    },
    {
      path: "history",
      lazy: async () => ({
        Component: (await import("./ContributionDemo")).HistoryDemo,
      }),
    },
    {
      path: "tasks",
      lazy: async () => ({
        Component: (await import("./ContributionDemo")).TasksDemo,
      }),
    },
    {
      path: "campaigns",
      lazy: async () => ({
        Component: (await import("./CampaignsDemo")).CampaignsDemo,
      }),
    },
    {
      path: "dictionary",
      lazy: async () => ({
        Component: (await import("./CommunityDemo")).DictionaryDemo,
      }),
    },
    {
      path: "community",
      lazy: async () => ({
        Component: (await import("./CommunityDemo")).CommunityDemo,
      }),
    },
    {
      path: "rewards",
      lazy: async () => ({
        Component: (await import("./RewardsDemo")).RewardsDemo,
      }),
    },
    {
      path: "ai",
      lazy: async () => ({ Component: (await import("./AIDemo")).AIDemo }),
    },
    {
      path: "admin/questions",
      lazy: async () => ({
        Component: (await import("./GameAdmin")).QuestionBank,
      }),
    },
    {
      path: "admin/exams",
      lazy: async () => ({
        Component: (await import("./GameAdmin")).ExamAdmin,
      }),
    },
    {
      path: "admin/sessions",
      lazy: async () => ({
        Component: (await import("./GameAdmin")).SessionAdmin,
      }),
    },
    {
      path: "admin/sessions/:id",
      lazy: async () => ({
        Component: (await import("./GameAdmin")).SessionAdmin,
      }),
    },
    {
      path: "admin/review",
      lazy: async () => ({
        Component: (await import("./ReviewDemo")).ReviewDemo,
      }),
    },
    {
      path: "admin/settings",
      lazy: async () => ({
        Component: (await import("./SettingsDemo")).SettingsDemo,
      }),
    },
    {
      path: "admin/import",
      lazy: async () => ({
        Component: (await import("./DataPipeline")).ImportDemo,
      }),
    },
    {
      path: "admin/datasets",
      lazy: async () => ({
        Component: (await import("./DataPipeline")).DatasetDemo,
      }),
    },
    {
      path: "admin/dashboard",
      lazy: async () => ({
        Component: (await import("./DashboardDemo")).DashboardDemo,
      }),
    },
    {
      path: "admin/operations",
      lazy: async () => ({
        Component: (await import("./DataPipeline")).OperationsDemo,
      }),
    },
    {
      path: "*",
      element: (
        <section className="demo-panel">
          <h1>Không tìm thấy trang demo</h1>
          <a href="/demo">Về trang chủ</a>
        </section>
      ),
    },
  ],
};
