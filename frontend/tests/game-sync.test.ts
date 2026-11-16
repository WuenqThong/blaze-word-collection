import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import { apiClient } from "../src/api/client";
import * as games from "../src/features/demo/gameServer";
import { applyCommand, blankAnswer } from "../src/features/demo/domain";
import { repository } from "../src/features/demo/repository";
import { consentDefault, seed } from "../src/features/demo/seed";
import type { Session } from "../src/features/demo/types";
import type { User } from "../src/lib/types";

const user:User={id:7,email:"owner@example.com",full_name:"Người chơi",role:"annotator",created_at:"",last_login_at:null};
let initial:Session;
beforeEach(async()=>{
  const state=applyCommand(seed(),{type:"start",id:"server-session",examId:"exam-demo",campaignId:"",consent:{...consentDefault(),collect:true,train:true}});
  initial={...state.sessions[0],owner:"account:7",serverRevision:1,serverAllocated:true,serverPending:[]};
  await repository(true).replace(()=>({...state,actor:"account:7",sessions:[initial],gameServerEnabled:true}));
});
afterEach(()=>vi.restoreAllMocks());
const draft=(text:string)=>({type:"draftAnswer" as const,id:initial.id,index:0,answer:{...blankAnswer(),text,standard:text}});

it("coalesces unsent drafts and retries the exact durable key/body after a lost response",async()=>{
  await games.queue(draft("mô"),user);await games.queue(draft("răng"),user);
  expect((await repository().load()).sessions[0].serverPending).toHaveLength(1);
  const post=vi.spyOn(apiClient,"post").mockRejectedValue(new Error("Network Error"));
  await games.flush(user);
  const first=structuredClone(post.mock.calls[0][1]);
  await games.queue(draft("chi"),user);
  expect((await repository().load()).sessions[0].serverPending).toHaveLength(2);
  let revision=1;
  post.mockImplementation(async(_url,body)=>{ const request=body as {command:ReturnType<typeof draft>};return {data:{...initial,serverRevision:++revision,answers:[request.command.answer,...initial.answers.slice(1)]}}; });
  await games.flush(user);
  expect(post.mock.calls[1][1]).toEqual(first);
  expect(post.mock.calls[2][1]).toMatchObject({expected_revision:2,command:{answer:{text:"chi"}}});
  expect((await repository().load()).sessions[0]).toMatchObject({serverRevision:3,serverPending:[]});
  expect((await repository().load()).sessions[0].answers[0].text).toBe("chi");
});

it("requires an explicit choice for cross-device conflicts and preserves the local draft history",async()=>{
  await games.queue(draft("nháp máy này"),user);
  const remote={...initial,serverRevision:2,cursor:1};
  const post=vi.spyOn(apiClient,"post").mockRejectedValue(new AxiosError("conflict","ERR",undefined,undefined,{status:409,statusText:"",headers:{},config:{headers:new AxiosHeaders()},data:{detail:{code:"game_conflict",message:"Lượt đã thay đổi",session:remote}}}));
  await games.flush(user);
  expect((await repository().load()).sessions[0].serverConflict).toMatchObject({serverRevision:2});
  await expect(games.queue(draft("ghi đè"),user)).rejects.toThrow(/xung đột/);
  await games.resolve({type:"resolveGameConflict",id:initial.id,choice:"local"},user);
  const rebased=(await repository().load()).sessions[0];
  expect(rebased.localBackups).toHaveLength(1);expect(rebased.serverPending?.[0].expectedRevision).toBe(2);
  post.mockResolvedValue({data:{...remote,serverRevision:3}});await games.flush(user);
  expect((await repository().load()).sessions[0].localBackups).toHaveLength(1);
});

function mockLoad(remote:Session) {
  vi.spyOn(apiClient,"get").mockImplementation(async(url)=>({data:url==="/dialect/game/catalog"?{questions:seed().questions,exams:seed().exams,campaigns:[],tasks:[],regions:seed().regions,topics:seed().topics,revisions:{}}:{items:[remote],next_cursor:null}}));
}

it("does not misclassify an unacknowledged own write as a conflict during a snapshot fetch",async()=>{
  await games.queue(draft("mô"),user);
  mockLoad({...initial,serverRevision:2});await games.load(user);
  const session=(await repository().load()).sessions[0];
  expect(session.serverPending).toHaveLength(1);expect(session.serverConflict).toBeUndefined();
});

it("restores a synchronized session into an empty device cache",async()=>{
  await repository().replace(()=>({...seed(),actor:"account:7",sessions:[]}));
  mockLoad({...initial,cursor:1,serverRevision:4});await games.load(user);
  expect((await repository().load()).sessions[0]).toMatchObject({id:initial.id,owner:"account:7",cursor:1,serverRevision:4});
  expect((await repository().load()).catalogBackups?.[0].questions.length).toBeGreaterThan(0);
});

it("offers an explicit recovery path when a queued command is rejected as invalid",async()=>{
  await games.queue(draft("nháp cần sửa"),user);
  vi.spyOn(apiClient,"post").mockRejectedValue(new AxiosError("invalid","ERR",undefined,undefined,{status:422,statusText:"",headers:{},config:{headers:new AxiosHeaders()},data:{detail:"Nội dung cần sửa"}}));
  vi.spyOn(apiClient,"get").mockResolvedValue({data:initial});
  await games.flush(user);
  expect((await repository().load()).sessions[0].serverValidationError).toBe(true);
  await games.resolve({type:"resolveGameConflict",id:initial.id,choice:"server"},user);
  const recovered=(await repository().load()).sessions[0];
  expect(recovered.serverPending).toEqual([]);expect(recovered.localBackups?.[0].commands[0].command).toMatchObject({answer:{text:"nháp cần sửa"}});
});

it("rejects another account's returned sessions before changing the durable cache",async()=>{
  mockLoad({...initial,owner:"account:8"});
  await expect(games.load(user)).rejects.toThrow(/tài khoản/);
  expect((await repository().load()).sessions[0].owner).toBe("account:7");
});

it("does not merge a completed request after logout aborts its binding",async()=>{
  const controller=new AbortController();
  vi.spyOn(apiClient,"post").mockImplementation(async()=>{controller.abort();return {data:{...initial,cursor:4,serverRevision:5}};});
  await expect(games.start({type:"start",id:"new-session",examId:"exam-demo",campaignId:"",consent:initial.consent},user,controller.signal)).rejects.toThrow(/tài khoản/);
  expect((await repository().load()).sessions[0].cursor).toBe(0);
});
