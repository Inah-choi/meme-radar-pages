// Gas-free observation journal. Server values are rendered as text, never markup.
const list = value => Array.isArray(value) ? value : [];
const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const count = value => number(value) === null ? '—' : value.toLocaleString('ko-KR');
const date = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '—';
const statuses = { running: '모의 운영 중', completed: '관찰 기간 완료', stopped: '관찰 중지됨' };
const verdicts = { good: '판단이 맞아요', bad: '판단이 틀렸어요', missed: '발행 기회를 놓쳤어요', unsure: '더 지켜볼게요' };
const laneLabels = { automatic: '일반 자동 발행', hot: '핫레인', flash: '핫레인 자동 플래시', core_author: '유명인 원문 즉시 모의 발행' };
const preparationLabels = {queued:'이름·설명 생성 대기',generating_text:'이름·설명 생성 중',text_ready:'이름·설명 준비 완료 · 이미지 준비 대기',
  generating_image:'이름·설명 준비 완료 · 이미지 준비 중',ready:'발행 자료 준비 완료',retry_wait:'발행 자료 재시도 대기',failed:'발행 자료 생성 실패',context_missing:'답글·인용 원문 맥락 확인 필요'};
const coreAuthorsOf = simulation => list(simulation?.coreAuthors).filter(author => typeof author?.handle === 'string' && /^@?[A-Za-z0-9_]{1,15}$/.test(author.handle) && typeof author.authorId === 'string' && /^[1-9]\d{0,29}$/.test(author.authorId));
const targetLabels = { target_observed_after_decision: '판단 전 $1M 미만 → 이후 $1M 관측', already_at_target_before_decision: '판단 전에 이미 $1M',
  pre_decision_hit_received_late: '판단 전 $1M 자료를 늦게 수신', post_decision_target_baseline_unknown: '이후 $1M 관측·판단 전 기준값 없음',
  no_post_decision_observation: '판단 후 시장 관측 없음', fdv_only_target_observed: 'FDV만 $1M 관측', below_target_observed: '$1M 미만 관측', market_cap_unavailable: '시총 자료 없음' };
const reasonLabels = {
  CHALLENGER_SPECIFIC_SUBJECT_REQUIRED: '구체적인 사건·밈 구절 확인 필요', CHALLENGER_SOURCE_NAME_REQUIRED: '원문에 근거한 이름 검토 필요',
  CHALLENGER_INITIAL_REACH_REQUIRED: '초기 반응 기준 미달', CHALLENGER_SOURCE_STALE: '게시 후 2시간 초과',
  CHALLENGER_METRICS_STALE: '20분 이내의 새 반응 관측 없음', CHALLENGER_EXISTING_TOKEN_CONTEXT: '이미 발행된 토큰·종목 홍보 맥락',
  CHALLENGER_PROMOTION: '광고·판매·홍보 게시물', CHALLENGER_ORIGINAL_REQUIRED: '원문 확인 필요',
  CHALLENGER_OBSERVATION_REQUIRED: '판단 시점에 사용 가능한 관측 없음', CHALLENGER_PUBLIC_SOURCE_REQUIRED: '공개 원문 확인 필요',
  CHALLENGER_SOURCE_TIME_INVALID: '원문 시각 확인 필요', CHALLENGER_OBSERVATION_CONFLICT: '같은 시각의 관측이 서로 다름',
  CHALLENGER_UNTRUSTED_INSTRUCTION: '원문에 실행 지시 포함', CHALLENGER_SOURCE_ATTRIBUTION_REQUIRED: '작성자·출처 확인 필요',
  HOT_SOURCE_EVIDENCE_REQUIRED: '최근 공개 원문 증거 부족', HOT_CORROBORATION_REQUIRED: '원문 확산·핵심 계정 교차 확인 부족',
  HOT_DUPLICATE_COVERAGE_UNKNOWN: '기존 토큰 중복 확인 자료 부족', HOT_MARKET_SATURATED: '같은 이름·티커의 경쟁 토큰 과밀',
  HOT_ATTENTION_UNCONFIRMED: '반응 증가·독립 확산 확인 부족', HOT_REVIEW_REQUIRED: '소재 검토 미완료',
  HOT_REVIEW_REJECTED: '소재 검토에서 제외', HOT_REVIEW_WATCH: '소재 검토에서 추가 관찰 필요', HOT_QUALITY_UNCONFIRMED: '소재 적합성 확인 부족',
  HOT_SIGNAL_NOT_ARMED: '발행 대기 상태가 아님', HOT_SIGNAL_EXPIRED: '신호의 발행 대기 시간 만료', HOT_RETRY_PENDING: '재검토 예정 시각 대기',
  HOT_ASSESSMENT_TIME_INVALID: '판단 시각 확인 필요', HOT_SIGNAL_TIME_INVALID: '신호 시각 확인 필요',
  HOT_LANE_DISABLED: '핫레인 비활성 설정', HOT_LANE_MODE_WATCH: '관찰 전용 모드', HOT_LANE_EMERGENCY_STOP: '긴급 정지 상태',
  HOT_LANE_POLICY_PAUSED: '자동화 일시 정지', HOT_LANE_PAUSED: '핫레인 일시 정지',
  HOT_LANE_HOUR_CAP: '핫레인 시간당 한도 도달', HOT_LANE_DAY_CAP: '핫레인 일일 한도 도달', HOT_GLOBAL_SPACING: '핫레인 발행 간격 대기',
  HOT_DUPLICATE_LAUNCH: '동일 소재 발행 기록 존재', FLASH_DUPLICATE_LAUNCH: '동일 소재 플래시 발행 기록 존재',
  FLASH_LANE_DISABLED: '플래시 레인 비활성 설정', FLASH_LANE_PAUSED: '플래시 레인 일시 정지',
  FLASH_HOUR_CAP: '플래시 시간당 한도 도달', FLASH_DAY_CAP: '플래시 일일 한도 도달', FLASH_KEY_COOLDOWN: '동일 소재 재요청 대기',
  HOT_PROMOTIONAL_TAG_CAMPAIGN: '해시태그 홍보 캠페인', HOT_FAN_CAMPAIGN: '팬 참여·투표 캠페인',
  HOT_TOKEN_PROMOTION: '기존 토큰 매수 홍보', HOT_CAMPAIGN_PROMOTION: '선거·참여 홍보 캠페인',
  CORE_AUTHOR_PIN_MISMATCH: '계정 ID 확인 불일치', CORE_AUTHOR_REPOST_EXCLUDED: '단순 재게시 제외',
  CORE_AUTHOR_OWN_COMMENTARY_REQUIRED: '답글·인용에 작성자 본문 없음', CORE_AUTHOR_SOURCE_STALE: '게시 후 30분이 지난 글',
  CORE_AUTHOR_SOURCE_TIME_INVALID: '원문 시각 확인 필요', CORE_AUTHOR_BEFORE_ACTIVATION: '설정 적용 전 게시된 글',
  CORE_AUTHOR_IMMUTABLE_OBSERVATION_REQUIRED: '보존된 원문 관측 확인 필요', CORE_AUTHOR_PUBLIC_SOURCE_REQUIRED: '공개 원문 확인 필요',
  CORE_AUTHOR_ORIGINAL_POST_REQUIRED: '원문 게시물 확인 필요', CORE_AUTHOR_POST_IDENTITY_REQUIRED: '원문 게시물 ID 확인 필요', CORE_AUTHOR_DEMO_SOURCE: '예시 데이터는 대상에서 제외',
};
const reasonText = value => Object.hasOwn(reasonLabels, value) ? `${reasonLabels[value]} (${value})` : value;
export function formatTrialHours(value) {
  if (number(value) === null) return '—';
  const minutes = Math.max(0, Math.floor(value * 60));
  return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
}
const change = value => number(value) === null ? '—' : `${value > 0 ? '+' : ''}${Math.round(value * 10) / 10}`;

function downloadJson(payload) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const anchor = globalThis.document.createElement('a');
  anchor.href = url; anchor.download = `meme-paper-trial-${payload.session.id}.json`;
  anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function createPaperTrial({ api, document = globalThis.document, toast = () => {}, onChange = () => {}, download = downloadJson, objectUrls = globalThis.URL }) {
  const root = document.querySelector('#paper-trial-root');
  const el = (tag, className = '', value = '') => { const node = document.createElement(tag); node.className = className; if (value !== '') node.textContent = value; return node; };
  const add = (parent, ...children) => { parent.append(...children.filter(Boolean)); return parent; };
  const button = (label, id, className = 'button subtle') => { const node = el('button', className, label); node.type = 'button'; node.id = id; return node; };
  let snapshot = null, loading = false, pending = false, exporting = false, error = '', epoch = 0, resetEpoch = 0, selectedSession = '', renderedSession = null, offset = 0;
  let configDirty = false, configSession = null, selectionSession = null;
  const drafts = new Map(), rows = new Map(), selectionRows = new Map();
  const artwork = new Map();
  let rapidSnapshot=null,rapidError='',rapidRequest=null,rapidAbort=null,rapidEpoch=0,rapidSession='',rapidRenderSignature='';
  const rapidArtwork=new Map();
  function preparationImage(preparation) {
    if(!preparation?.image||preparation.status!=='ready') return null;
    const expected=`/api/paper-trial/metadata/${preparation.id}/image`;
    if(!/^[0-9a-f-]{36}$/i.test(preparation.id??'')||preparation.image.previewUrl!==expected||!/^[a-f0-9]{64}$/.test(preparation.image.sha256??''))
      return {error:'이미지 주소를 확인할 수 없습니다.'};
    const key=`${preparation.id}:${preparation.image.sha256}`;
    if(artwork.has(key)) return artwork.get(key);
    const entry={key,pending:true,url:null,error:''},mine=resetEpoch;artwork.set(key,entry);
    Promise.resolve().then(()=>api(expected,{responseType:'blob'})).then(blob=>{
      if(mine!==resetEpoch||artwork.get(key)!==entry)return;
      if(!blob||blob.type!=='image/png'||blob.size>10*1024*1024)throw new Error('모의 이미지 형식을 확인할 수 없습니다.');
      entry.url=objectUrls.createObjectURL(blob);entry.pending=false;entry.error='';draw();
    }).catch(failure=>{
      if(mine!==resetEpoch||artwork.get(key)!==entry)return;
      entry.pending=false;entry.error=failure.message||'모의 이미지를 불러오지 못했습니다.';draw();
    });
    return entry;
  }
  const heading = add(el('div', 'page-heading'), add(el('div'), el('div', 'eyebrow', 'PAPER TRIAL · OBSERVE, THEN REVIEW'), el('h1', '', '모의 운영'), el('p', 'muted', '하루 이틀 동안 발행 판단을 기록하고, 무엇이 잘못됐는지 피드백하세요.')));
  const refreshButton = button('새로고침 ↻', 'paper-trial-refresh');
  refreshButton.addEventListener('click', () => refresh({ force: true })); heading.append(refreshButton);
  const status = el('p', 'paper-trial-status muted'); status.id = 'paper-trial-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const controlPanel = el('section', 'panel paper-trial-control');
  const controlHeading = el('div', 'panel-heading');
  const pill = el('span', 'pill demo', '준비'); pill.id = 'paper-trial-pill';
  add(controlHeading, add(el('div'), add(el('h2'), el('span', '', '가스비 없이 시험 운영 '), pill), el('p', 'muted', '발행할 후보와 보류 이유를 기록합니다. 실제 토큰 생성과 매수는 하지 않습니다.')));
  const controls = el('div', 'paper-trial-controls');
  const durationLabel = el('label', '', '운영 기간'); durationLabel.htmlFor = 'paper-trial-duration';
  const duration = el('select'); duration.id = 'paper-trial-duration';
  for (const hours of [24, 48]) { const option = el('option', '', `${hours === 24 ? '하루' : '이틀'} · ${hours}시간`); option.value = String(hours); duration.append(option); }
  duration.value = '48';
  const startHotAuto = el('input'); startHotAuto.type = 'checkbox'; startHotAuto.id = 'paper-trial-start-hot-auto'; startHotAuto.checked = true;
  const startHotLabel = add(el('label', 'paper-trial-checkbox'), startHotAuto, el('span', '', '핫레인 자동 발행도 모의 실행'));
  const startButton = button('모의 운영 시작', 'paper-trial-start', 'button primary');
  const stopButton = button('지금 종료하고 검토', 'paper-trial-stop');
  startButton.addEventListener('click', () => control('start'));
  stopButton.addEventListener('click', () => control('stop'));
  add(controls, add(el('div', 'paper-trial-field'), durationLabel, duration), startHotLabel, startButton, stopButton);
  const simulationPanel = el('div', 'paper-trial-simulation');
  const simulationStatus = el('p', 'paper-trial-simulation-status'); simulationStatus.id = 'paper-trial-simulation-status';
  const coreStatus = el('p', 'paper-trial-simulation-status'); coreStatus.id = 'paper-trial-core-status';
  const configControls = el('div', 'paper-trial-config-controls');
  const hotAuto = el('input'); hotAuto.type = 'checkbox'; hotAuto.id = 'paper-trial-hot-auto';
  hotAuto.addEventListener('change', () => { configDirty = true; draw(); });
  const hotAutoLabel = add(el('label', 'paper-trial-checkbox'), hotAuto, el('span', '', '핫레인 자동 발행도 모의 실행'));
  const coreAuto = el('input'); coreAuto.type = 'checkbox'; coreAuto.id = 'paper-trial-core-auto';
  coreAuto.addEventListener('change', () => { configDirty = true; draw(); });
  const coreAutoLabel = add(el('label', 'paper-trial-checkbox'), coreAuto, el('span', '', '유명인 원문 즉시 모의 발행'));
  const applyConfigButton = button('모의 설정 적용', 'paper-trial-config-apply', 'button small subtle');
  applyConfigButton.addEventListener('click', configure);
  add(configControls, hotAutoLabel, coreAutoLabel, applyConfigButton);
  add(simulationPanel, simulationStatus, coreStatus, configControls, el('p', 'muted', '모의 판단에만 적용합니다. 실제 자동 발행 설정과 가스비 차단은 유지됩니다. 변경 전 기록도 그대로 보관합니다.'));
  const safety = el('p', 'paper-trial-safety'); safety.id = 'paper-trial-safety';
  const clock = el('p', 'paper-trial-clock'); clock.id = 'paper-trial-clock';
  const progress = el('progress', 'paper-trial-progress'); progress.max = 100; progress.value = 0; progress.setAttribute('aria-label', '모의 운영 관찰 시간');
  const schedule = el('p', 'muted paper-trial-schedule'); schedule.id = 'paper-trial-schedule';
  add(controlPanel, controlHeading, controls, simulationPanel, safety, clock, progress, schedule);

  const stats = el('div', 'stats-grid paper-trial-stats'); stats.id = 'paper-trial-stats';
  const statValues = {};
  for (const [key, label, detail] of [['evaluated', '판단 기록', '동일 후보를 다시 검토한 기록 포함'], ['wouldLaunch', '모의 발행', '선별 조건을 통과한 후보'], ['held', '보류 판단', '제외·대기 이유를 함께 기록'], ['feedback', '피드백 완료', '운영자가 확인한 판단']]) {
    statValues[key] = el('div', `stat-value${key === 'wouldLaunch' ? ' lime' : ''}`, '—');
    add(stats, add(el('div', 'stat-card'), el('div', 'stat-label', label), statValues[key], el('div', 'stat-description', detail)));
  }
  const laneStats = el('section', 'panel paper-trial-lanes'); laneStats.id = 'paper-trial-lanes'; laneStats.setAttribute('aria-label', '발행 경로별 모의 운영 집계');
  const laneRows = {};
  add(laneStats, el('h2', '', '발행 경로별 기록'));
  for (const [lane, label] of Object.entries(laneLabels)) {
    laneRows[lane] = el('span'); laneRows[lane].id = `paper-trial-lane-${lane}`;
    add(laneStats, add(el('div', 'paper-trial-lane-total'), el('strong', '', label), laneRows[lane]));
  }
  const diagnostics = el('div', 'paper-trial-diagnostics');
  const reasonsPanel = el('section', 'panel');
  const reasons = el('ul', 'paper-trial-reasons'); reasons.id = 'paper-trial-reasons';
  add(reasonsPanel, el('h2', '', '무엇이 발행을 막았나요?'), el('p', 'muted', '반복되는 보류 이유부터 확인하세요. 한 후보에 여러 이유가 있을 수 있습니다.'), reasons);
  const readinessPanel = el('section', 'panel');
  const readiness = el('h2', '', '검토 준비'); readiness.id = 'paper-trial-readiness';
  const blockers = el('ul', 'paper-trial-blockers'); blockers.id = 'paper-trial-blockers';
  const coverage = el('p', 'muted'); coverage.id = 'paper-trial-coverage';
  const operations = el('p', 'muted'); operations.id = 'paper-trial-operations';
  const limitations = el('ul', 'paper-trial-limitations'); limitations.id = 'paper-trial-limitations';
  const downloadButton = button('전체 검토 보고서 저장 ↓', 'paper-trial-download'); downloadButton.title = '전체 집계와 모든 페이지의 판단·피드백을 JSON으로 저장합니다.';
  downloadButton.addEventListener('click', exportReport);
  add(readinessPanel, readiness, blockers, coverage, operations, limitations, downloadButton, el('p', 'paper-trial-next muted', '관찰 종료 후에도 가스비 차단이 유지됩니다. 피드백을 검토하고 문제를 수정한 뒤, 관리자가 별도로 실제 운영을 설정해야 합니다.'));
  add(diagnostics, reasonsPanel, readinessPanel);

  const selectionPanel = el('section', 'paper-trial-selection'); selectionPanel.id = 'paper-trial-selection';
  const selectionToggle = button('뉴스·밈 비교 모의 켜기', 'paper-selection-toggle', 'button small subtle');
  const selectionStatus = el('p', 'muted'); selectionStatus.id = 'paper-selection-status';
  const selectionCounts = el('p'); selectionCounts.id = 'paper-selection-counts';
  const selectionReasons = el('p', 'muted'); selectionReasons.id = 'paper-selection-reasons';
  const marketStatus = el('p', 'muted'); marketStatus.id = 'paper-selection-market';
  const winners = el('ul', 'paper-trial-limitations'); winners.id = 'paper-selection-winners';
  const selectionDecisions = el('div', 'paper-trial-decisions'); selectionDecisions.id = 'paper-selection-decisions';
  add(selectionPanel, add(el('div', 'panel paper-selection-summary'), add(el('div', 'panel-heading'), el('h2', '', '뉴스·밈 비교 실험 · $1M 관측'), selectionToggle), selectionStatus,
    selectionCounts, selectionReasons, marketStatus, winners, el('p', 'muted', '공개 원문의 초기 반응으로 고르는 미검증 가설입니다. 기존 발행 경로와 별도 집계합니다. 다른 토큰의 시가총액은 우리 토큰의 예상 성과가 아닙니다.')), selectionDecisions);
  selectionToggle.addEventListener('click', async () => {
    if (!snapshot?.canManage || snapshot.session?.status !== 'running' || pending || loading || [...drafts.values()].some(value => value.pending)) return;
    const requested = snapshot.simulation?.selectionChallenger !== true;
    pending = true; const mine = ++epoch; draw();
    try {
      const next = await api('/api/paper-trial/config', { method: 'PATCH', body: { selectionChallenger: requested } });
      if (mine !== epoch) return;
      snapshot = { ...snapshot, ...next, decisions: snapshot.decisions, pagination: snapshot.pagination };
      toast(`뉴스·밈 비교 모의를 ${requested ? '켰습니다' : '껐습니다'}. 이전 판단은 보존됩니다.`); onChange();
    } catch (failure) { if (mine === epoch) error = failure.message || '비교 설정을 적용하지 못했습니다.'; }
    finally { if (mine === epoch) { pending = false; draw(); } }
  });

  const journal = el('section', 'paper-trial-journal'); journal.setAttribute('aria-label', '모의 발행 판단과 피드백');
  const journalHeading = el('div', 'panel-heading');
  const history = el('select'); history.id = 'paper-trial-history'; history.setAttribute('aria-label', '모의 운영 기록 선택');
  history.addEventListener('change', () => { selectedSession = history.value; offset = 0; void fastRefresh(); return refresh({ force: true }); });
  add(journalHeading, add(el('div'), el('h2', '', '판단 기록 · 피드백'), el('p', 'muted', '모의 발행과 보류 판단이 적절했는지 남겨주세요. 의견은 서버에 저장됩니다.')), history);
  const decisions = el('div', 'paper-trial-decisions'); decisions.id = 'paper-trial-decisions';
  const empty = el('div', 'empty-state', '모의 운영을 시작하면 수집된 후보의 판단이 여기에 쌓입니다.'); empty.id = 'paper-trial-empty';
  const paging = el('div', 'paper-trial-paging');
  const previousButton = button('← 이전', 'paper-trial-previous', 'button small subtle');
  const nextButton = button('다음 →', 'paper-trial-next', 'button small subtle');
  const pageCount = el('span', 'muted'); pageCount.id = 'paper-trial-page-count';
  previousButton.addEventListener('click', () => { if (previousButton.disabled) return; offset = Math.max(0, offset - 50); return refresh({ force: true }); });
  nextButton.addEventListener('click', () => { if (nextButton.disabled) return; offset += 50; return refresh({ force: true }); });
  add(paging, previousButton, pageCount, nextButton);
  add(journal, journalHeading, empty, decisions, paging);
  const rapidPanel=el('section','panel paper-trial-rapid');rapidPanel.id='paper-trial-rapid';
  const rapidStatus=el('p','muted');rapidStatus.id='paper-rapid-status';rapidStatus.setAttribute('role','status');
  const rapidCards=el('div','paper-trial-decisions');rapidCards.id='paper-rapid-cards';
  add(rapidPanel,el('h2','','즉시 모의 발행안'),el('p','muted','수신한 원문과 이미지에서 이름을 먼저 뽑습니다. 목표는 수신 후 2초이며, 실제 토큰 발행이나 매수는 하지 않습니다.'),rapidStatus,rapidCards);
  add(root, heading, rapidPanel, status, controlPanel, stats, laneStats, selectionPanel, diagnostics, journal);

  function rapidImage(item) {
    if(!item?.image)return null;
    const expected=`/api/paper-trial/rapid/${item.id}/image`,info=item.image;
    if(!/^[0-9a-f-]{36}$/i.test(item.id??'')||info.previewUrl!==expected||!/^[a-f0-9]{64}$/.test(info.sha256??'')||
      !['image/png','image/jpeg','image/webp'].includes(info.contentType))return {error:'원본 이미지 주소를 확인할 수 없습니다.'};
    const key=`${item.id}:${info.sha256}`;
    if(rapidArtwork.has(key))return rapidArtwork.get(key);
    const entry={key,pending:true,url:null,error:''},mine=rapidEpoch;rapidArtwork.set(key,entry);
    Promise.resolve().then(()=>api(expected,{responseType:'blob'})).then(blob=>{
      if(mine!==rapidEpoch||rapidArtwork.get(key)!==entry)return;
      if(!blob||blob.type!==info.contentType||blob.size>2*1024*1024)throw new Error('원본 이미지 형식을 확인할 수 없습니다.');
      entry.url=objectUrls.createObjectURL(blob);entry.pending=false;entry.error='';drawRapid(true);
    }).catch(failure=>{
      if(mine!==rapidEpoch||rapidArtwork.get(key)!==entry)return;
      entry.pending=false;entry.error=failure.message||'원본 이미지를 불러오지 못했습니다.';drawRapid(true);
    });
    return entry;
  }
  function clearRapid() {
    rapidEpoch++;rapidAbort?.abort();rapidAbort=null;rapidRequest=null;rapidSnapshot=null;rapidError='';rapidRenderSignature='';
    for(const entry of rapidArtwork.values())if(entry.url)objectUrls.revokeObjectURL(entry.url);
    rapidArtwork.clear();rapidCards.replaceChildren();
  }
  function drawRapid(force=false) {
    const items=list(rapidSnapshot?.items).slice(0,30),waiting=items.some(item=>!['ready','failed','insufficient_evidence','needs_visual'].includes(item.status));
    const signature=JSON.stringify([rapidSnapshot,rapidError,waiting?Math.floor(Date.now()/1000):0]);
    if(!force&&signature===rapidRenderSignature)return;rapidRenderSignature=signature;
    rapidStatus.textContent=rapidError?`${rapidError}${items.length?' · 마지막 발행안을 표시합니다.':''}`:items.length?`최근 발행안 ${items.length}건 · 원문 이미지를 우선 표시합니다.`:'새 원문 수신을 기다리고 있습니다.';
    const retained=new Set(items.filter(item=>item.image).map(item=>`${item.id}:${item.image.sha256}`));
    for(const [key,entry]of rapidArtwork)if(!retained.has(key)){if(entry.url)objectUrls.revokeObjectURL(entry.url);rapidArtwork.delete(key);}
    rapidCards.replaceChildren();
    for(const item of items) {
      const proposal=item.result?.proposal,card=el('article','panel paper-trial-decision');card.id=`paper-rapid-${item.id}`;
      add(card,el('h3','',proposal?`${proposal.name} · $${proposal.symbol}`:'이름 확인 중'),proposal?.description?el('p','',proposal.description):null);
      const labels={queued:'원문 이미지 확인 대기',running:'원문 이미지 읽는 중',extracting:'원문 이미지 읽는 중',processing:'원문 이미지 읽는 중',ready:'즉시 모의 발행안 준비',needs_visual:'이미지의 핵심 문구 확인 필요',insufficient_evidence:'이름을 정할 원문 근거 부족',failed:'원문 확인 재시도 필요'};
      const ms=number(item.receiptToReadyMs),received=Date.parse(item.receivedAt??''),elapsed=Number.isFinite(received)?Math.max(0,Date.now()-received):null;
      add(card,el('p','muted',`${labels[item.status]||'원문 확인 중'}${ms!==null?` · 수신 후 ${Math.round(ms).toLocaleString('ko-KR')}ms${ms>2000?' · 2초 목표 초과':''}`:waiting&&elapsed!==null?` · 수신 후 ${(elapsed/1000).toFixed(1)}초${elapsed>2000?' · 2초 목표 초과':''}`:''}`));
      const visualCoverage=item.result?.imageCoverage;
      if(number(visualCoverage?.attached)!==null&&number(visualCoverage?.inspected)!==null&&visualCoverage.inspected>=0&&visualCoverage.inspected<visualCoverage.attached)
        add(card,el('p','muted',`첨부 이미지 ${visualCoverage.attached}개 중 ${visualCoverage.inspected}개 확인`));
      if(item.postTrial)add(card,el('p','muted','관찰 종료 후 재검증 · 당시 2초 처리 성과에 포함하지 않습니다.'));
      const original=rapidImage(item);
      if(original){
        const img=el('img','paper-trial-preparation-image');img.width=320;img.loading='lazy';img.decoding='async';img.alt=proposal?`${proposal.name} 원문 이미지`:'발행안 근거 원문 이미지';img.hidden=!original.url;if(original.url)img.src=original.url;
        img.addEventListener('error',()=>{if(original.url){objectUrls.revokeObjectURL(original.url);original.url=null;original.error='원본 이미지를 표시하지 못했습니다.';drawRapid(true);}});
        add(card,img,el('p','muted',original.error||original.pending?'원본 이미지'+(original.error?` · ${original.error}`:' 불러오는 중'):'원문 이미지'));
        if(original.error&&original.key){const retry=button('원본 이미지 다시 불러오기',`paper-rapid-image-retry-${item.id}`);retry.addEventListener('click',()=>{rapidArtwork.delete(original.key);drawRapid(true);});card.append(retry);}
      } else if(list(item.result?.reasonCodes).includes('OCR_REQUIRED'))add(card,el('p','muted','원문 이미지를 확보한 뒤 표시합니다.'));
      if(item.error)add(card,el('p','muted',String(item.error)));
      if(item.retryAt)add(card,el('p','muted',`다음 재시도 ${date(item.retryAt)}`));
      const actor=item.source?.repost?.actor?.handle||item.source?.repost?.actor,author=item.source?.author;
      add(card,el('p','muted',[author?`원작성자 ${author}`:'',typeof actor==='string'?`재게시 ${actor}`:''].filter(Boolean).join(' · ')));
      try{const url=new URL(item.source?.url);if(url.protocol==='https:'&&!url.username&&!url.password){const anchor=el('a','','원문 보기 ↗');anchor.href=url.href;anchor.target='_blank';anchor.rel='noopener noreferrer';card.append(anchor);}}catch{}
      rapidCards.append(card);
    }
  }
  function fastRefresh({sessionId=selectedSession||''}={}) {
    if(sessionId!==rapidSession){clearRapid();rapidSession=sessionId;}
    if(rapidRequest)return rapidRequest;
    const mine=rapidEpoch,controller=new AbortController();rapidAbort=controller;
    const request=Promise.resolve().then(()=>api(`/api/paper-trial/rapid${sessionId?`?sessionId=${encodeURIComponent(sessionId)}`:''}`,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(5000)])})).then(next=>{
      if(mine!==rapidEpoch)return;rapidSnapshot=next;rapidError='';drawRapid();
    }).catch(failure=>{if(mine!==rapidEpoch)return;rapidError=failure.message||'즉시 발행안을 불러오지 못했습니다.';drawRapid();})
      .finally(()=>{if(mine===rapidEpoch&&rapidRequest===request){rapidRequest=null;rapidAbort=null;}});
    rapidRequest=request;return request;
  }

  function decisionRow(item) {
    const article = el('article', 'panel paper-trial-decision'); article.setAttribute('aria-label', '후보 판단과 피드백');
    const outcome = el('span', 'pill');
    const lane = el('span', 'pill paper-trial-lane-badge');
    const title = el('h3');
    const when = el('span', 'muted paper-trial-decision-time');
    const presentation = el('p', 'paper-trial-presentation');
    const preparationStatus=el('p','muted paper-trial-preparation-status');preparationStatus.setAttribute('role','status');
    const preparationHistory=el('p','muted paper-trial-preparation-history');
    const preview=el('img','paper-trial-preparation-image');preview.width=256;preview.height=256;preview.loading='lazy';preview.decoding='async';preview.hidden=true;
    const imageStatus=el('p','muted paper-trial-image-status');imageStatus.setAttribute('role','status');
    const imageRetry=button('이미지 다시 불러오기',`paper-image-retry-${item.id}`);
    preview.addEventListener('error',()=>{const prep=item.preparation,key=prep?.image?`${prep.id}:${prep.image.sha256}`:null,entry=key?artwork.get(key):null;
      if(entry?.url){objectUrls.revokeObjectURL(entry.url);entry.url=null;entry.error='모의 이미지를 표시하지 못했습니다.';draw();}});
    imageRetry.addEventListener('click',()=>{const prep=item.preparation,key=prep?.image?`${prep.id}:${prep.image.sha256}`:null;
      if(key){const previous=artwork.get(key);if(previous?.url)objectUrls.revokeObjectURL(previous.url);artwork.delete(key);draw();}});
    const sourceExcerpt = el('p', 'paper-trial-source-excerpt');
    const rationale = el('p', 'paper-trial-rationale');
    const observation = el('p', 'muted paper-trial-observation');
    const marketObservation = el('p', 'muted paper-trial-observation');
    const sourceLink = el('a', 'paper-trial-source-link', '판단에 사용한 원문 ↗'); sourceLink.target = '_blank'; sourceLink.rel = 'noopener noreferrer';
    const form = el('form', 'paper-trial-feedback');
    const choice = el('select'); choice.id = `paper-verdict-${item.id}`;
    const choiceLabel = el('label', '', '이 판단은 어땠나요?'); choiceLabel.htmlFor = choice.id;
    const placeholder = el('option', '', '평가 선택'); placeholder.value = ''; choice.append(placeholder);
    for (const [value, label] of Object.entries(verdicts)) { const option = el('option', '', label); option.value = value; choice.append(option); }
    choice.value = '';
    const note = el('textarea'); note.id = `paper-note-${item.id}`; note.rows = 2; note.maxLength = 2000; note.placeholder = '예: 너무 늦게 잡았어요 / 중복 토큰 같아요 / 이 후보는 발행했어야 해요';
    const noteLabel = el('label', '', '이유와 개선 메모'); noteLabel.htmlFor = note.id;
    const save = button('피드백 저장', `paper-save-${item.id}`, 'button small subtle'); save.type = 'submit';
    const feedbackStatus = el('span', 'muted paper-trial-feedback-status'); feedbackStatus.setAttribute('role', 'status');
    const state = drafts.get(item.id) ?? { verdict: item.feedback?.verdict || '', note: item.feedback?.note || '', dirty: false, pending: false, error: '' };
    drafts.set(item.id, state);
    choice.value = state.verdict; note.value = state.note;
    const edit = () => { state.verdict = choice.value; state.note = note.value; state.dirty = true; state.error = ''; update(); };
    choice.addEventListener('change', edit); note.addEventListener('input', edit);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!snapshot?.canFeedback || !verdicts[state.verdict] || state.pending) return;
      state.pending = true; state.error = ''; draw();
      const saved = { verdict: state.verdict, note: state.note }, sessionEpoch = epoch;
      try {
        const next = await api(`/api/paper-trial/decisions/${encodeURIComponent(item.id)}/feedback`, { method: 'PATCH', body: saved });
        if (sessionEpoch !== epoch) return;
        state.dirty = false;
        if (next?.session?.id === snapshot?.session?.id) {
          if ((next.pagination?.offset ?? 0) === offset) snapshot = next;
          else {
            const storedFeedback = list(next.decisions).find(value => value.id === item.id)?.feedback ?? { ...saved, updatedAt: new Date().toISOString() };
            snapshot = { ...next, pagination: { ...snapshot.pagination, total: next.pagination?.total ?? snapshot.pagination?.total }, decisions: snapshot.decisions.map(value => value.id === item.id ? { ...value, feedback: storedFeedback } : value) };
          }
        }
        else item.feedback = { ...saved, updatedAt: new Date().toISOString() };
        toast('피드백을 저장했습니다.');
      } catch (failure) { if (sessionEpoch === epoch) state.error = failure.message || '피드백을 저장하지 못했습니다.'; }
      finally { state.pending = false; if (sessionEpoch === epoch) draw(); }
    });
    add(form, add(el('div', 'paper-trial-field'), choiceLabel, choice), add(el('div', 'paper-trial-field paper-trial-note-field'), noteLabel, note), add(el('div', 'paper-trial-save'), save, feedbackStatus));
    add(article, add(el('div', 'paper-trial-decision-heading'), add(el('div'), outcome, lane, title), when), presentation,preparationStatus,preparationHistory,preview,imageStatus,imageRetry, sourceExcerpt, rationale, observation, marketObservation, sourceLink, form);
    function update(next = item) {
      item = next;
      const issued = item.decision === 'would_launch', initial = item.snapshot ?? {}, later = item.latestObservation;
      const logicalLane = initial.route === 'core_author' ? 'core_author' : item.lane;
      const sourceBody = logicalLane === 'core_author' ? String(initial.source?.text || initial.source?.title || '') : '';
      const excerptCharacters = [...sourceBody];
      sourceExcerpt.textContent = sourceBody ? `원문: ${excerptCharacters.slice(0, 600).join('')}${excerptCharacters.length > 600 ? '…' : ''}` : '';
      sourceExcerpt.hidden = !sourceBody;
      outcome.textContent = issued ? '모의 발행' : '보류'; outcome.className = `pill ${issued ? 'success' : 'warning'}`;
      lane.textContent = `${logicalLane === 'challenger' ? '뉴스·밈 비교 가설' : laneLabels[logicalLane] || logicalLane || '경로 미기록'}${number(initial.simulation?.revision) !== null ? ` · 설정 ${initial.simulation.revision}차` : ''}`;
      const preparation=item.preparation,token=preparation?.proposal??initial.presentation??{};
      title.textContent = preparation?.proposal?.name || item.title || item.candidateId || '이름 미확인'; when.textContent = date(item.createdAt);
      presentation.textContent = [token.name, token.symbol ? `$${token.symbol}` : null, token.description].filter(Boolean).join(' · '); presentation.hidden = !presentation.textContent;
      if (!preparation && logicalLane === 'core_author' && (initial.metadataStatus === 'pending' || token.metadataStatus === 'pending')) {
        presentation.textContent = `${presentation.textContent ? `${presentation.textContent} · ` : ''}이름·이미지 준비 전`; presentation.hidden = false;
      }
      preparationStatus.textContent=preparation?[preparationLabels[preparation.status]||'발행 자료 상태 확인 필요',
        preparation.proposal&&['failed','retry_wait','context_missing'].includes(preparation.status)?'생성된 이름·설명은 유지됩니다.':null,
        preparation.retryAt?`다음 재시도 ${date(preparation.retryAt)}`:null,preparation.error?`오류: ${String(preparation.error).slice(0,300)}`:null].filter(Boolean).join(' · '):'';
      preparationStatus.hidden=!preparation;
      preparationHistory.textContent=preparation?.postTrialEnrichment||preparation?.completedAfterTrial?'관찰 종료 후 만든 발행 자료 · 당시 판단과 성과에는 포함하지 않습니다.':'';
      preparationHistory.hidden=!preparationHistory.textContent;
      const image=preparationImage(preparation);
      preview.hidden=!image?.url;preview.alt=`${token.name||'모의 토큰'} 이미지`;
      if(image?.url)preview.src=image.url;else preview.removeAttribute?.('src');
      imageStatus.textContent=image?.error|| (image?.pending?'모의 이미지 불러오는 중…':preparation?.image?.kind==='source_capture'?'원문 이미지':'');imageStatus.hidden=!imageStatus.textContent;
      imageRetry.hidden=!image?.error||!image.key;
      rationale.textContent = list(item.reasons).length ? list(item.reasons).map(reasonText).join(' · ') : issued ? '선별 조건 통과 · 실제 발행은 하지 않았습니다.' : '보류 이유 미기록';
      if (logicalLane === 'core_author' && issued) rationale.textContent = '설정한 계정의 원문을 확인해 모의 발행 의사를 기록했습니다.';
      const cautions = [...new Set(list(initial.hotQuality?.cautions).filter(value => typeof value === 'string' && value.trim()))];
      if (cautions.length) rationale.textContent += ` · 검토 근거: ${cautions.join(' · ')}`;
      observation.textContent = `판단 당시 점수 ${count(initial.score)} · 작성자 ${count(initial.uniqueAuthors)}명 · 독립 출처 ${count(initial.independentSources)}개`;
      if (later) observation.textContent += ` → 최근 점수 ${count(later.score)} (${change(later.scoreDelta)}) · 작성자 ${count(later.uniqueAuthors)}명 (${change(later.authorDelta)}) · ${date(later.observedAt)}${later.stale ? ' · 오래된 관측' : ''}`;
      if (logicalLane === 'core_author') observation.textContent = `${initial.source?.author || '작성자 미확인'} · 게시 ${date(initial.source?.publishedAt)} · 관측 ${date(initial.source?.observedAt)} · 수신 ${date(initial.source?.receivedAt)} · 판단 ${date(initial.decisionAt || item.createdAt)}${initial.replay ? ' · 활성 시점의 최근 원문 재생' : ''}`;
      if (item.lane === 'challenger') {
        observation.textContent = `원문 ${date(initial.source?.publishedAt)} · 수신 ${date(initial.source?.receivedAt)} · 당시 조회 ${count(initial.attention?.views)} / 좋아요 ${count(initial.attention?.likes)} · 초기 반응만 확인`;
        observation.textContent += list(item.followups).map(f => ` · ${f.minutes}분 후: ${f.status === 'observed' ? `조회 ${count(f.metrics?.views)} / 좋아요 ${count(f.metrics?.likes)}${f.delayMinutes > 0 ? ` (${f.delayMinutes}분 늦은 관측)` : ''}` : f.status === 'waiting' ? '대기' : f.status === 'ended_before_checkpoint' ? '회차 종료로 관찰하지 못함' : '새 관측 없음'}`).join('');
        const matches = list(item.outcome?.matches);
        observation.textContent += matches.length ? ` · 관련 시장 관측 ${matches.length}건 (${item.outcome.matchType === 'exact_token' ? '동일 체인·계약' : '소재 유사·동일 토큰 미확인'})` : ' · 관련 토큰 연결 미확인';
      }
      marketObservation.textContent = list(item.outcome?.matches).slice(0,3).map(match => `${match.tokenName || match.tokenSymbol || '이름 미확인'} (${match.chain || '체인 미확인'} · ${match.sameAssetVerified ? '동일 계약 확인' : '소재 유사·동일 자산 아님'}) · ${targetLabels[match.targetStatus] || '결과 미확인'} · 관측 최고 시총 $${count(match.peakMarketCapUsd)} / FDV $${count(match.peakFdvUsd)}${match.firstTargetObservedAt ? ` · 첫 $1M 관측 ${date(match.firstTargetObservedAt)}` : ''}`).join('\n');
      marketObservation.hidden = !marketObservation.textContent;
      let url = null; try { const candidate = new URL(initial.source?.url); if (['https:','http:'].includes(candidate.protocol)) url = candidate.href; } catch {}
      sourceLink.hidden = !url; sourceLink.href = url || '';
      if (!state.dirty && !state.pending) { state.verdict = item.feedback?.verdict || state.verdict; state.note = item.feedback?.note ?? state.note; choice.value = state.verdict; note.value = state.note; }
      choice.disabled = note.disabled = snapshot?.canFeedback !== true || state.pending;
      save.disabled = snapshot?.canFeedback !== true || !verdicts[state.verdict] || !state.dirty || state.pending;
      feedbackStatus.textContent = state.error || (state.pending ? '저장 중…' : snapshot?.canFeedback !== true ? '운영자 권한이 필요합니다.' : state.dirty ? '저장하지 않은 피드백' : item.feedback ? `저장됨 · ${date(item.feedback.updatedAt)}` : '');
      feedbackStatus.className = `${state.error ? 'error-text' : 'muted'} paper-trial-feedback-status`;
    }
    return { node: article, update };
  }

  function draw() {
    const session = snapshot?.session, report = snapshot?.report, active = session?.status === 'running';
    const savingFeedback = [...drafts.values()].some(value => value.pending);
    const anyActive = active || list(snapshot?.sessions).some(item => item.status === 'running');
    status.textContent = error ? `${error}${snapshot ? ' 마지막 데이터를 표시합니다.' : ''}` : loading ? '모의 운영 기록을 불러오는 중입니다.' : session ? `마지막 관찰 ${date(session.lastTickAt)} · ${date(session.startedAt)} 시작` : '아직 시작한 모의 운영이 없습니다.';
    refreshButton.disabled = loading || pending || savingFeedback;
    pill.textContent = statuses[session?.status] || '시작 전'; pill.className = `pill ${active ? 'success' : 'demo'}`;
    startButton.disabled = !snapshot || snapshot.canManage !== true || anyActive || pending || loading || savingFeedback;
    startButton.textContent = session && !active ? '새 모의 운영 시작' : '모의 운영 시작';
    duration.disabled = startButton.disabled;
    startHotAuto.disabled = startButton.disabled;
    startHotLabel.hidden = active;
    stopButton.disabled = !active || snapshot?.canManage !== true || pending || loading || savingFeedback; stopButton.hidden = !active;
    const simulation = snapshot?.simulation ?? report?.simulation;
    if (configSession !== session?.id) { configSession = session?.id; configDirty = false; }
    if (!configDirty) { hotAuto.checked = simulation?.hotAuto === true; coreAuto.checked = simulation?.coreAuto === true; }
    hotAuto.disabled = !active || snapshot?.canManage !== true || pending || loading || savingFeedback;
    const coreAuthors = coreAuthorsOf(simulation);
    coreAuto.disabled = hotAuto.disabled || (!coreAuthors.length && simulation?.coreAuto !== true);
    configControls.hidden = !active;
    const configChanged = hotAuto.checked !== (simulation?.hotAuto === true) || coreAuto.checked !== (simulation?.coreAuto === true);
    applyConfigButton.disabled = hotAuto.disabled || !configDirty || !configChanged || (coreAuto.checked && !coreAuthors.length);
    simulationStatus.textContent = session
      ? `핫레인 자동 모의 실행 ${simulation?.hotAuto === true ? '켜짐' : simulation?.hotAuto === false ? '꺼짐' : '설정 미확인'}${number(simulation?.revision) !== null ? ` · 설정 ${simulation.revision}차` : ''}${simulation?.effectiveFrom ? ` · 적용 ${date(simulation.effectiveFrom)}` : ''}${configDirty && configChanged ? ' · 적용하지 않은 변경' : ''}`
      : '핫레인 자동 발행 판단도 함께 기록하도록 기본 설정되어 있습니다.';
    coreStatus.textContent = `유명인 원문 즉시 모의 발행 ${simulation?.coreAuto === true ? '켜짐' : '꺼짐'} · ${coreAuthors.length ? `대상 ${coreAuthors.map(author => `@${author.handle.replace(/^@/, '')}`).join(', ')}` : '계정 설정 필요'}${simulation?.coreEffectiveFrom ? ` · 적용 ${date(simulation.coreEffectiveFrom)}` : ''} · 모의 발행 ${count(report?.laneCounts?.core_author?.wouldLaunch)}건`;
    const lock = snapshot?.safety?.liveLocked;
    safety.textContent = lock === true ? '가스비 차단 중 · 모의 운영이 끝나도 실제 발행·매수로 자동 전환되지 않습니다.' : '시작하면 실제 발행·매수를 차단하고 모의 판단만 기록합니다.';
    if (snapshot?.canManage === false) safety.textContent += ' 시작과 종료는 관리자만 할 수 있습니다.';
    if (session && snapshot?.safety) safety.textContent += ` · 전송 ${count(snapshot.safety.transactionsSent)}건 · 가스비 ${snapshot.safety.gasSpentWei === '0' ? '0 ETH' : '확인 필요'}`;
    clock.textContent = session ? `${formatTrialHours(report?.elapsedHours)} 관찰 / 목표 ${session.durationHours}시간${active ? ` · ${formatTrialHours(report?.remainingHours)} 남음` : ''}` : '24시간 또는 48시간 동안 관찰합니다.';
    progress.value = session?.durationHours && number(report?.elapsedHours) !== null ? Math.min(100, report.elapsedHours / session.durationHours * 100) : 0;
    schedule.textContent = session ? `시작 ${date(session.startedAt)} · 예정 종료 ${date(session.endsAt)}${session.stoppedAt ? ` · 실제 종료 ${date(session.stoppedAt)}` : ''}` : '서버가 실행 중일 때 관찰이 계속됩니다. 관측 공백도 보고서에 남습니다.';
    for (const [key, value] of Object.entries(statValues)) value.textContent = count(report?.counts?.[key]);
    for (const [lane, value] of Object.entries(laneRows)) {
      const totals = report?.laneCounts?.[lane];
      value.textContent = `판단 ${count(totals?.evaluated)}건 · 모의 발행 ${count(totals?.wouldLaunch)}건 · 보류 ${count(totals?.held)}건`;
    }
    const selection = report?.selection, market = selection?.market;
    const selectionEnabled = snapshot?.simulation?.selectionChallenger === true;
    selectionToggle.textContent = `뉴스·밈 비교 모의 ${selectionEnabled ? '끄기' : '켜기'}`;
    selectionToggle.disabled = !active || snapshot?.canManage !== true || pending || loading || savingFeedback;
    selectionStatus.textContent = `${selectionEnabled ? '비교 관찰 중' : '비교 경로 꺼짐'} · 최근 ${date(selection?.lastTickAt)} · 원문 2시간 이내 / 반응 관측 20분 이내 · 좋아요 100 이상 또는 조회 1만 + 반응 10 이상`;
    selectionCounts.textContent = `비교 모의 발행 ${count(selection?.counts?.wouldLaunch)}건 · 보류 ${count(selection?.counts?.held)}건 · 소재 ${count(selection?.counts?.candidates)}개 · 피드백 ${count(selection?.counts?.feedback)}건`;
    if (selection?.review) selectionCounts.textContent += ` · 좋은 선택 ${count(selection.review.good)} / 잘못된 선택 ${count(selection.review.bad)} / 놓침 ${count(selection.review.missed)} / 판단 보류 ${count(selection.review.unsure)}${selection.review.status === 'needs_review' ? ' · 개선 검토 필요' : ''}`;
    selectionReasons.textContent = list(selection?.reasonCounts).slice(0,4).map(item => `${reasonText(item.reason)} ${count(item.count)}건`).join(' · ');
    if (selection?.coverage) selectionReasons.textContent += ` · 이번 검사 ${count(selection.coverage.evaluatedThisTick)} / ${count(selection.coverage.poolSize)}개${selection.coverage.truncated ? ' · 입력 범위 제한' : ''}`;
    marketStatus.textContent = market ? `시장 관측 ${date(market.asOf)} · 시총 $1M 관측 토큰 ${count(market.counts?.observedMarketCapTargetTokens)}개 · FDV만 $1M ${count(market.counts?.fdvOnlyTargetTokens)}개 · 원문 연결 미확인 ${count(market.counts?.unmatchedObservedWinners)}개 · 전체 시장을 조사한 결과는 아닙니다.${market.coverage?.truncated ? ' 관측 조회 상한에 도달해 일부 기록이 빠져 있습니다.' : ''}` : '시장 관측 대기 · 시가총액과 FDV는 구분합니다. 관측 없음은 실패가 아닙니다.';
    if (market) marketStatus.textContent += ` 전체 경로의 동일 계약 확인: 선행 선택 ${count(market.counts?.selectedBeforeObservedTarget)} / 보류 후 도달 ${count(market.counts?.heldBeforeObservedTarget)}. 소재 유사 기준: 선행 선택 ${count(market.counts?.selectedMaterialProxyTarget)} / 보류 후 도달 ${count(market.counts?.heldMaterialProxyTarget)}. 소재 유사는 예측 성공으로 세지 않습니다.`;
    const comparison = market?.byLane?.challenger;
    if (comparison) marketStatus.textContent += ` 뉴스·밈 비교 경로만: 동일 계약 선행 선택 ${count(comparison.selectedBeforeObservedTarget)} / 보류 후 도달 ${count(comparison.heldBeforeObservedTarget)}, 소재 유사 선행 선택 ${count(comparison.selectedMaterialProxyTarget)} / 보류 후 도달 ${count(comparison.heldMaterialProxyTarget)}.`;
    winners.replaceChildren(...list(market?.unmatchedObservedWinners).slice(0,8).map(item => el('li', '', `${item.tokenName || item.tokenSymbol || '이름 미확인'} · ${item.chain || '체인 미확인'} · 관측 최고 $${count(item.peakMarketCapUsd)} · 최초 $1M 관측 ${date(item.firstTargetObservedAt)} · 소재 연결 미확인`)));
    const selectionItems = list(selection?.decisions), selectionPresent = new Set(selectionItems.map(item => item.id));
    if (selectionSession !== session?.id) { selectionRows.clear(); selectionDecisions.replaceChildren(); selectionSession = session?.id; }
    for (const [id, row] of selectionRows) if (!selectionPresent.has(id) && !drafts.get(id)?.dirty && !drafts.get(id)?.pending) { row.node.remove(); selectionRows.delete(id); }
    for (const item of selectionItems) {
      if (!selectionRows.has(item.id)) { const row = decisionRow(item); selectionRows.set(item.id, row); selectionDecisions.append(row.node); }
      selectionRows.get(item.id).update(item);
    }
    reasons.replaceChildren(...(list(report?.reasonCounts).length ? report.reasonCounts.map(item => add(el('li'), el('span', '', reasonText(item.reason)), el('strong', '', `${count(item.count)}건`))) : [el('li', 'muted', session ? '아직 보류 이유가 기록되지 않았습니다.' : '시험을 시작하면 반복 문제를 집계합니다.')]));
    readiness.textContent = { collecting: '관찰 중 · 표본을 모으고 있어요', needs_review: '문제 확인이 필요해요', ready_for_review: '기간 완료 · 피드백을 검토하세요' }[report?.readiness?.status] || '검토 준비';
    blockers.replaceChildren(...list(report?.readiness?.blockers).map(value => el('li', '', value)));
    coverage.textContent = report ? `관찰 ${count(report.coverage?.ticks)}회 · 가장 긴 관측 공백 ${count(report.coverage?.maxGapMinutes)}분` : '관찰 횟수와 누락 구간을 함께 확인합니다.';
    const hotCoverage = report?.coverage?.hot;
    if (hotCoverage) coverage.textContent += ` · 이번 핫 신호 검토 ${count(hotCoverage.evaluatedThisTick)} / ${count(hotCoverage.poolSize)}개${hotCoverage.rotating ? ' · 순환 검토 중' : ''}${hotCoverage.poolTruncated ? ' · 조회 범위 제한 있음' : ''}`;
    const measured = snapshot?.operations, latency = measured?.receiptToDecision;
    operations.hidden = !measured;
    operations.textContent = measured ? `유명인 원문 수신→기록 p95 ${number(latency?.p95Ms) === null ? '측정 전' : `${(latency.p95Ms / 1000).toFixed(2)}초`} / 목표 2초 · ${count(latency?.samples)}건${latency?.evaluation === 'insufficient_samples' ? ' · 표본 수집 중' : latency?.evaluation === 'over_target' ? ' · 지연 확인 필요' : ''} · 제작 연결 누락 ${count(measured.missingPreparationCount)}건 · 중복 발행 ${count(measured.duplicateIssuanceCount)}건 · 제작 대기·진행 ${count(measured.unfinishedJobs)}건` : '';
    limitations.replaceChildren(...list(report?.limitations).map(value => el('li', '', value)));
    downloadButton.disabled = !session || exporting;
    downloadButton.textContent = exporting ? '전체 판단 기록을 모으는 중…' : '전체 검토 보고서 저장 ↓';
    const sessions = list(snapshot?.sessions), signature = sessions.map(item => `${item.id}:${item.status}`).join('|');
    if (history.signature !== signature) {
      history.signature = signature;
      const current = el('option', '', '현재 / 최근 모의 운영'); current.value = '';
      history.replaceChildren(current, ...sessions.map(item => { const option = el('option', '', `${date(item.startedAt)} · ${item.durationHours}시간 · ${statuses[item.status] || item.status}`); option.value = item.id; return option; }));
    }
    history.value = selectedSession; history.disabled = loading || pending || savingFeedback || !sessions.length;
    const pageKey = `${session?.id || ''}:${snapshot?.pagination?.offset ?? offset}`;
    if (renderedSession !== pageKey) { rows.clear(); decisions.replaceChildren(); renderedSession = pageKey; }
    const items = list(snapshot?.decisions);
    const present = new Set(items.map(item => item.id));
    for (const [id, row] of rows) if (!present.has(id) && !drafts.get(id)?.dirty && !drafts.get(id)?.pending) { row.node.remove(); rows.delete(id); }
    // Keep existing form nodes attached during polling so typing, focus and unsaved notes survive.
    let before = null;
    for (const item of [...items].reverse()) {
      let row = rows.get(item.id);
      if (!row) { row = decisionRow(item); rows.set(item.id, row); decisions.insertBefore(row.node, before); }
      row.update(item);
      before = row.node;
    }
    empty.hidden = items.length > 0;
    empty.textContent = session ? '아직 판단 기록이 없습니다. 수집 소스와 관측 공백을 확인하세요.' : '모의 운영을 시작하면 수집된 후보의 판단이 여기에 쌓입니다.';
    const page = snapshot?.pagination, total = page?.total ?? report?.counts?.evaluated ?? 0;
    pageCount.textContent = total ? `${count((page?.offset ?? offset) + (items.length ? 1 : 0))}–${count((page?.offset ?? offset) + items.length)} / ${count(total)}건 · 모의 발행 먼저` : '판단 기록 없음';
    previousButton.disabled = !snapshot || loading || pending || savingFeedback || offset === 0;
    nextButton.disabled = !snapshot || loading || pending || savingFeedback || !(page?.hasMore ?? offset + items.length < total);
  }
  async function refresh({ force = false } = {}) {
    if ((loading && !force) || pending || [...drafts.values()].some(value => value.pending)) return;
    loading = true; const mine = ++epoch; draw();
    const query = [selectedSession ? `sessionId=${encodeURIComponent(selectedSession)}` : '', offset ? `offset=${offset}` : ''].filter(Boolean).join('&');
    try { const next = await api(`/api/paper-trial${query ? `?${query}` : ''}`); if (mine !== epoch) return; snapshot = next; error = ''; }
    catch (failure) { if (mine === epoch) error = failure.message || '모의 운영 기록을 불러오지 못했습니다.'; }
    finally { if (mine === epoch) { loading = false; draw(); } }
  }
  async function control(action) {
    if (!snapshot?.canManage || pending || loading || (action === 'start' && snapshot.session?.status === 'running')) return;
    const durationHours = Number(duration.value);
    if (action === 'start' && ![24, 48].includes(durationHours)) return;
    pending = true; const mine = ++epoch; draw();
    try {
      const next = await api(`/api/paper-trial/${action}`, { method: 'POST', body: action === 'start' ? { durationHours, hotAuto: startHotAuto.checked, coreAuto: false } : {} });
      if (mine !== epoch) return;
      snapshot = next; selectedSession = ''; offset = 0; error = '';
      toast(action === 'start' ? `${durationHours}시간 모의 운영을 시작했습니다. 가스비는 발생하지 않습니다.` : '관찰을 종료했습니다. 피드백을 검토하세요. 가스비 차단은 유지됩니다.');
      onChange();
    } catch (failure) { if (mine === epoch) { error = failure.message || '모의 운영 상태를 변경하지 못했습니다.'; toast(error, true); } }
    finally { if (mine === epoch) { pending = false; draw(); } }
  }
  async function configure() {
    if (snapshot?.session?.status !== 'running' || !snapshot?.canManage || pending || loading || !configDirty || [...drafts.values()].some(value => value.pending)) return;
    const requested = { hotAuto: hotAuto.checked, coreAuto: coreAuto.checked };
    if (requested.coreAuto && !coreAuthorsOf(snapshot?.simulation ?? snapshot?.report?.simulation).length) return;
    pending = true; const mine = ++epoch; draw();
    try {
      const next = await api('/api/paper-trial/config', { method: 'PATCH', body: requested });
      if (mine !== epoch) return;
      // Configuration changes must not move the current journal page or discard feedback drafts.
      snapshot = offset === (next.pagination?.offset ?? 0) ? next : { ...next, decisions: snapshot.decisions, pagination: { ...snapshot.pagination, total: next.pagination?.total ?? snapshot.pagination?.total } };
      configDirty = false; error = '';
      toast('모의 설정을 적용했습니다. 실제 발행 설정은 유지됩니다.');
      onChange();
    } catch (failure) { if (mine === epoch) { error = failure.message || '모의 설정을 변경하지 못했습니다.'; toast(error, true); } }
    finally { if (mine === epoch) { pending = false; draw(); } }
  }
  async function exportReport() {
    if (!snapshot?.session || exporting) return;
    exporting = true; const mine = resetEpoch, id = snapshot.session.id, startedAt = new Date().toISOString(); draw();
    try {
      const all = new Map(); let page = null, exportOffset = 0;
      do {
        page = await api(`/api/paper-trial?sessionId=${encodeURIComponent(id)}&limit=200&offset=${exportOffset}`);
        if (mine !== resetEpoch) return;
        for (const item of list(page.decisions)) all.set(item.id, item);
        exportOffset += page.pagination?.limit || 200;
      } while (page.pagination?.hasMore === true);
      const total = page.pagination?.total ?? page.report?.counts?.evaluated ?? all.size;
      const selectionEvidence = page.report?.selection ? await api(`/api/paper-trial/selection-export?sessionId=${encodeURIComponent(page.session.id)}`) : null;
      if (mine !== resetEpoch) return;
      const complete = all.size >= total && (!page.report?.selection || selectionEvidence?.complete === true);
      download({ ...page, selectionEvidence, decisions: [...all.values()], pagination: { offset: 0, limit: all.size, total, hasMore: !complete }, exported: { startedAt, completedAt: new Date().toISOString(), complete, note: complete ? '모든 페이지의 판단·피드백과 비교 경로의 전체 판단·시장 근거' : '관찰 중 새 판단이 추가되었습니다. 관찰 종료 후 다시 저장하면 전체 기록을 함께 확인할 수 있습니다.' } });
      toast(complete ? `판단 ${all.size}건과 피드백을 보고서에 저장했습니다.` : '보고서를 저장했습니다. 저장 중 새 판단이 추가되어 관찰 종료 후 다시 저장해 주세요.');
    } catch (failure) { if (mine === resetEpoch) toast(failure.message || '보고서를 저장하지 못했습니다.', true); }
    finally { if (mine === resetEpoch) { exporting = false; draw(); } }
  }
  function reset() {
    clearRapid();rapidSession='';drawRapid();
    epoch++; resetEpoch++; snapshot = null; loading = false; pending = false; exporting = false; error = ''; selectedSession = ''; renderedSession = null; offset = 0;
    configDirty = false; configSession = null; selectionSession = null; startHotAuto.checked = true;
    for(const entry of artwork.values())if(entry.url)objectUrls.revokeObjectURL(entry.url);artwork.clear();
    rows.clear(); selectionRows.clear(); drafts.clear(); decisions.replaceChildren(); selectionDecisions.replaceChildren(); draw();
  }
  draw();
  drawRapid();
  return { render: refresh, refresh, fastRefresh, reset };
}
