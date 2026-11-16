import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DemoContext } from "../src/features/demo/context";
import { QuestionBank } from "../src/features/demo/GameAdmin";
import { seed } from "../src/features/demo/seed";
import { DataCardView } from "../src/components/DataCardView";
import { displayLabel, systemText } from "../src/lib/display";
import { errorMessage } from "../src/api/client";

afterEach(cleanup);
const jargon = /\b(?:GATE|LEXEME|GOLD|SENTENCE|OPEN_WORD|OPEN_SENTENCE|RAW|CURATED|VERIFIED|DEMO_APPROVED|DEMO|reviewer|admin|snapshot|Preview|preview|mapping|backup|consent|credit|transcript|split|Audit|Job|training|frontend|backend|benchmark|manifest)\b/;

it("keeps technical vocabulary out of visible JSX text and label attributes across the frontend",()=>{
  const violations:string[]=[];
  function scan(dir:string) {
    for(const entry of readdirSync(dir,{withFileTypes:true})) {
      const path=join(dir,entry.name);
      if(entry.isDirectory()) {scan(path);continue;}
      if(!path.endsWith(".tsx"))continue;
      const source=readFileSync(path,"utf8"), file=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
      function visit(node:ts.Node) {
        const text=ts.isJsxText(node) ? node.text : ts.isJsxAttribute(node)&&node.initializer&&ts.isStringLiteral(node.initializer)&&/^(title|label|placeholder|aria-label|description|subtitle)$/.test(node.name.getText(file)) ? node.initializer.text : "";
        if(jargon.test(text))violations.push(`${path}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line+1} ${text.trim()}`);
        ts.forEachChild(node,visit);
      }
      visit(file);
    }
  }
  scan(join(process.cwd(),"src"));
  expect(violations).toEqual([]);
});

it("translates question types and approval labels while preserving command values",async()=>{
  const state=seed();state.actor="locale-admin";state.people=[{id:state.actor,name:"Quản trị",role:"admin",verified:true,region:"",risk:"clear",appeal:""}];
  state.questions=[{...state.questions[0],id:"locale-question",prompt:"Câu hỏi kiểm tra",approval:"DRAFT",kind:"GATE"}];state.exams=[];
  const run=vi.fn().mockResolvedValue(state);
  render(<MemoryRouter><DemoContext.Provider value={{state,run,refresh:vi.fn(),syncAction:vi.fn(),error:null,clearError:vi.fn(),live:false}}><QuestionBank /></DemoContext.Provider></MemoryRouter>);
  expect(document.body.textContent).not.toMatch(jargon);
  fireEvent.click(screen.getByRole("button",{name:"Xem / sửa",exact:true}));
  expect(screen.getByRole("option",{name:"Kiểm tra đầu vào",exact:true})).toHaveAttribute("value","GATE");
  fireEvent.click(screen.getByRole("button",{name:"Lưu câu hỏi",exact:true}));
  expect(run).toHaveBeenCalledWith(expect.objectContaining({type:"question",question:expect.objectContaining({kind:"GATE",approval:"DRAFT"})}));
});

it("renders release metadata in Vietnamese without changing the exported card",()=>{
  const card={rule_version:"dialect-release-connected-v3",scope:"verified-training-candidates",counts:{records:1,groups:1,splits:{train:1}},warnings:["Chỉ train; chưa đủ dev/test để làm benchmark/gold."],provenance:[{id:7,source_id:3,scopes:{train:true,public:false,audio:false}}]};
  const original=JSON.stringify(card);
  render(<DataCardView value={original}/>);
  expect(document.body.textContent).not.toMatch(jargon);
  expect(screen.getByText("Huấn luyện",{exact:true})).toBeInTheDocument();
  expect(JSON.stringify(card)).toBe(original);
});

it("does not expose unknown system codes or English exception messages",()=>{
  expect(displayLabel("NEW_INTERNAL_STATUS")).toBe("Chưa xác định");
  expect(errorMessage(new Error("Network Error"))).not.toMatch(/Network Error/);
  expect(systemText("Chỉ train; thiếu consent.")).toContain("phạm vi đồng ý");
});
