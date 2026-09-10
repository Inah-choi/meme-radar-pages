// 뱅어 레이더 · GET /api/radar/bangers 를 읽어 레인별 카드로 표시합니다.
// 점수는 관측된 주목도이며 수익 확률이 아닙니다. 원천이 주지 않은 값(null)은 표시하지 않습니다.
import {createNextBangers} from './next-bangers.mjs?v=b073c021290d1f359800';
const rows=value=>Array.isArray(value)?value:[];
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const text=value=>typeof value==='string'&&value.trim()?value.trim():null;
const count=value=>value.toLocaleString('ko-KR',{maximumFractionDigits:1});
const signed=value=>`${value>0?'+':''}${count(value)}`;
const usd=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:value>=1000?'compact':'standard',maximumFractionDigits:value<1&&value>0?4:1}).format(value);
const safeUrl=value=>{try{const url=new URL(String(value));return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}};
const ago=value=>{const time=Date.parse(value);if(!Number.isFinite(time))return null;const diff=Math.max(0,Date.now()-time);if(diff<60_000)return '방금';if(diff<3_600_000)return `${Math.floor(diff/60_000)}분 전`;if(diff<86_400_000)return `${Math.floor(diff/3_600_000)}시간 전`;return `${Math.floor(diff/86_400_000)}일 전`;};
const clock=value=>{const time=Date.parse(value);return Number.isFinite(time)?new Date(time).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}):null;};
export const LANE_KEYS=['catalyst','event','character'];
export const laneLabels={catalyst:'촉매',event:'사건',character:'캐릭터',onchain:'온체인',ticker:'티커'};
export const originLabels={robinhood_official:'Robinhood 공식',artist:'작가 원천',ai_origin:'AI 원천',amplifier:'확산 계정',watchlist:'감시 계정',observed:'관측 작성자',public_feed:'공개 피드'};
export const riskLabels={CREATOR_RIGHTS:'작가 권리 주의',OFFICIAL_LAUNCH:'공식 발행 주장',TOKEN_PROMO:'토큰 홍보',BRAND_PROMO:'브랜드·마케팅 게시물 가능성',ALREADY_TOKENIZED:'이미 토큰화'};
// 'not_found'는 30일 상장 목록과 이름이 확인된 등록부 행에 같은 이름이 없다는 뜻이며, 발행되지 않았다는 보증이 아니다. 'unknown'은 표시하지 않는다.
export const NOT_FOUND_LABEL='등록부에 같은 이름 없음';
export const REGISTRY_UNAVAILABLE_NOTICE='런치 등록부 미동기화 · 온체인 중복 확인 불가 (서버 재시작 후 rpc-robinhood-launches 수집이 시작됩니다)';
export const unresolvedNotice=n=>`이름 미확인 런치 ${count(n)}건 · 이 이름들은 대조되지 않았습니다`;
const statusLabels={healthy:'정상',ok:'정상',active:'정상',success:'정상',not_modified:'정상',cached:'정상',available:'접근 가능',limited:'접근 제한',blocked:'접근 제한',rate_limited:'요청 제한',degraded:'부분 제한',partial:'부분 수집',unavailable:'사용 불가',disabled:'비활성',error:'오류',failed:'오류',pending:'대기',waiting:'대기',idle:'대기'};
const statusTone=status=>['healthy','ok','active','success','not_modified','cached','available'].includes(status)?'ok':['error','failed','unavailable'].includes(status)?'error':['limited','blocked','rate_limited','degraded','partial'].includes(status)?'warning':'idle';
const metricLabels=[['views','조회'],['likes','좋아요'],['reposts','재게시'],['replies','답글'],['quotes','인용']];
const partLabels=[['attention','주목도'],['velocity','속도'],['freshness','신선도'],['origin','원천'],['image','이미지'],['risk','위험'],['duplicate','중복']];
export const DEFAULT_DISCLAIMER='점수는 관측된 주목도이며 수익 확률이 아닙니다. 발행 적격성은 기존 정책 규칙을 따릅니다.';
export const EMPTY_MESSAGE='아직 이 기간에 뱅어 후보가 없습니다. 수집 소스 상태를 확인하세요.';

export function createBangerRadar({api,document=globalThis.document,onOpenCandidate=()=>{},toast=()=>{}}){
  const nextBangers=createNextBangers({api,document,onOpenCandidate,toast});
  const $=id=>document.querySelector(id),el=(tag,cls,value)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!=null)n.textContent=String(value);return n;};
  const add=(parent,...children)=>{for(const child of children)if(child)parent.append(child);return parent;};
  const clear=id=>{const n=$(id);if(n)n.replaceChildren();return n;};
  const link=(label,url,cls='text-link')=>{const safe=safeUrl(url);if(!safe)return null;const n=el('a',cls,label);n.href=safe;n.target='_blank';n.rel='noopener noreferrer';return n;};
  const button=(label,fn,cls='button small subtle')=>{const n=el('button',cls,label);n.type='button';n.addEventListener('click',fn);return n;};
  const pill=(label,tone)=>el('span',`pill${tone?` ${tone}`:''}`,label);
  let result=null,loading=false,error='',version=0,lastAt=null,searchTimer=null;
  const visible=()=>{const section=$('#page-bangers');return Boolean(section)&&!section.hidden;};
  const control=(id,fallback)=>{const n=$(id);return n&&n.value!==undefined&&n.value!==''?String(n.value):fallback;};
  function query(){
    const params=new URLSearchParams({hours:control('#banger-hours','24'),limit:'30',lane:control('#banger-lane','all'),sort:control('#banger-sort','score'),excludeLaunched:$('#banger-exclude-launched')?.checked?'true':'false'});
    const q=text($('#banger-search')?.value);if(q)params.set('q',q.slice(0,200));return params;
  }
  function renderStatus(){
    const updated=$('#banger-updated');if(updated)updated.textContent=loading?'불러오는 중…':lastAt?`${clock(new Date(lastAt).toISOString())} 갱신`:'';
    const disclaimer=$('#banger-disclaimer');if(disclaimer)disclaimer.textContent=text(result?.disclaimer)||DEFAULT_DISCLAIMER;
    const err=$('#banger-error');if(err){err.hidden=!error;err.textContent=error;}
    const refresh=$('#banger-refresh');if(refresh)refresh.disabled=loading;
  }
  function stat(label,value,description){return add(el('div','stat-card banger-stat'),el('div','stat-label',label),el('div','stat-value',value),el('div','stat-description',description));}
  function renderPulse(){
    const grid=clear('#banger-pulse');if(!grid)return;const pulse=result?.pulse||{},rh=pulse.robinhood||{},coverage=pulse.coverage||{},lanes=result?.lanes||{};
    if(finite(rh.newPools24h))grid.append(stat('Robinhood 24h 새 풀',count(rh.newPools24h),'GeckoTerminal 새 풀 · 토큰 기준 중복 제거'));
    if(finite(rh.launchesLastHour))grid.append(stat('최근 1시간 런치',count(rh.launchesLastHour),'RPC 런치 등록부'));
    if(finite(rh.launchesLast24h))grid.append(stat('24h 런치',count(rh.launchesLast24h),'RPC 런치 등록부'));
    for(const key of LANE_KEYS){const lane=lanes[key];if(finite(lane?.total))grid.append(stat(laneLabels[key],count(lane.total),text(lane.description)||text(lane.label)||'이 기간 관측 원문'));}
    if(finite(coverage.withMetrics)&&finite(coverage.windowPosts)&&coverage.windowPosts>0)grid.append(stat('지표 있는 원문 비율',`${count(Math.round(coverage.withMetrics/coverage.windowPosts*1000)/10)}%`,`${count(coverage.withMetrics)} / ${count(coverage.windowPosts)} 원문${finite(coverage.noiseFloorViews)?` · 검색 유입 조회 ${count(coverage.noiseFloorViews)} 미만 제외`:''}`));
    grid.hidden=grid.children.length===0;
  }
  function metrics(item){const wrap=el('div','banger-metrics');for(const [key,label] of metricLabels){const value=item?.metrics?.[key];if(finite(value))add(wrap,add(el('span'),el('small','',label),el('strong','',count(value))));}return wrap.children.length?wrap:null;}
  function velocity(item){const v=item?.velocity;if(!finite(v?.deltaMinutes))return null;const parts=[finite(v.viewsDelta)&&`조회 ${signed(v.viewsDelta)}`,finite(v.engagementDelta)&&`반응 ${signed(v.engagementDelta)}`].filter(Boolean);return parts.length?el('p','banger-velocity',`최근 ${count(v.deltaMinutes)}분: ${parts.join(' · ')}`):null;}
  function scoreBlock(item){
    if(!finite(item.score))return null;const score=Math.max(0,Math.min(100,item.score)),wrap=el('div','banger-score');const bar=el('div','banger-score-bar'),fill=el('span','banger-score-fill');fill.style.width=`${score}%`;bar.append(fill);add(wrap,add(el('div','banger-score-head'),el('span','banger-score-label','관측 주목도'),el('strong','banger-score-value',count(score))),bar);
    const parts=partLabels.filter(([key])=>finite(item.scoreParts?.[key]));if(parts.length){const detail=el('details','banger-score-parts');detail.append(el('summary','','점수 구성'));const list=el('ul');for(const [key,label] of parts)list.append(el('li','',`${label} ${signed(item.scoreParts[key])}`));detail.append(list);wrap.title=parts.map(([key,label])=>`${label} ${signed(item.scoreParts[key])}`).join(' · ');wrap.append(detail);}
    return wrap;
  }
  function robinhoodStatus(item){
    const rh=item.robinhood||{},status=String(rh.status||'unknown'),wrap=el('div','banger-status'),matches=rows(rh.matches).filter(match=>match&&typeof match==='object');
    if(status==='launched')add(wrap,pill(`이미 발행됨 · ${count(matches.length)}건`,'warning'));else if(status==='not_found')wrap.append(pill(NOT_FOUND_LABEL));
    for(const match of matches.slice(0,3)){const label=[text(match.tokenName),text(match.tokenSymbol)&&`$${match.tokenSymbol}`].filter(Boolean).join(' · ')||'토큰';wrap.append(link(`${label} ↗`,match.url,'text-link banger-match')||el('span','banger-match',label));}
    for(const cross of rows(item.crossChain).filter(entry=>entry&&typeof entry==='object').slice(0,5)){const label=[text(cross.chain),text(cross.tokenSymbol)?`$${cross.tokenSymbol}`:text(cross.tokenName)].filter(Boolean).join(' · ');if(label)wrap.append(link(`${label} ↗`,cross.url,'banger-chip')||el('span','banger-chip',label));}
    for(const risk of rows(item.risks).filter(entry=>entry&&typeof entry==='object')){const label=text(risk.label)||riskLabels[risk.code]||text(risk.code);if(label)wrap.append(pill(label,'error'));}
    return wrap;
  }
  function candidateBlock(item){
    const c=item.candidate,wrap=el('div','banger-candidate');if(!c||typeof c!=='object')return add(wrap,el('p','muted','AI 후보 미생성'));
    const head=add(el('div','banger-candidate-head'),el('strong','',text(c.title)||'후보'));if(c.hasDraft===true)head.append(pill('초안 있음','info'));if(text(c.discoveryStage))head.append(el('span','muted',c.discoveryStage));wrap.append(head);
    if(c.proposal&&(text(c.proposal.name)||text(c.proposal.symbol)))wrap.append(el('p','banger-proposal',`제안: ${text(c.proposal.name)||'이름 없음'}${text(c.proposal.symbol)?` / ${c.proposal.symbol}`:''}`));
    if(finite(c.score))wrap.append(el('p','muted',`후보 점수 ${count(c.score)}`));return wrap;
  }
  function card(item){
    const article=el('article','banger-card');article.setAttribute('role','listitem');const image=safeUrl(item.imageUrl);
    if(image){const img=el('img','banger-thumb');img.src=image;img.alt=text(item.title)||'원문 첨부 이미지';img.loading='lazy';img.referrerPolicy='no-referrer';img.addEventListener('error',()=>img.remove(),{once:true});article.append(img);}
    const body=el('div','banger-card-body');article.append(body);
    add(body,add(el('div','banger-badges'),pill(laneLabels[item.lane]||text(item.lane)||'사건'),pill(originLabels[item.originTier]||text(item.originTier)||'공개 피드','info')));
    const title=text(item.title)||text(item.text)?.slice(0,80)||text(item.sourceName)||'제목 없음';body.append(el('h3','',title));
    const bodyText=text(item.text);if(bodyText&&bodyText!==title){const p=el('p','banger-text',bodyText.slice(0,600));body.append(p);if(bodyText.length>160){const more=button('더 보기',()=>{const open=p.className.includes('expanded');p.className=open?'banger-text':'banger-text expanded';more.textContent=open?'더 보기':'접기';},'banger-more');body.append(more);}}
    const handle=text(item.authorHandle)?`@${item.authorHandle}`:text(item.author);const meta=[handle,text(item.sourceName)||text(item.sourceId),ago(item.publishedAt)||ago(item.observedAt)].filter(Boolean);if(meta.length)body.append(el('p','banger-meta',meta.join(' · ')));
    add(body,metrics(item),velocity(item),scoreBlock(item));
    const reasons=rows(item.reasons).filter(reason=>text(reason)).slice(0,5);if(reasons.length){const list=el('ul','banger-reasons');for(const reason of reasons)list.append(el('li','',reason));body.append(list);}
    add(body,robinhoodStatus(item),candidateBlock(item));
    const actions=el('div','banger-actions');add(actions,link('원문 열기 ↗',item.url,'button small subtle')||el('span','muted','원문 링크 없음'));
    if(item.candidate?.id!=null){const id=item.candidate.id;actions.append(button('후보 열기',async()=>{try{await onOpenCandidate(id);}catch(err){toast(`후보를 열지 못했습니다: ${err.message}`,true);}},'button small primary'));}
    body.append(actions);return article;
  }
  function renderLanes(){
    const wrap=clear('#banger-lanes'),empty=clear('#banger-empty');if(!wrap||!empty)return;const lanes=result?.lanes||{},selected=control('#banger-lane',String(result?.lane||'all'));let shown=0;
    const rh=result?.pulse?.robinhood||{},coverage=result?.pulse?.coverage||{};
    if(coverage.launchRegistry==='unavailable')wrap.append(el('p','banger-notice warning',REGISTRY_UNAVAILABLE_NOTICE));
    else if(finite(rh.unresolvedTokens)&&rh.unresolvedTokens>0)wrap.append(el('p','banger-notice',unresolvedNotice(rh.unresolvedTokens)));
    for(const key of LANE_KEYS){if(selected!=='all'&&selected!==key)continue;const lane=lanes[key];if(!lane||typeof lane!=='object')continue;const items=rows(lane.items).filter(item=>item&&typeof item==='object');
      const section=el('section','banger-lane');section.id=`banger-lane-${key}`;const heading=add(el('div','banger-lane-heading'),el('h2','',text(lane.label)||laneLabels[key]));if(finite(lane.total))heading.append(el('span','count-label',`${count(lane.total)}개`));section.append(heading);if(text(lane.description))section.append(el('p','muted',lane.description));
      const grid=el('div','banger-grid');grid.setAttribute('role','list');for(const item of items)grid.append(card(item));shown+=items.length;section.append(items.length?grid:el('p','banger-lane-empty','이 레인에 표시할 원문이 없습니다.'));wrap.append(section);}
    wrap.setAttribute('aria-busy',String(loading));empty.hidden=shown>0||(loading&&!result);
    if(!empty.hidden)add(empty,el('strong','',result?'뱅어 후보 없음':'결과 없음'),el('p','',result?EMPTY_MESSAGE:error?'마지막 요청이 실패했습니다. 새로고침을 눌러 다시 시도하세요.':EMPTY_MESSAGE));
    if(loading&&!result){empty.hidden=false;add(empty,el('strong','','뱅어 후보를 불러오는 중'),el('p','','관측 원문과 온체인 중복 여부를 확인합니다.'));}
  }
  function renderAll(){renderStatus();renderPulse();renderLanes();}
  async function load({silent=false}={}){
    const token=++version;loading=true;error='';renderStatus();if(!result)renderLanes();
    try{const data=await api(`/api/radar/bangers?${query()}`);if(token!==version)return;result=data&&typeof data==='object'?data:null;lastAt=Date.now();}
    catch(err){if(token!==version)return;error=`뱅어 레이더 갱신 실패: ${err.message}${result?' 마지막으로 받은 결과를 표시합니다.':''}`;if(!silent)toast(error,true);}
    finally{if(token===version){loading=false;renderAll();}}
  }
  function render(){return Promise.all([load({silent:false}),nextBangers.refresh()]);}
  function refresh({silent=true}={}){if(!visible()||loading)return Promise.resolve();return Promise.all([load({silent}),nextBangers.refresh()]);}
  function reset(){version++;result=null;loading=false;error='';lastAt=null;clearTimeout(searchTimer);nextBangers.reset();for(const id of ['#banger-pulse','#banger-lanes','#banger-empty'])clear(id);renderStatus();}
  for(const id of ['#banger-hours','#banger-lane','#banger-sort','#banger-exclude-launched'])$(id)?.addEventListener('change',()=>render());
  $('#banger-refresh')?.addEventListener('click',()=>render());
  $('#banger-search')?.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>render(),300);});
  return {render,refresh,reset,query};
}
