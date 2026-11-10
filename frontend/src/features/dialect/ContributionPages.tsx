import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Alert, Modal } from "react-bootstrap";
import { useAuth } from "../auth/AuthContext";
import { apiClient, extractError } from "../../api/client";
import { ContributionBadge, ContributionContent, EmptyContributions, PageHeading, Pagination, ResourceState, UsageStatus } from "./shared";
import { STATUS, dateLabel, type Contribution, type Page } from "./types";
import { useResource } from "./useResource";

export function ContributionsPage({admin=false}:{admin?:boolean}) {
  const [params,setParams]=useSearchParams();
  const page=Math.max(0,Number(params.get("page"))||0);const status=params.get("status")??"";const query=params.get("query")??"";
  const r=useResource<Page<Contribution>>(`/dialect/${admin?"admin/":""}contributions?offset=${page*25}&status=${encodeURIComponent(status)}&query=${encodeURIComponent(query)}`);
  function filter(key:string,value:string){setParams(previous=>{const next=new URLSearchParams(previous);if(value)next.set(key,value);else next.delete(key);next.delete("page");return next;},{replace:true});}
  const back=`${admin?"/admin/contributions":"/my/contributions"}${params.size?`?${params}`:""}`;
  return <><PageHeading eyebrow={admin?"ĐIỀU PHỐI / ĐÓNG GÓP":"KHÔNG GIAN CỦA BẠN"} title={admin?"Từng mẫu, từng bước kiểm chứng.":"Những cách nói bạn đã góp."} description="Xem phản hồi, bổ sung thông tin và quản lý phạm vi sử dụng. Đã xác minh chưa đồng nghĩa đủ điều kiện xuất." action={<Link className="btn btn-primary" to="/contribute/new"><i className="bi bi-plus-lg" aria-hidden="true"/> Góp từ / câu</Link>}/>
    <div className="dialect-toolbar"><label className="dialect-search">Tìm đóng góp<input type="search" className="form-control" placeholder="Tìm theo nội dung nguyên bản…" value={query} onChange={e=>filter("query",e.target.value)}/></label><label>Trạng thái<select className="form-select" value={status} onChange={e=>filter("status",e.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(STATUS).map(([key,value])=><option key={key} value={key}>{value.label}</option>)}<option value="WITHDRAWN">Đã rút mẫu</option></select></label></div>
    {!r.data?<ResourceState error={r.error} retry={r.reload}/>:<><div className="dialect-results-heading"><strong>{r.data.total} đóng góp</strong><span>Nội dung gốc được giữ riêng với các phiên bản bổ sung.</span></div>{!r.data.items.length?(status||query?<div className="collection-empty"><i className="bi bi-search" aria-hidden="true"/><h2>Không có mẫu phù hợp</h2><p>Thử từ khóa khác hoặc bỏ bộ lọc.</p><button className="btn btn-outline-primary" onClick={()=>setParams({})}>Xóa bộ lọc</button></div>:<EmptyContributions/>):<div className="dialect-list">{r.data.items.map(item=><Link key={item.id} to={`/my/contributions/${item.id}?back=${encodeURIComponent(back)}`} className="dialect-list-item"><div className="dialect-list-icon"><i className={`bi ${item.raw.kind==="word"?"bi-journal-text":"bi-chat-square-text"}`} aria-hidden="true"/></div><div className="dialect-list-copy"><small>#{item.id} · {item.raw.kind==="word"?"Từ / cụm từ":"Câu hội thoại"} · {item.raw.region}</small><h2>{item.raw.original_text}</h2><p>{item.raw.meaning}</p><small>{dateLabel(item.created_at)}</small></div><div className="dialect-list-status"><ContributionBadge item={item}/><small>{item.withdrawn_at?"Đã ngừng sử dụng":item.status==="HOLD"?"Cần bổ sung phiên bản":item.rights_confirmed?"Nguồn đã rà soát":"Nguồn chờ rà soát"}</small></div><i className="bi bi-arrow-up-right" aria-hidden="true"/></Link>)}</div>}<Pagination page={page} total={r.data.total} onChange={n=>setParams(previous=>{const next=new URLSearchParams(previous);next.set("page",String(n));return next;})}/></>}
  </>;
}

const ACTIONS:Record<string,string>={SUBMITTED:"Đã tiếp nhận bản gốc",REVIEWED:"Đã có phiếu độc lập",RIGHTS_REVIEWED:"Đã rà soát nguồn",WITHDRAWN:"Đã rút mẫu",VERIFIED:"Đã xác minh nội dung",HOLD:"Cần bổ sung thông tin",REJECT:"Chưa chấp nhận"};
function safeBack(value:string|null,admin:boolean) {
  if(!value)return null;
  const [path]=value.split("?");
  if(path==="/my/contributions"||(admin&&path==="/admin/contributions"))return value;
  return null;
}
export function ContributionDetailPage() {
  const {id}=useParams();const {user}=useAuth();const [params]=useSearchParams();
  const r=useResource<Contribution>(`/dialect/contributions/${id}`);
  const [confirm,setConfirm]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState<string|null>(null);
  if(!r.data)return <ResourceState error={r.error} retry={r.reload}/>;
  const item=r.data;const own=item.owner_id===user?.id;const admin=user?.role==="admin";
  const context=params.get("from");
  const back=safeBack(params.get("back"),admin)??(context==="review"?"/review":context==="sources"&&admin?"/admin/sources":context==="datasets"&&admin?"/admin/datasets":own?"/my/contributions":admin?"/admin/contributions":"/review");
  return <><Link className="dialect-back-link" to={back}><i className="bi bi-arrow-left" aria-hidden="true"/> Về danh sách</Link><PageHeading eyebrow={`ĐÓNG GÓP #${item.id}`} title="Bản gốc & lịch sử xử lý" description={`Tiếp nhận ${dateLabel(item.created_at)}. Mọi bổ sung được lưu thành phiên bản riêng.`}/>{error&&<Alert variant="danger">{error}</Alert>}
    <div className="dialect-detail-layout"><div><section className="dialect-surface dialect-original"><ContributionContent item={item}/>{item.parent_id&&<Link className="dialect-version-link" to={`/my/contributions/${item.parent_id}?back=${encodeURIComponent(back)}`}><i className="bi bi-layers" aria-hidden="true"/> Bổ sung từ bản gốc #{item.parent_id}</Link>}</section>
      <section className="dialect-surface dialect-history"><div className="dialect-section-heading"><h2>Lịch sử xử lý</h2><span className="dialect-tag">{item.events.length} sự kiện</span></div><ol className="dialect-timeline">{item.events.map((event,index)=><li key={`${index}.${event.created_at}`}><span className="dialect-timeline-dot"/><div><strong>{ACTIONS[event.action]??event.action}</strong><p>{event.note}</p><small>{dateLabel(event.created_at)}</small></div></li>)}</ol></section></div>
      <aside className="dialect-surface dialect-permission-panel"><div className="dialect-section-heading"><h2>Tình trạng & quyền dùng</h2><i className="bi bi-shield-check" aria-hidden="true"/></div><UsageStatus item={item}/><p className="dialect-fine-print mt-3">{item.vote_count} phiếu độc lập. Đủ QA, quyền nguồn và đồng ý sử dụng là các điều kiện riêng.</p>{item.rights_note&&<div className="dialect-source-note"><strong>Căn cứ nguồn</strong><p>{item.rights_note}</p></div>}
        {item.status==="HOLD"&&!item.withdrawn_at&&<Alert variant="warning">Mẫu cần thêm thông tin. Đọc phản hồi ở lịch sử rồi tạo phiên bản bổ sung.</Alert>}
        {own&&!item.withdrawn_at&&<div className="dialect-owner-actions"><Link className="btn btn-primary" to={`/contribute/new?parent=${item.id}`}>Bổ sung phiên bản mới <i className="bi bi-arrow-right" aria-hidden="true"/></Link><button className="btn btn-outline-danger" onClick={()=>setConfirm(true)}>Rút mẫu này</button><p className="dialect-fine-print">Mỗi phiên bản được quản lý riêng. Bản mới sẽ được đánh giá lại.</p></div>}
        {item.withdrawn_at&&<Alert variant="secondary">Đã rút mẫu. Mẫu này không được đưa vào bản xuất mới.</Alert>}
      </aside>
    </div>
    <Modal centered show={confirm} onHide={()=>!busy&&setConfirm(false)}><Modal.Header closeButton={!busy}><Modal.Title>Rút quyền sử dụng mẫu #{item.id}?</Modal.Title></Modal.Header><Modal.Body>Mẫu này sẽ bị loại khỏi lần xuất mới và chặn tải các bản xuất đang kiểm soát có chứa mẫu. Bản gốc và lịch sử được giữ lại. Các phiên bản khác không tự động được rút; bản đã tải ra ngoài cần điều phối xử lý.</Modal.Body><Modal.Footer><button className="btn btn-outline-secondary" disabled={busy} onClick={()=>setConfirm(false)}>Giữ mẫu</button><button className="btn btn-danger" disabled={busy} onClick={async()=>{setBusy(true);setError(null);try{await apiClient.post(`/dialect/contributions/${id}/withdraw`);setConfirm(false);r.reload();}catch(e){setError(extractError(e));}finally{setBusy(false);}}}>{busy?"Đang xử lý…":"Xác nhận rút mẫu"}</button></Modal.Footer></Modal>
  </>;
}

export function DialectProfilePage() {
  const r=useResource<{upbringing_area:string;usage_area:string}>("/dialect/profile");
  if(!r.data)return <ResourceState error={r.error} retry={r.reload}/>;
  return <ProfileForm initial={r.data}/>;
}
function ProfileForm({initial}:{initial:{upbringing_area:string;usage_area:string}}) {
  const [form,setForm]=useState(initial);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const [error,setError]=useState<string|null>(null);
  return <><PageHeading title="Nơi bạn lớn lên, tiếng bạn thường nghe." description="Thông tin tự khai giúp hiểu bối cảnh. Không dùng hồ sơ này để tự chứng nhận năng lực đánh giá."/>
    <div className="dialect-profile-layout"><form className="dialect-surface" onSubmit={async e=>{e.preventDefault();setBusy(true);setMessage("");setError(null);try{await apiClient.put("/dialect/profile",form);setMessage("Đã lưu hồ sơ vùng sử dụng.");}catch(err){setError(extractError(err));}finally{setBusy(false);}}}><fieldset disabled={busy}><h2>Hồ sơ vùng sử dụng</h2>{([["upbringing_area","Nơi bạn lớn lên"],["usage_area","Vùng bạn thường nghe / sử dụng phương ngữ"]] as const).map(([key,label])=><div key={key} className="dialect-field"><label htmlFor={`profile-${key}`}>{label} <span className="text-muted">· Tự nguyện</span></label><input id={`profile-${key}`} className="form-control" maxLength={255} placeholder="Ghi địa danh quen thuộc hoặc “Không chắc”" value={form[key]} onChange={e=>{setForm({...form,[key]:e.target.value});setMessage("");}}/></div>)}{message&&<Alert variant="success" role="status">{message}</Alert>}{error&&<Alert variant="danger">{error}</Alert>}<div className="dialect-form-actions"><span>Không cần địa chỉ chi tiết.</span><button className="btn btn-primary" disabled={busy}>{busy?"Đang lưu…":"Lưu hồ sơ"}</button></div></fieldset></form>
    <aside className="dialect-profile-help"><i className="bi bi-geo-alt" aria-hidden="true"/><h2>Vùng của bạn và vùng của cách nói</h2><p>Một cách nói có thể được nghe ở nơi khác với nơi bạn lớn lên. Bạn vẫn chọn vùng sử dụng riêng cho từng đóng góp.</p><p>Hồ sơ hiện không tự điền hoặc thay đổi nội dung mẫu đã gửi.</p><Link to="/about-data">Hiểu thêm về quyền dữ liệu <i className="bi bi-arrow-right" aria-hidden="true"/></Link></aside></div>
  </>;
}
