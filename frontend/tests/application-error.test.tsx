import { render, screen, cleanup } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, expect, it } from "vitest";
import { ApplicationError } from "../src/components/ApplicationError";
afterEach(cleanup);
it("recovers failed lazy imports with Vietnamese guidance and a reload action", async () => {
  const router = createMemoryRouter([{ path: "/demo/account", lazy: async () => { throw new TypeError("Failed to fetch dynamically imported module: /assets/old.js"); }, errorElement: <ApplicationError /> }], { initialEntries: ["/demo/account"] });
  render(<RouterProvider router={router} />);
  expect(await screen.findByRole("heading", { name: "Cần tải lại giao diện" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Tải lại trang" })).toBeEnabled();
  expect(screen.queryByText("Unexpected Application Error!")).not.toBeInTheDocument();
  expect(screen.getByText(/không xoá các bản nháp/)).toBeInTheDocument();
});
