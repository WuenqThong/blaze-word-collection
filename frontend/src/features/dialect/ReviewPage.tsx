import { RegionOptions } from "../demo/RegionOptions";
import { useEffect, useRef, useState } from "react";
import { Link, useBlocker, useSearchParams } from "react-router-dom";
import { Alert, Modal } from "react-bootstrap";
import { apiClient, extractError } from "../../api/client";
import { useAuth } from "../auth/AuthContext";
import { ContributionBadge, ContributionContent, PageHeading, Pagination, ResourceState, UsageStatus } from "./shared";
import { STATUS, type Contribution, type Page } from "./types";
import { useResource } from "./useResource";

const VIEWS = [["pending","Chờ đánh giá"],["mine","Phiếu của tôi"],["hold","Cần bổ sung"]];
const CHECKS = [["meaning_ok","Nghĩa được giải thích đúng"],["region_ok","Có cơ sở xác nhận vùng sử dụng"],["context_ok","Ví dụ và ngữ cảnh tự nhiên"],["translation_ok","Bản phổ thông phù hợp"]] as const;
const EMPTY = {note:"",verdict:"HOLD",checks:{meaning_ok:false,region_ok:false,context_ok:false,translation_ok:false}};
type ReviewDraft = typeof EMPTY;
function readDraft(key:string):ReviewDraft {
  try {
    const d=JSON.parse(localStorage.getItem(key)??"null");
    if (d && typeof d.note === "string" && ["HOLD","VERIFIED","REJECT"].includes(d.verdict) && CHECKS.every(([k])=>typeof d.checks?.[k] === "boolean")) return d;
  } catch { /* unavailable storage */ }
  return EMPTY;
}

export function DialectReviewPage({disputes=false}:{disputes?:boolean}) {
  const [params,setParams]=useSearchParams();
  const view=disputes?"disputes":VIEWS.some(([key])=>key===params.get("view"))?params.get("view")!:"pending";
  const region=params.get("region")??"";
  const rights=params.get("rights")??"";
  const page=Math.max(0,Number(params.get("page"))||0);
  const [selectedId,setSelectedId]=useState<number|null>(null);
  const [unsafeDraft,setUnsafeDraft]=useState(false);
  const [pendingSelection,setPendingSelection]=useState<number|null>(null);
  const r=useResource<Page<Contribution>>(`/dialect/reviews?view=${view}&region=${encodeURIComponent(region)}&source_rights=${rights}&offset=${page*25}`);
  const selected=r.data?.items.find(item=>item.id===selectedId);
  const reader=useRef<HTMLDivElement>(null);
  function filter(key:string,value:string) {setParams(previous=>{const next=new URLSearchParams(previous);if(value) next.set(key,value);else next.delete(key);next.delete("page");return next;});}
  return <>
    <PageHeading eyebrow="ĐÁNH GIÁ CHẤT LƯỢNG" title={disputes?"Một quyết định rõ ràng cho mỗi bất đồng.":"Đọc ngữ cảnh, đánh giá độc lập."} description={disputes?"Chỉ điều phối viên độc lập với người góp và người đã bỏ phiếu được kết luận.":"Phiếu khác được ẩn trước khi bạn gửi. Đánh giá ngôn ngữ và quyền nguồn được theo dõi riêng."}/>
    <div className="dialect-toolbar">{!disputes&&<div className="dialect-segmented" aria-label="Hàng chờ">{VIEWS.map(([key,label])=><button key={key} aria-pressed={view===key} onClick={()=>filter("view",key)}>{label}</button>)}</div>}<div className="dialect-toolbar-fields"><label>Vùng sử dụng<select className="form-select" value={region} onChange={e=>filter("region",e.target.value)}><option value="">Tất cả vùng</option><RegionOptions /></select></label><label>Quyền nguồn<select className="form-select" value={rights} onChange={e=>filter("rights",e.target.value)}><option value="">Tất cả nguồn</option><option value="pending">Chờ rà soát</option><option value="confirmed">Đã rà soát</option></select></label></div></div>
    {view==="hold"&&<Alert variant="light">Mẫu cần bổ sung được theo dõi ở đây. Người góp tạo phiên bản mới để bổ sung; phiên bản mới bắt đầu lại quá trình đánh giá.</Alert>}
    {!r.data?<ResourceState error={r.error} retry={r.reload}/>:<>
      <div className="dialect-review-layout"><section className="dialect-queue" aria-label="Danh sách mẫu"><div className="dialect-queue-heading"><strong>{r.data.total} mẫu</strong><span>{disputes?"Bất đồng":VIEWS.find(([k])=>k===view)?.[1]}</span></div>{!r.data.items.length?<div className="dialect-inline-empty"><i className="bi bi-clipboard-check" aria-hidden="true"/><h2>Không có mẫu phù hợp</h2><p>Thử thay đổi bộ lọc hoặc quay lại sau.</p></div>:r.data.items.map(item=><button key={item.id} className={`dialect-queue-item ${selectedId===item.id?"is-selected":""}`} aria-pressed={selectedId===item.id} onClick={()=>{if(unsafeDraft&&item.id!==selectedId){setPendingSelection(item.id);return;}setSelectedId(item.id);requestAnimationFrame(()=>reader.current?.focus());}}><small>#{item.id} · {item.raw.region}</small><strong>{item.raw.original_text}</strong><p>{item.raw.meaning}</p><ContributionBadge item={item}/></button>)}</section>
      <div ref={reader} tabIndex={-1} className="dialect-review-reader">{selected?<ReviewForm key={`${selected.id}.${disputes}`} item={selected} adjudicate={disputes} onUnsafe={setUnsafeDraft} done={()=>{setSelectedId(null);r.reload();}}/>:<div className="dialect-reader-empty"><i className="bi bi-layout-text-window-reverse" aria-hidden="true"/><h2>Chọn một mẫu để bắt đầu</h2><p>Đọc nội dung gốc, ngữ cảnh và nguồn trước khi kết luận.</p><span>Nháp phiếu được giữ trên thiết bị khi chuyển mẫu.</span></div>}</div></div>
      <Pagination page={page} total={r.data.total} onChange={n=>{setParams(previous=>{const next=new URLSearchParams(previous);next.set("page",String(n));return next;});}}/>
    </>}
    <Modal centered show={pendingSelection!==null} onHide={()=>setPendingSelection(null)}><Modal.Header closeButton><Modal.Title>Nháp phiếu chưa được lưu</Modal.Title></Modal.Header><Modal.Body>Trình duyệt không lưu được nhận xét. Hãy sao chép nội dung trước khi chuyển sang mẫu khác.</Modal.Body><Modal.Footer><button className="btn btn-outline-secondary" onClick={()=>setPendingSelection(null)}>Giữ phiếu đang nhập</button><button className="btn btn-primary" onClick={()=>{setSelectedId(pendingSelection);setPendingSelection(null);}}>Chuyển mẫu</button></Modal.Footer></Modal>
  </>;
}

function ReviewForm({item,adjudicate,onUnsafe,done}:{item:Contribution;adjudicate:boolean;onUnsafe:(unsafe:boolean)=>void;done:()=>void}) {
  const {user}=useAuth();
  const key=`collection.review-draft.v1.${user?.id}.${item.id}.${adjudicate?"decision":"vote"}`;
  const [draft,setDraft]=useState(()=>readDraft(key));
  const [dirty,setDirty]=useState(false);
  const [storageError,setStorageError]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const blocker=useBlocker(dirty&&storageError);
  const canAct=!item.withdrawn_at && (adjudicate ? item.status==="REVIEW"&&!item.votes.some(v=>v.reviewer_id===user?.id) : ["RAW","REVIEW"].includes(item.status)&&!item.has_voted);
  useEffect(()=>{if(!dirty)return;try{localStorage.setItem(key,JSON.stringify(draft));}catch{queueMicrotask(()=>setStorageError(true));}},[key,draft,dirty]);
  useEffect(()=>{onUnsafe(dirty&&storageError);return()=>onUnsafe(false);},[dirty,storageError,onUnsafe]);
  useEffect(()=>{
    if(!dirty||!storageError)return;
    const handler=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue="";};
    window.addEventListener("beforeunload",handler);return()=>window.removeEventListener("beforeunload",handler);
  },[dirty,storageError]);
  function update(next:ReviewDraft){setDraft(next);setDirty(true);setError(null);}
  const allChecked=Object.values(draft.checks).every(Boolean);
  return <section className="dialect-surface dialect-review-form"><ContributionContent item={item}/><details className="dialect-status-details"><summary>Quyền sử dụng & tình trạng mẫu</summary><UsageStatus item={item}/></details>
    {item.votes.length>0&&<div className="dialect-votes"><h3>Phiếu đã được phép xem</h3>{item.votes.map((v,i)=><div key={v.reviewer_id}><strong>Phiếu {i+1} · {STATUS[v.verdict as keyof typeof STATUS]?.label??v.verdict}</strong><p>{v.note}</p></div>)}</div>}
    {canAct?<form onSubmit={async e=>{e.preventDefault();if(!draft.note.trim()){setError("Hãy ghi lý do và hướng bổ sung cụ thể.");return;}setBusy(true);setError(null);try{await apiClient.post(`/dialect/reviews/${item.id}/${adjudicate?"finalize":"votes"}`,{...draft.checks,verdict:draft.verdict,note:draft.note});try{localStorage.removeItem(key);}catch{/* optional draft */}setDirty(false);done();}catch(err){setError(extractError(err));}finally{setBusy(false);}}}>
      <fieldset disabled={busy}><legend>{adjudicate?"Quyết định điều phối":"Phiếu đánh giá của bạn"}</legend>
        {!adjudicate&&<div className="dialect-consent">{CHECKS.map(([k,label])=><label key={k}><input type="checkbox" checked={draft.checks[k]} onChange={e=>update({...draft,checks:{...draft.checks,[k]:e.target.checked}})}/><span>{label}</span></label>)}</div>}
        <div className="dialect-field"><label htmlFor={`verdict-${item.id}`}>Kết luận</label><select id={`verdict-${item.id}`} className="form-select" value={draft.verdict} onChange={e=>update({...draft,verdict:e.target.value})}><option value="HOLD">Cần bổ sung</option><option value="VERIFIED" disabled={!adjudicate&&!allChecked}>Đã xác minh</option><option value="REJECT">Chưa chấp nhận</option></select>{!adjudicate&&!allChecked&&<small>Cần đạt cả bốn tiêu chí để chọn “Đã xác minh”.</small>}</div>
        <div className="dialect-field"><label htmlFor={`note-${item.id}`}>Lý do và hướng bổ sung <span>*</span></label><textarea className="form-control" id={`note-${item.id}`} rows={4} required maxLength={5000} value={draft.note} placeholder="Nêu cơ sở đánh giá hoặc điều người góp cần bổ sung…" onChange={e=>update({...draft,note:e.target.value})}/></div>
        {error&&<Alert variant="danger" role="alert">{error}</Alert>}
        {storageError&&<Alert variant="warning">Không lưu được nháp. Hãy sao chép nhận xét trước khi chuyển mẫu hoặc rời trang.</Alert>}
        <div className="dialect-form-actions"><span role="status">{storageError?"Nháp chưa được lưu":dirty?"Nháp giữ trên thiết bị này":"Chưa gửi phiếu"}</span><button className="btn btn-primary" disabled={busy||(!adjudicate&&draft.verdict==="VERIFIED"&&!allChecked)}>{busy?"Đang gửi…":adjudicate?"Lưu quyết định":"Gửi phiếu độc lập"}<i className="bi bi-arrow-right" aria-hidden="true"/></button></div>
      </fieldset>
    </form>:<Alert variant="light" className="mt-4">{item.status==="HOLD"?"Mẫu đang chờ bổ sung bằng phiên bản mới.":"Bạn đã gửi phiếu hoặc mẫu đã có quyết định. Nội dung được giữ để đối chiếu."} <Link to={`/my/contributions/${item.id}?from=review`}>Xem lịch sử mẫu</Link></Alert>}
    <Modal centered show={blocker.state==="blocked"} onHide={()=>blocker.state==="blocked"&&blocker.reset()}><Modal.Header closeButton><Modal.Title>Nháp phiếu chưa được lưu</Modal.Title></Modal.Header><Modal.Body>Hãy sao chép nhận xét trước khi rời trang. Trình duyệt này không lưu được nháp.</Modal.Body><Modal.Footer><button className="btn btn-outline-secondary" onClick={()=>blocker.state==="blocked"&&blocker.reset()}>Tiếp tục nhập</button><button className="btn btn-primary" onClick={()=>blocker.state==="blocked"&&blocker.proceed()}>Rời trang</button></Modal.Footer></Modal>
  </section>;
}
