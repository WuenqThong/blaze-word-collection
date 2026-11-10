import { RegionOptions } from "../demo/RegionOptions";
import { useEffect, useRef, useState } from "react";
import { Link, useBlocker, useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Modal } from "react-bootstrap";
import { useAuth } from "../auth/AuthContext";
import { apiClient, extractError } from "../../api/client";
import { PageHeading, ResourceState } from "./shared";
import { useResource } from "./useResource";
import type { Contribution, ContributionForm } from "./types";

const STEPS = ["Phạm vi sử dụng", "Cách nói & nghĩa", "Ngữ cảnh & nguồn", "Xem lại & gửi"];
type TextKey = "original_text"|"meaning"|"standard_vi"|"region"|"context"|"source_evidence";
const LABELS:Record<TextKey,string>={original_text:"Nội dung nguyên bản",meaning:"Nghĩa bạn muốn giải thích",standard_vi:"Cách diễn đạt phổ thông",region:"Vùng sử dụng",context:"Ví dụ và ngữ cảnh",source_evidence:"Nguồn / bối cảnh đã nghe"};
type Errors=Partial<Record<TextKey|"consent_collect",string>>;
function blank(kind:"word"|"sentence",parent:number|null):ContributionForm {
  return {kind,original_text:"",meaning:"",standard_vi:"",region:"",context:"",source_evidence:"",consent_collect:false,consent_train:false,consent_public:false,consent_version:"dialect-2026-11-v1",idempotency_key:crypto.randomUUID(),parent_id:parent};
}
function readDraft(key:string,kind:"word"|"sentence",parent:number|null):ContributionForm|null {
  try {
    const value=JSON.parse(localStorage.getItem(key)??"null");const f=value?.form;
    if(value?.version!==1||!f||!["word","sentence"].includes(f.kind)||f.parent_id!==parent||(!parent&&f.kind!==kind))return null;
    if(!Object.keys(LABELS).every(k=>typeof f[k]==="string")||typeof f.idempotency_key!=="string"||!["consent_collect","consent_train","consent_public"].every(k=>typeof f[k]==="boolean")||f.consent_version!=="dialect-2026-11-v1")return null;
    return f;
  }catch{return null;}
}

export function ContributionWizard() {
  const {user}=useAuth();const [params]=useSearchParams();
  const rawParent=Number(params.get("parent"));
  const parent=Number.isSafeInteger(rawParent)&&rawParent>0?rawParent:null;
  const kind=params.get("kind")==="sentence"?"sentence":"word";
  return <Wizard key={`${user?.id}.${parent??"new"}.${kind}`} userId={user!.id} parent={parent} initialKind={kind}/>;
}

function Wizard({userId,parent,initialKind}:{userId:number;parent:number|null;initialKind:"word"|"sentence"}) {
  const navigate=useNavigate();
  const draftKey=`collection.contribution-draft.v1.${userId}.${parent??initialKind}`;
  const [initialDraft]=useState(()=>readDraft(draftKey,initialKind,parent));
  const [form,setForm]=useState<ContributionForm>(()=>initialDraft??blank(initialKind,parent));
  const [dirty,setDirty]=useState(!!initialDraft);const [step,setStep]=useState(0);
  const [errors,setErrors]=useState<Errors>({});const [error,setError]=useState<string|null>(null);
  const [draftError,setDraftError]=useState(false);const [sending,setSending]=useState(false);
  const [parentLoading,setParentLoading]=useState(!!parent&&!initialDraft);const [parentError,setParentError]=useState<string|null>(null);const [attempt,setAttempt]=useState(0);
  const [submitted,setSubmitted]=useState<Contribution|null>(null);
  const heading=useRef<HTMLHeadingElement>(null);const summary=useRef<HTMLDivElement>(null);
  const blocker=useBlocker(dirty&&!sending&&!submitted);
  const duplicates=useResource<{id:number;text:string;meaning:string;region:string}[]>(`/dialect/duplicates?text=${step===3?encodeURIComponent(form.original_text):""}`);
  useEffect(()=>{
    if(!parent||initialDraft)return;let current=true;
    apiClient.get<Contribution>(`/dialect/contributions/${parent}`).then(({data})=>{if(!current)return;if(data.owner_id!==userId||data.withdrawn_at){setParentError("Chỉ có thể bổ sung mẫu của bạn và chưa rút.");setParentLoading(false);return;}setForm({...data.raw,parent_id:parent,idempotency_key:crypto.randomUUID()});setDirty(true);setParentError(null);setParentLoading(false);}).catch(e=>{if(current){setParentError(extractError(e));setParentLoading(false);}});
    return()=>{current=false;};
  },[parent,userId,initialDraft,attempt]);
  useEffect(()=>{heading.current?.focus();},[step]);
  useEffect(()=>{if(Object.keys(errors).length)summary.current?.focus();},[errors]);
  useEffect(()=>{
    if(!dirty||submitted)return;
    try{localStorage.setItem(draftKey,JSON.stringify({version:1,form}));}catch{queueMicrotask(()=>setDraftError(true));}
  },[draftKey,dirty,form,submitted]);
  useEffect(()=>{
    if(!dirty||submitted)return;
    const handler=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue="";};window.addEventListener("beforeunload",handler);return()=>window.removeEventListener("beforeunload",handler);
  },[dirty,submitted]);
  function update<K extends keyof ContributionForm>(key:K,value:ContributionForm[K]) {
    setForm(previous=>({...previous,[key]:value,idempotency_key:crypto.randomUUID()}));setDirty(true);setError(null);
    setErrors(previous=>{const next={...previous};delete next[key as keyof Errors];return next;});
  }
  function validate(target:number) {
    const next:Errors={};if(!form.consent_collect)next.consent_collect="Cần đồng ý tiếp nhận và kiểm duyệt mẫu này.";
    const required:TextKey[]=target>=2?["original_text","meaning","standard_vi","region"]:[];
    if(target>=3)required.push("context","source_evidence");
    required.forEach(k=>{if(!form[k].trim())next[k]=`Vui lòng điền ${LABELS[k].toLowerCase()}.`;});
    setErrors(next);
    if(Object.keys(next).length){setStep(next.consent_collect?0:["original_text","meaning","standard_vi","region"].some(k=>next[k as TextKey])?1:2);return false;}
    return true;
  }
  function goToError(key:keyof Errors) {
    setStep(key==="consent_collect"?0:key==="context"||key==="source_evidence"?2:1);
    requestAnimationFrame(()=>document.getElementById(`contribution-${key}`)?.focus());
  }
  function resetDraft(){try{localStorage.removeItem(draftKey);}catch{/* optional storage */}setForm(blank(initialKind,parent));setDirty(false);setDraftError(false);setErrors({});setError(null);setStep(0);}
  async function submit() {
    if(!validate(3))return;setSending(true);setError(null);
    try{const {data}=await apiClient.post<Contribution>("/dialect/contributions",form);setSubmitted(data);setDirty(false);try{localStorage.removeItem(draftKey);}catch{/* server already persisted */}}
    catch(e){setError(extractError(e,"Chưa nhận xác nhận từ máy chủ. Nội dung và mã gửi được giữ để bạn thử lại."));}finally{setSending(false);}
  }
  const field=(key:Exclude<TextKey,"region">,hint:string,rows=3)=><div className="dialect-field"><label htmlFor={`contribution-${key}`}>{LABELS[key]} <span aria-label="bắt buộc">*</span></label><textarea id={`contribution-${key}`} className="form-control" rows={rows} maxLength={5000} value={form[key]} onChange={e=>update(key,e.target.value)} aria-invalid={!!errors[key]} aria-describedby={`hint-${key}${errors[key]?` error-${key}`:""}`} required/><small id={`hint-${key}`}>{hint}</small>{errors[key]&&<span className="dialect-field-error" id={`error-${key}`}>{errors[key]}</span>}</div>;
  if(parentLoading||parentError)return <><PageHeading title="Bổ sung phiên bản" description="Đang lấy bản gốc để bạn bổ sung đúng mẫu."/><ResourceState error={parentError} retry={()=>{setParentError(null);setParentLoading(true);setAttempt(v=>v+1);}}/><Link className="dialect-back-link" to="/my/contributions">Về đóng góp của tôi</Link></>;
  if(submitted)return <div className="dialect-submitted"><div className="dialect-icon-tile"><i className="bi bi-check2" aria-hidden="true"/></div><div className="page-eyebrow">ĐÃ NHẬN XÁC NHẬN TỪ MÁY CHỦ</div><h1>Cảm ơn cách nói bạn vừa góp.</h1><p>Đóng góp <strong>#{submitted.id}</strong> đã được lưu nguyên bản và đang chờ đánh giá độc lập. Chưa được coi là dữ liệu đã xác minh.</p><Link className="btn btn-primary" to={`/my/contributions/${submitted.id}`}>Theo dõi đóng góp <i className="bi bi-arrow-right" aria-hidden="true"/></Link><button className="btn btn-link" onClick={()=>{setSubmitted(null);setForm(blank(form.kind,null));setStep(0);setDirty(false);navigate(`/contribute/new?kind=${form.kind}`,{replace:true});}}>Góp một mẫu khác</button></div>;
  return <>
    <PageHeading eyebrow={parent?`BỔ SUNG MẪU #${parent}`:"ĐÓNG GÓP / TỪ & CÂU"} title={parent?"Thêm thông tin, giữ nguyên bản gốc.":"Một cách nói, thêm một ngữ cảnh."} description="Chia sẻ điều bạn thực sự biết. Bạn chọn riêng quyền huấn luyện và công khai." action={<Link className="dialect-back-link" to="/my/contributions"><i className="bi bi-arrow-left" aria-hidden="true"/> Đóng góp của tôi</Link>}/>
    <div className="dialect-wizard-layout"><aside className="dialect-wizard-steps"><ol aria-label="Tiến trình đóng góp">{STEPS.map((label,index)=><li key={label} aria-current={step===index?"step":undefined}><span>{index<step?<i className="bi bi-check2" aria-hidden="true"/>:String(index+1).padStart(2,"0")}</span><div><strong>{label}</strong><small>{index===step?"Đang thực hiện":index<step?"Đã điền":"Bước tiếp theo"}</small></div></li>)}</ol><div className="dialect-draft-note"><i className="bi bi-save" aria-hidden="true"/><strong>Tiếp tục khi bạn sẵn sàng</strong><p role="status">{draftError?"Không lưu được nháp trên trình duyệt. Hãy sao chép nội dung trước khi đóng trang.":dirty?"Nháp được giữ theo tài khoản trên thiết bị này. Chưa gửi lên hệ thống.":"Nháp chỉ lưu trên trình duyệt đang dùng."}</p><button type="button" className="btn btn-link" onClick={resetDraft}>Xóa nháp, nhập lại</button></div><Link className="dialect-help-link" to="/about-data" target="_blank" rel="noreferrer"><i className="bi bi-question-circle" aria-hidden="true"/> Hướng dẫn & quyền dữ liệu</Link></aside>
      <section className="dialect-wizard-surface" aria-labelledby="step-title"><div className="dialect-step-top"><span className="page-eyebrow">BƯỚC {String(step+1).padStart(2,"0")} / 04</span><span>Trường có * là bắt buộc</span></div><h2 id="step-title" ref={heading} tabIndex={-1}>{STEPS[step]}</h2>
        {Object.keys(errors).length>0&&<div className="dialect-error-summary" ref={summary} tabIndex={-1} role="alert"><strong>Còn thông tin cần bổ sung</strong><ul>{Object.entries(errors).map(([key,value])=><li key={key}><button type="button" onClick={()=>goToError(key as keyof Errors)}>{value}</button></li>)}</ul></div>}
        {error&&<Alert variant="danger" role="alert">{error}</Alert>}
        <form noValidate onSubmit={e=>{e.preventDefault();if(step<3){if(validate(step+1))setStep(v=>v+1);}else void submit();}}><fieldset disabled={sending}>
        {step===0&&<><p className="dialect-step-description">Chọn loại nội dung và cách bạn muốn mẫu được sử dụng.</p><div className="dialect-type-choice" role="group" aria-label="Loại nội dung">{[["word","Từ / cụm từ","Một cách gọi hoặc diễn đạt địa phương.","bi-journal-text"],["sentence","Câu hội thoại","Một câu nói cùng tình huống sử dụng.","bi-chat-square-text"]].map(([kind,label,text,icon])=><button type="button" className={form.kind===kind?"is-selected":""} key={kind} aria-pressed={form.kind===kind} onClick={()=>{if(!parent&&kind!==form.kind){navigate(`/contribute/new?kind=${kind}`);}else update("kind",kind as "word"|"sentence");}}><i className={`bi ${icon}`} aria-hidden="true"/><strong>{label}</strong><span>{text}</span></button>)}</div><h3>Phạm vi bạn đồng ý</h3><p className="text-muted">Huấn luyện và công khai là tự nguyện. Bỏ chọn vẫn gửi được mẫu.</p><div className="dialect-consent">{[["consent_collect","Tiếp nhận và kiểm duyệt","Bắt buộc để lưu và đánh giá đóng góp."],["consent_train","Thử nghiệm / huấn luyện mô hình","Tự nguyện, không được chọn sẵn."],["consent_public","Công khai nội dung đủ điều kiện","Tự nguyện, độc lập với quyền huấn luyện."]].map(([k,label,description])=><label key={k}><input id={`contribution-${k}`} type="checkbox" checked={form[k as "consent_collect"]} aria-invalid={k==="consent_collect"&&!!errors.consent_collect} aria-describedby={k==="consent_collect"&&errors.consent_collect?"error-consent_collect":undefined} onChange={e=>update(k as "consent_collect",e.target.checked)}/><span><strong>{label}{k==="consent_collect"?" *":""}</strong><small>{description}</small></span></label>)}</div>{errors.consent_collect&&<p id="error-consent_collect" className="dialect-field-error">{errors.consent_collect}</p>}<p className="dialect-fine-print mt-3">Phiên bản đồng ý: {form.consent_version}. <Link to="/about-data" target="_blank" rel="noreferrer">Đọc chi tiết quyền sử dụng</Link>.</p></>}
        {step===1&&<><p className="dialect-step-description">Giữ cách nói tự nhiên. Mỗi mẫu chỉ nên mô tả một nghĩa cụ thể.</p>{field("original_text",form.kind==="word"?"Ghi từ hoặc cụm từ đúng như bạn thường nói.":"Ghi nguyên câu, giữ cách diễn đạt địa phương.",2)}{field("meaning","Giải thích bằng lời của bạn, tránh chỉ lặp lại từ gốc.")}{field("standard_vi","Ghi cách diễn đạt phổ thông phù hợp với nghĩa và ngữ cảnh.",2)}<div className="dialect-field"><label htmlFor="contribution-region">Vùng bạn nghe cách nói này *</label><select id="contribution-region" className="form-select" required value={form.region} aria-invalid={!!errors.region} aria-describedby={`hint-region${errors.region?" error-region":""}`} onChange={e=>update("region",e.target.value)}><option value="">Chọn vùng sử dụng</option><RegionOptions unsure /></select><small id="hint-region">Đây là nơi sử dụng cách nói, có thể khác nơi bạn lớn lên.</small>{errors.region&&<span className="dialect-field-error" id="error-region">{errors.region}</span>}</div></>}
        {step===2&&<><p className="dialect-step-description">Một ví dụ cụ thể giúp người đánh giá hiểu đúng cách sử dụng.</p>{field("context","Ai nói với ai, trong tình huống nào? Tránh tên và thông tin riêng tư của người khác.",4)}{field("source_evidence","Bạn nghe từ gia đình, trong sinh hoạt hay đọc từ tài liệu? Nếu có đường dẫn, thêm vị trí trích và căn cứ quyền dùng.",4)}<div className="dialect-bottom-note"><i className="bi bi-info-circle" aria-hidden="true"/><p>Nếu chưa chắc một chi tiết, ghi rõ điều bạn chưa chắc. Không cần suy đoán để điền đủ.</p></div></>}
        {step===3&&<><p className="dialect-step-description">Đọc lại trước khi gửi. Bạn sẽ nhận mã để theo dõi và quản lý mẫu.</p><dl className="dialect-definition">{(Object.entries(LABELS) as [TextKey,string][]).map(([k,label])=><div key={k}><dt>{label}</dt><dd>{form[k]}</dd></div>)}</dl><div className="dialect-review-consent"><h3>Phạm vi đã chọn</h3><p>Tiếp nhận & kiểm duyệt: Có</p><p>Huấn luyện: {form.consent_train?"Cho phép":"Không cho phép"}</p><p>Công khai: {form.consent_public?"Cho phép":"Không cho phép"}</p><button type="button" className="btn btn-link" onClick={()=>setStep(0)}>Thay đổi lựa chọn</button></div>{duplicates.data&&duplicates.data.filter(d=>d.id!==parent).length>0&&<Alert variant="warning"><strong>Bạn đã góp cách viết này trước đây</strong><p>Nếu khác nghĩa hoặc vùng, hãy giải thích trong ngữ cảnh.</p>{duplicates.data.filter(d=>d.id!==parent).map(d=><p key={d.id}><Link to={`/my/contributions/${d.id}`} target="_blank">#{d.id} · {d.meaning} · {d.region}</Link></p>)}</Alert>}{duplicates.error&&<Alert variant="warning">Chưa kiểm tra được mẫu bạn đã gửi trước đây. Bạn vẫn có thể gửi bản gốc để được đánh giá.</Alert>}<p className="dialect-fine-print">Kiểm tra trùng hiện chỉ tìm cách viết trong đóng góp của bạn. Mẫu được lưu bản gốc; chưa tự động xác minh hoặc nhận thưởng.</p></>}
        <div className="dialect-wizard-footer"><button type="button" className="btn btn-outline-secondary" disabled={step===0||sending} onClick={()=>{setStep(v=>v-1);setError(null);}}>Quay lại</button><button type="submit" className="btn btn-primary" disabled={sending}>{sending?"Đang gửi…":step===3?"Gửi đóng góp":"Tiếp tục"}<i className="bi bi-arrow-right" aria-hidden="true"/></button></div>
        </fieldset></form>
      </section>
    </div>
    <Modal centered show={blocker.state==="blocked"} onHide={()=>blocker.state==="blocked"&&blocker.reset()}><Modal.Header closeButton><Modal.Title>Đóng góp chưa được gửi</Modal.Title></Modal.Header><Modal.Body>{draftError?"Không lưu được nháp trên thiết bị. Hãy sao chép nội dung nếu bạn muốn giữ lại.":"Nháp được giữ theo tài khoản trên trình duyệt này. Khi quay lại, bạn có thể tiếp tục."}</Modal.Body><Modal.Footer><button className="btn btn-outline-secondary" onClick={()=>blocker.state==="blocked"&&blocker.reset()}>Tiếp tục nhập</button><button className="btn btn-primary" onClick={()=>blocker.state==="blocked"&&blocker.proceed()}>Rời trang</button></Modal.Footer></Modal>
  </>;
}
