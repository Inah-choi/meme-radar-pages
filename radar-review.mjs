const rows=value=>Array.isArray(value)?value:[];
const metric=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
const count=value=>metric(value)===null?'미제공':value.toLocaleString('ko-KR');
const usd=value=>metric(value)===null?'미제공':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:value>=1000?'compact':'standard',maximumFractionDigits:value<1&&value>0?4:1}).format(value);
const percent=value=>typeof value==='number'&&Number.isFinite(value)?`${value>0?'+':''}${value.toLocaleString('ko-KR',{maximumFractionDigits:2})}%`:'미제공';
const familyId=value=>`market-family-${String(value).replace(/[^A-Za-z0-9_-]/g,'-')}`;
const marketFlagLabels={severe24hdrawdown:'24h 큰 하락',highturnover:'거래량/유동성 높음',norecentvolume:'최근 거래량 확인 필요',paidboost:'유료 부스트 관측'};
const safeUrl=value=>{try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null;}catch{return null;}};
const englishProposal=item=>item.proposal&&[item.proposal.name,item.proposal.description].every(value=>typeof value==='string'&&/^[\t\n\r\x20-\x7e]*$/.test(value))?item.proposal:null;

export function createRadarReview({api,document=globalThis.document,onNavigatePosts=()=>{},onOpenCandidate=()=>{},onStats=()=>{}}){
  const $=id=>document.querySelector(id),el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=String(text);return n;};
  const add=(parent,...children)=>{for(const child of children)if(child)parent.append(child);return parent;};
  const clear=id=>{const n=$(id);n.replaceChildren();return n;};
  const link=(label,url)=>{const safe=safeUrl(url);if(!safe)return el('span','muted',`${label} · 링크 없음`);const n=el('a','text-link',label);n.href=safe;n.target='_blank';n.rel='noopener noreferrer';return n;};
  const button=(label,fn,cls='button small subtle')=>{const n=el('button',cls,label);n.type='button';n.addEventListener('click',fn);return n;};
  let result=null,selected=[],offset=0,limit=50,canEdit=false,loading=false,saving=false,error='',version=0,queryKey='';
  const active=()=>$('#candidate-view')?.value==='review';
  function fail(message){error=String(message);renderError();}
  function renderError(){const n=$('#review-error');n.hidden=!error;n.textContent=error;}
  function stat(label,value,description){return add(el('div','stat-card'),el('div','stat-label',label),el('div','stat-value',metric(value)===null?'—':count(value)),el('p','stat-description',description));}
  function renderStats(){
    if(!active())return;const summary=result?.summary||{};
    add(clear('#stats-grid'),stat('관측된 소재',summary.materials,'현재 원문 기반 소재 · 검색 전'),stat('원문 확보',summary.withOrigin,'소재 원문이 연결된 항목'),stat('영문 구상 준비',summary.englishReady,'영어 이름·설명 구상이 있는 항목'),stat('비교에 담은 소재',summary.selected,'선택사항 · 최대 두 콘셉트'));
    $('#nav-count').textContent=metric(summary.materials)===null?'—':count(summary.materials);
  }
  function metrics(item){const wrap=el('div','review-metrics');for(const [key,label] of [['views','조회'],['likes','좋아요'],['reposts','재게시'],['replies','답글']])add(wrap,add(el('span'),el('small','',label),el('strong','',count(item?.metrics?.[key]))));return wrap;}
  function marketToken(token){
    const observed=Date.parse(token.observedAt),observedLabel=Number.isFinite(observed)?` · ${new Date(observed).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false})} 관측`:'';
    const entry=el('article','market-family-token'),name=add(el('div','market-token-name'),link(`${token.name||'이름 미제공'}${token.symbol?` · $${token.symbol}`:''} ↗`,token.url),el('span','market-token-chain',`${token.chain||'체인 미제공'}${observedLabel}`));
    if(token.address)name.title=`${token.chain||''} · ${token.address}`;
    add(entry,name);const values=el('div','market-token-values');
    for(const [label,value] of [['24h 거래량',usd(token.volume24hUsd)],['1h 거래량',usd(token.volume1hUsd)],['유동성',usd(token.liquidityUsd)],['1h 변동',percent(token.priceChange1hPct)]])add(values,add(el('span'),el('small','',label),el('strong','',value)));
    add(entry,values,el('p','market-token-trades',`매수 / 매도 건수 · 1h ${count(token.buys1h)} / ${count(token.sells1h)} · 24h ${count(token.buys24h)} / ${count(token.sells24h)}`));
    const flags=[...new Set(rows(token.flags).map(flag=>marketFlagLabels[String(flag).toLowerCase().replace(/[^a-z0-9]/g,'')]).filter(Boolean))];
    if(flags.length)entry.append(el('p','market-token-flags',flags.join(' · ')));
    return entry;
  }
  function renderMarketFamilies(){
    const panel=clear('#market-families'),snapshot=result?.marketFamilies,families=rows(snapshot?.families),heading=el('div','market-families-heading');
    add(heading,el('h3','','지금 거래되는 파생 계열'),el('span','eyebrow','LIVE MARKET THEMES'));add(panel,heading,el('p','market-family-disclaimer','이름·테마 유사 · 공식 파생 관계 미확인'));
    if(!families.length){panel.append(el('p','market-families-empty',loading?'최근 거래 계열을 불러오는 중입니다.':'최근 관측에서 거래량과 유동성이 확인된 유사 이름 계열이 없습니다.'));return;}
    const observed=Date.parse(snapshot.asOf),ageLimit=metric(snapshot.maxAgeMinutes),time=Number.isFinite(observed)?new Date(observed).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'시각 미제공';
    add(panel,el('p','market-family-meta',`${time} 집계${ageLimit!==null?` · 최근 ${count(ageLimit)}분 관측`:''} · 대표 유동성 풀의 관측값 · USD${snapshot.inputTruncated?' · 최근 저장 표본 내 계열':''}`));
    if(Number.isFinite(observed)&&ageLimit!==null&&Date.now()-observed>ageLimit*60000)panel.append(el('p','market-token-flags','관측 정보가 오래되었습니다. 출처에서 현재 거래 상태를 확인하세요.'));
    const grid=el('div','market-families-grid');
    for(const family of families){const group=el('section','market-family');group.id=familyId(family.id);const tokens=rows(family.tokens);add(group,add(el('div','market-family-heading'),el('h4','',family.label||'이름 유사 계열'),el('span','muted',`${count(metric(family.tokenCount)===null?tokens.length:family.tokenCount)}개 관측 · 상위 ${Math.min(3,tokens.length)}개 표시`)));if(family.pattern)group.append(el('p','market-family-pattern',family.pattern));for(const token of tokens.slice(0,3))group.append(marketToken(token));grid.append(group);}
    add(panel,grid,el('p','market-family-meta','소재의 이름·본문·영문 구상과 계열 단어의 연관성을 먼저 봅니다. 발행 판단은 기존 자동화 정책을 따릅니다.'));
  }
  function marketAffinity(item){
    const families=rows(result?.marketFamilies?.families),matches=rows(item.marketFamilyMatches).filter(match=>families.some(family=>family.id===match.id)).slice(0,3);if(!matches.length)return null;
    const wrap=el('div','market-affinity');wrap.append(el('span','', '이름·본문 연관'));
    for(const match of matches){const tag=button(`${match.label} ↗`,()=>{const target=$(`#${familyId(match.id)}`);target?.scrollIntoView({behavior:'smooth',block:'center'});},'market-affinity-link');tag.title=`연관 기준: ${rows(match.matchedTerms).join(', ')} · 이름·테마 유사성 참고`;wrap.append(tag);}return wrap;
  }
  function sourcePost(item){return rows(item.evidence).find(post=>post.role==='origin');}
  function hook(item){const p=englishProposal(item),wrap=el('div','review-hook');add(wrap,el('span','eyebrow','ENGLISH CONCEPT · AI IDEA'));if(p)add(wrap,el('strong','',`${p.name}${p.symbol?` · $${p.symbol}`:''}`),el('p','',p.description));else add(wrap,el('p','muted','저장된 영어 구상이 없습니다. 발행 구상에서 영어 초안을 확인하세요.'));return wrap;}
  function policyStatus(item){
    const decision=item.policyDecision,wrap=el('div','material-policy-status');
    add(wrap,el('span',`pill ${decision?.allowed===true?'success':decision?.allowed===false?'warning':''}`,decision?.allowed===true?'후보 조건 통과':decision?.allowed===false?'정책 보류':'정책 확인 중'));
    if(decision?.allowed===false){
      const reasons=rows(decision.reasons).map(reason=>typeof reason==='string'?reason:reason?.message||reason?.reason||reason?.code||'조건 미충족');
      if(reasons.length)add(wrap,el('p','muted',reasons.slice(0,2).map(reason=>String(reason).slice(0,180)).join(' · ')));
      if(reasons.length>2){const detail=el('details','material-policy-reasons');add(detail,el('summary','',`보류 이유 ${reasons.length}개`));for(const reason of reasons)detail.append(el('p','muted',reason));wrap.append(detail);}
    }
    return wrap;
  }
  function automationStatus(){const automation=result?.automation,wrap=clear('#review-access');const mode=!automation?'자동화 상태 확인 중':automation.mode==='PAPER'?'PAPER · 발행 시뮬레이션':automation.mode==='AUTO'?'AUTO · 정책 조건에 따라 자동 진행':String(automation.mode||'모드 미확인');const flags=[automation?.dryRun===true?'DRY_RUN · 실제 전송 없음':automation?.dryRun===false?'DRY_RUN=false':null,automation?.emergencyStop?'긴급 정지':automation?.paused?'자동화 일시정지':null].filter(Boolean);add(wrap,el('strong','',mode),el('span','',flags.length?` · ${flags.join(' · ')}`:''));const policy=el('a','text-link','자동화 정책 보기 ↗');policy.href='#policy';wrap.append(policy);}
  async function showCandidate(item){if($('#review-dialog').open)$('#review-dialog').close();try{await onOpenCandidate(item.id);}catch(err){fail(`발행 구상을 열지 못했습니다: ${err.message}`);}}
  function proposalButton(item){return button('발행 구상',()=>showCandidate(item),'button small primary');}
  function selectButton(item){const selectedNow=item.review?.selected===true;const n=button(selectedNow?'비교에서 빼기':'비교에 담기',()=>toggle(item));n.disabled=!canEdit||saving||(!selectedNow&&(selected.length>=2||item.unavailable));n.title=!canEdit?'비교 선택 저장에는 운영자 권한이 필요합니다.':!selectedNow&&selected.length>=2?'최대 두 소재를 비교할 수 있습니다.':'';return n;}
  function card(item){
    const card=el('article','review-card');card.setAttribute('role','listitem');
    if(item.unavailable)return add(card,el('h3','',item.title),el('p','review-stale','현재 소재 목록에서 제외된 선택입니다. 비교에서 빼면 다른 소재를 담을 수 있습니다.'),selectButton(item));
    add(card,add(el('div','review-card-heading'),el('h3','',item.title),el('span','pill',englishProposal(item)?'영문 구상 준비':'영문 구상 없음')),marketAffinity(item));
    const source=sourcePost(item),image=source&&safeUrl(source.imageUrl);
    if(image?.startsWith('https:')){const img=el('img','review-thumbnail');img.src=image;img.alt='소재 원문 첨부 이미지';img.loading='lazy';img.referrerPolicy='no-referrer';img.addEventListener('error',()=>img.remove(),{once:true});card.append(img);}
    add(card,el('p','review-source-label',source?`소재 원문 · ${source.author||'작성자 미제공'}`:'소재 원문 미확보'),metrics(source));
    if(source)add(card,link('이 수치의 원문 ↗',source.url));
    add(card,el('p','review-observed',`관측 원문 ${count(item.observed?.posts)}개 · 작성자 ${count(item.observed?.authors)}명 · 원문 시드 외 작성자 ${count(item.observed?.nonOwnerAuthors)}명`),el('p','review-context-note',`연결 맥락 ${count(item.observed?.contextPosts)}개는 소재 원문과 구분합니다.`),hook(item),add(el('div','review-ai-idea'),el('span','eyebrow','AI 아이디어'),el('p','',item.whyNow||'주목 이유 미제공'),el('p','muted',item.remixHook||'재창작 아이디어 미제공')));
    add(card,policyStatus(item),add(el('div','review-card-actions'),proposalButton(item),button('원문 근거',()=>openEvidence(item)),selectButton(item)));return card;
  }
  function renderCompare(){
    const panel=clear('#review-compare');panel.hidden=selected.length===0;
    add(panel,add(el('div','review-compare-heading'),el('h3','','두 콘셉트 비교'),el('span','muted',`${selected.length} / 2 선택`)),el('p','muted','영어 발행 구상과 관측된 원문을 나란히 볼 수 있습니다. 비교 선택은 선택사항입니다.'));
    const grid=el('div','review-compare-grid');
    for(const item of selected){const column=el('article','review-compare-item');add(column,el('h3','',item.title));if(item.unavailable)add(column,el('p','review-stale','현재 소재 목록에서 제외된 선택입니다. 비교에서 빼면 다른 소재를 담을 수 있습니다.'));else{add(column,hook(item),el('p','review-observed',`소재 원문 최고 조회수 ${count(item.observed?.viewsMax)} · 원문 시드 외 작성자 ${count(item.observed?.nonOwnerAuthors)}명`),el('p','review-context-note','최고 조회수는 소재 원문 중 가장 큰 값입니다.'),el('p','review-ai-idea',`AI 재창작 아이디어: ${item.remixHook||'미제공'}`),proposalButton(item),button('원문 근거',()=>openEvidence(item)));}add(column,selectButton(item));grid.append(column);}
    for(let i=selected.length;i<2;i++)add(grid,add(el('div','review-compare-placeholder'),el('strong','','두 번째 콘셉트'),el('p','muted','다른 소재를 비교에 담아 나란히 볼 수 있습니다.')));panel.append(grid);
  }
  function render(){
    if(!active())return;const items=rows(result?.items),cards=clear('#review-cards');cards.setAttribute('aria-busy',String(loading));for(const item of items)cards.append(card(item));const empty=clear('#review-empty');empty.hidden=items.length>0;
    if(!items.length)add(empty,el('strong','',loading?'소재와 발행 구상을 불러오는 중':'이 조건에 맞는 소재가 없습니다'),el('p','',loading?'관측 원문과 영어 구상을 확인합니다.':'검색 조건을 조정하거나 인기 게시물에서 원문을 살펴보세요.'),button('인기 게시물에서 발견 ↗',onNavigatePosts));
    automationStatus();renderMarketFamilies();
    $('#candidate-total').textContent=metric(result?.total)===null?'—':`${count(result.total)}개`;$('#results-label').textContent=result?`${count(result.total)}개 중 ${items.length?offset+1:0}–${offset+items.length} 표시 · 관측 원문과 영어 발행 구상`:'소재를 불러오는 중';$('#review-page-label').textContent=result?.total?`${Math.floor(offset/limit)+1} / ${Math.ceil(result.total/limit)}`:'—';$('#review-previous').disabled=loading||offset===0;$('#review-next').disabled=loading||!result||offset+items.length>=result.total;renderError();renderCompare();renderStats();onStats();
  }
  async function fetchMaterials({offset:requestedOffset=offset}={}){
    const token=++version;const params=new URLSearchParams({q:$('#review-search').value,stage:$('#review-stage').value,sort:$('#review-sort').value,limit:String(limit),offset:String(requestedOffset)});const key=JSON.stringify([params.get('q'),params.get('stage'),params.get('sort')]);if(key!==queryKey){result=null;queryKey=key;offset=requestedOffset;}loading=true;error='';render();
    try{const [page,compare]=await Promise.all([api(`/api/radar/review?${params}`),api('/api/radar/review?stage=selected&sort=evidence&limit=2&offset=0')]);if(token!==version||!active())return;result=page;selected=rows(compare.items);offset=page.offset;limit=page.limit;canEdit=page.canEdit===true&&compare.canEdit===true;}catch(err){if(token===version)error=`소재 갱신 실패: ${err.message}`;}finally{if(token===version){loading=false;render();}}
  }
  async function toggle(item){if(saving||!canEdit)return;saving=true;render();try{await api(`/api/radar/review/${encodeURIComponent(item.id)}`,{method:'PATCH',body:{selected:!item.review?.selected,ifUpdatedAt:item.review?.updatedAt??null}});await fetchMaterials();}catch(err){fail(`비교 선택 저장 실패: ${err.message}`);}finally{saving=false;render();}}
  function evidenceCard(post){const card=el('article','review-evidence');add(card,el('span',`pill ${post.role==='origin'?'info':''}`,post.role==='origin'?'소재 원문':'연결 맥락 · 인용·답글 등'),el('strong','',post.author||'작성자 미제공'),el('p','',String(post.text||'텍스트 미제공').slice(0,2000)),metrics(post),link('이 게시물 원문 ↗',post.url));return card;}
  function openEvidence(item){const body=clear('#review-dialog-body');const title=el('h2','',item.title);title.id='review-dialog-title';add(body,title,el('p','review-context-note','관측된 소재 원문과 연결 맥락을 구분해 표시합니다.'),hook(item));for(const post of rows(item.evidence))body.append(evidenceCard(post));if(!rows(item.evidence).length)body.append(el('p','muted','표시할 원문이 없습니다.'));body.append(proposalButton(item));if(!$('#review-dialog').open)$('#review-dialog').showModal();}
  $('#review-dialog-close').addEventListener('click',()=>$('#review-dialog').close());$('#review-discover-posts').addEventListener('click',onNavigatePosts);
  for(const selector of ['#review-stage','#review-sort'])$(selector).addEventListener('change',()=>fetchMaterials({offset:0}));
  let searchTimer;$('#review-search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>fetchMaterials({offset:0}),250);});
  for(const [selector,delta] of [['#review-previous',-1],['#review-next',1]])$(selector).addEventListener('click',()=>{if(!$(selector).disabled)return fetchMaterials({offset:Math.max(0,offset+delta*limit)});});
  return {fetch:fetchMaterials,renderStats,open:openEvidence,deactivate(){version++;loading=false;},reset(){version++;result=null;selected=[];canEdit=false;offset=0;if($('#review-dialog').open)$('#review-dialog').close();}};
}
