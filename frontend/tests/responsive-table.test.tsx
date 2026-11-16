import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ResponsiveTable } from "../src/components/ResponsiveTable";

afterEach(cleanup);
it("retains table semantics and labels new rows for the mobile card view", async () => {
  const view = (rows: string[]) => <ResponsiveTable><table><thead><tr><th scope="col">Tên</th><th scope="col">Vai trò</th></tr></thead><tbody>{rows.map(name => <tr key={name}><td>{name}</td><td><select aria-label={`Vai trò ${name}`} defaultValue="reviewer"><option value="reviewer">Reviewer</option></select></td></tr>)}</tbody></table></ResponsiveTable>;
  const { rerender } = render(view(["An"]));
  expect(screen.getByRole("table")).toBeInTheDocument();
  expect(screen.getByText("An")).toHaveAttribute("data-label", "Tên");
  expect(screen.getByLabelText("Vai trò An").closest("td")).toHaveAttribute("data-label", "Vai trò");
  rerender(view(["An", "Bình"]));
  await waitFor(() => expect(screen.getByText("Bình")).toHaveAttribute("data-label", "Tên"));
  expect(screen.getAllByRole("combobox")).toHaveLength(2);
});
