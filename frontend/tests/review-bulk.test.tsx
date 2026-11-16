import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { apiClient } from "../src/api/client";
import { BulkReviewControls } from "../src/features/dialect/ReviewPage";
import { MemoryRouter } from "react-router-dom";
import { ReviewDemo } from "../src/features/demo/ReviewDemo";
import { DemoContext } from "../src/features/demo/context";
import { blankRaw, consentDefault, seed } from "../src/features/demo/seed";
import type { Contribution } from "../src/features/demo/types";

afterEach(()=>{cleanup();vi.restoreAllMocks();});

function renderQueue(items: Contribution[] = [], query = "") {
  const state = seed();
  state.actor = "reviewer-ux";
  state.people = [{id:state.actor,name:"Người duyệt",role:"reviewer",region:"TP. Hội An",verified:true,risk:"clear",appeal:""}];
  state.contributions = items;
  state.votes = [];
  state.feedback = [];
  const run = vi.fn().mockResolvedValue(state);
  render(<MemoryRouter initialEntries={[`/${query}`]}><DemoContext.Provider value={{state,run,refresh:vi.fn(),syncAction:vi.fn(),error:null,clearError:vi.fn(),live:true}}><ReviewDemo /></DemoContext.Provider></MemoryRouter>);
  return run;
}

const reviewItem = (id:string,status:Contribution["status"]="RAW"):Contribution => ({id,owner:"other",sessionId:null,parent:null,sourceId:"source-ux",raw:{...blankRaw(),text:id,meaning:"sao",standard:"sao",context:"răng rứa?",region:"TP. Hội An"},consent:consentDefault(),status,createdAt:"",withdrawn:false,curated:null,senseId:null,qaAudio:""});

it("confirms a saved curation and blocks empty fields before another request", async () => {
  const run = renderQueue([reviewItem("đã đạt", "VERIFIED")], "?status=VERIFIED");
  fireEvent.click(screen.getByRole("button", { name: /đã đạt/ }));
  fireEvent.click(screen.getByRole("button", { name: "Lưu", exact: true }));
  expect(await screen.findByRole("status")).toHaveTextContent("Đã lưu chỉnh lý.");
  expect(run).toHaveBeenCalledWith(expect.objectContaining({ type: "curate", id: "đã đạt" }));
  const count = run.mock.calls.filter(([command]) => command.type === "curate").length;
  fireEvent.change(screen.getByLabelText("Nghĩa *"), { target: { value: "" } });
  fireEvent.blur(screen.getByLabelText("Nghĩa *"));
  expect(screen.getByRole("alert")).toHaveTextContent("Nhập nghĩa");
  fireEvent.click(screen.getByRole("button", { name: "Lưu", exact: true }));
  expect(run.mock.calls.filter(([command]) => command.type === "curate")).toHaveLength(count);
});

it("keeps long queues to ten items per page", () => {
  renderQueue(Array.from({length:12}, (_, i) => reviewItem(`sample-${i+1}`)));
  expect(screen.getByRole("button", {name:/sample-1\b/})).toBeInTheDocument();
  expect(screen.queryByRole("button", {name:/sample-11\b/})).toBeNull();
  fireEvent.click(screen.getByRole("button", {name:"Trang sau", exact:true}));
  expect(screen.getByRole("button", {name:/sample-11\b/})).toBeInTheDocument();
  expect(screen.queryByRole("button", {name:/sample-1\b/})).toBeNull();
});

it("explains an empty queue without asking reviewers to create data or switch roles",()=>{
  renderQueue();
  expect(screen.getByText("TP. Hội An")).toBeInTheDocument();
  expect(screen.getByRole("heading",{name:"Chưa có mẫu"})).toBeInTheDocument();
  expect(screen.queryByText(/Gửi game\/import/)).toBeNull();
  expect(screen.queryByText(/Xử lý nhiều đóng góp/)).toBeNull();
});

it("shows actionable items, explains checks and sends an independent review",async()=>{
  const run=renderQueue([reviewItem("răng"),reviewItem("đã xong","VERIFIED"),{...reviewItem("ngoài vùng"),raw:{...blankRaw(),text:"ngoài vùng",region:"Đà Nẵng"}}]);
  expect(screen.queryByRole("button",{name:/đã xong/})).toBeNull();
  expect(screen.getByRole("button",{name:/ngoài vùng/})).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:/răng/}));
  const submit=screen.getByRole("button",{name:"Gửi đánh giá",exact:true});
  expect(submit).toBeDisabled();
  expect(screen.getByRole("option",{name:/Đạt —/})).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Lý do đánh giá (bắt buộc)"),{target:{value:"Cần thêm ví dụ rõ hơn"}});
  fireEvent.click(submit);
  expect(await screen.findByRole("status")).toHaveTextContent("Đã gửi.");
  expect(run).toHaveBeenCalledWith(expect.objectContaining({type:"vote",id:"răng",verdict:"HOLD",note:"Cần thêm ví dụ rõ hơn"}));
});

it("only enables an approving review after all four checks and a reason",()=>{
  renderQueue([reviewItem("mô")]);
  fireEvent.click(screen.getByRole("button",{name:/mô/}));
  const approval = screen.getByRole("option",{name:/Đạt —/});
  for (const label of ["Nghĩa được giải thích đúng","Có cơ sở xác nhận vùng sử dụng","Ví dụ và ngữ cảnh tự nhiên","Cách nói phổ thông phù hợp"]) {
    fireEvent.click(screen.getByRole("checkbox",{name:label,exact:true}));
  }
  expect(approval).not.toBeDisabled();
  fireEvent.change(screen.getByLabelText("Kết luận của bạn"),{target:{value:"VERIFIED"}});
  const submit = screen.getByRole("button",{name:"Gửi đánh giá",exact:true});
  expect(submit).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Lý do đánh giá (bắt buộc)"),{target:{value:"Đã đối chiếu đủ các tiêu chí"}});
  expect(submit).not.toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox",{name:"Ví dụ và ngữ cảnh tự nhiên",exact:true}));
  expect(submit).toBeDisabled();
});

it("requires explicit selection and reason then refreshes after an authenticated API write", async()=>{
  const post=vi.spyOn(apiClient,"post").mockResolvedValue({data:{updated:1}});
  const reload=vi.fn();
  render(<BulkReviewControls items={[{id:7,label:"từ ngắn"}]} admin={false} reload={reload}/>);
  const button=screen.getByRole("button",{hidden:true});
  expect(button).toBeDisabled();
  expect(screen.queryByRole("option",{name:"Từ chối sau hai phiếu",hidden:true})).toBeNull();
  fireEvent.click(screen.getByRole("checkbox",{hidden:true}));
  fireEvent.change(screen.getByLabelText("Lý do bắt buộc"),{target:{value:"Kiểm tra nghi vấn chất lượng"}});
  fireEvent.click(button);
  expect(await screen.findByRole("status",{hidden:true})).toHaveTextContent("Đã cập nhật 1 mẫu");
  expect(post).toHaveBeenCalledWith("/dialect/reviews/bulk",{ids:[7],action:"HOLD",reason:"Kiểm tra nghi vấn chất lượng"});
  expect(reload).toHaveBeenCalledOnce();
});

it("keeps the reason and selection when the server rejects the entire batch",async()=>{
  vi.spyOn(apiClient,"post").mockRejectedValue(new Error("Denied"));
  const reload=vi.fn();
  render(<BulkReviewControls items={[{id:9,label:"mẫu"}]} admin reload={reload}/>);
  fireEvent.click(screen.getByRole("checkbox",{hidden:true}));
  fireEvent.change(screen.getByLabelText("Lý do bắt buộc"),{target:{value:"Lý do cần giữ"}});
  fireEvent.click(screen.getByRole("button",{hidden:true}));
  await screen.findByRole("status",{hidden:true});
  expect(reload).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Lý do bắt buộc")).toHaveValue("Lý do cần giữ");
  expect(screen.getByRole("checkbox",{hidden:true})).toBeChecked();
});
