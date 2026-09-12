// 다음 뱅어 제안 · AI 구상. GET /api/radar/next-bangers 를 읽어 제안 카드로 표시합니다.
// 구상은 발행 결정이 아니며 모든 발행은 기존 후보 창의 수동 흐름을 거칩니다. 출처가 주지 않은 값(null)은 표시하지 않습니다.
import {NOT_FOUND_LABEL, REGISTRY_UNAVAILABLE_NOTICE, laneLabels, originLabels, riskLabels} from './banger-radar.mjs?v=328baf15f6741e413138';
const list = value => Array.isArray(value) ? value : [];
const number = value => typeof value === 'number' && Number.isFinite(value);
const text = value => typeof value === 'string' ? value.trim() : '';
const count = value => value.toLocaleString('ko-KR', {maximumFractionDigits: 1});
const clock = value => { const time = Date.parse(value); return Number.isFinite(time) ? new Date(time).toLocaleString('ko-KR', {month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false}) : null; };
const ago = value => { const time = Date.parse(value); if (!Number.isFinite(time)) return null; const diff = Math.max(0, Date.now() - time); if (diff < 60_000) return '방금'; if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`; if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`; return `${Math.floor(diff / 86_400_000)}일 전`; };
const safeUrl = value => { try { const url = new URL(String(value)); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; } };
export const NEXT_BANGERS_HOURS = Object.freeze(['6', '24', '168']);
export const NEXT_BANGERS_DISCLAIMER = 'AI 구상은 관측된 원문과 저장된 승자 패턴에서 만든 창작 제안이며 수익·거래량 예측이 아닙니다. 이름·티커·설명은 영문 메타데이터이고, 페어 종목 제안은 발행 파라미터 참고일 뿐 토큰 설명에 포함되지 않습니다. 발행 적격성은 기존 정책 규칙을 따르며 모든 발행은 수동입니다.';
export const NEXT_BANGERS_EMPTY = '아직 생성된 제안이 없습니다. 제안 생성을 누르면 최근 원문과 승자 패턴으로 구상을 만듭니다.';
export const NEXT_BANGERS_EMPTY_READER = '아직 생성된 제안이 없습니다. 제안 생성은 operator 키가 필요합니다.';
export const NEXT_BANGERS_STATUS = Object.freeze({queued: '생성 대기 중 · 작업자가 곧 처리합니다', running: '모델 실행 중… 최대 4분', providerOff: '제안 생성기 미연결 · ORIGIN_ENRICHMENT_PROVIDER=codex 설정과 서버 재시작이 필요합니다', sameEvidence: '새 원문 없음 · 마지막 근거와 동일', insufficient: '제안할 만한 원문이 부족합니다'});
export const FEEDBACK_REASONS = Object.freeze({exists: '이미 있음', weak: '근거 약함', risky: '위험·권리', other: '기타'});
export const TIMING_LABELS = Object.freeze({now: '지금', within_24h: '24시간 이내', watch: '관망'});
export const KIND_LABELS = Object.freeze({phrase: '문구', character: '캐릭터', image: '이미지', event: '사건', joke: '농담'});
export const CONFIDENCE_LABELS = Object.freeze({high: '높음', medium: '보통', low: '낮음'});
export const ANALYSIS_LABELS = Object.freeze({missing: '원문 분석 대기 · 아직 대기열에 없음', queued: '원문 분석 대기 · 대기열 queued', running: '원문 분석 진행 중', done_no_material: '원문에서 AI 소재를 찾지 못했습니다', failed: '원문 분석 실패 · 다시 요청 가능', expired: '원문이 24시간을 넘어 원문 분석 대상이 아닙니다'});
const POLL_MS = 5_000, POLL_LIMIT = 60;
const shortAddress = value => value.length > 19 ? `${value.slice(0, 9)}…${value.slice(-6)}` : value;
// Which pair the server applied when the draft was made: only what the response/record states, never inferred from the symbol.
export function pairApplied(item) {
  const operator = item?.operator;
  if (item?.operatorState !== 'drafted' || !operator || typeof operator !== 'object') return null;
  const suggested = text(item.launchSuggestion?.pairAsset), address = text(operator.pairToken);
  if (operator.pairSource === 'suggestion' && address) return `초안 페어 자산: 제안 종목 ${suggested || '적용'} · ${shortAddress(address)} (Factory 승인 목록에서 확인)`;
  if (operator.pairSource === 'request') return address ? `초안 페어 자산: 요청한 페어 토큰 ${shortAddress(address)}` : '초안 페어 자산: 요청에 따라 ETH';
  if (operator.pairSource === null && suggested) return `초안 페어 자산: ETH · 제안 종목 ${suggested}은(는) Factory 승인 목록에 없어 적용하지 않음`;
  return null;
}
export function pairDraftNote(response, item) {
  const suggested = text(item?.launchSuggestion?.pairAsset);
  if (response?.pairSource === 'suggestion' && text(response.pairToken)) return ` 제안 종목 ${suggested || '페어'}을(를) 초안의 페어 자산으로 적용했습니다.`;
  if (response?.pairSource === null && suggested) return ` 제안 종목 ${suggested}은(는) Factory 승인 목록에 없어 초안은 ETH 페어입니다.`;
  return '';
}

export function createNextBangers({api, document = globalThis.document, onOpenCandidate = () => {}, toast = () => {}, now = () => Date.now(), confirm = message => (typeof globalThis.confirm === 'function' ? globalThis.confirm(message) : true)}) {
  const root = document.querySelector('#banger-next-bangers');
  if (!root) return {render: async () => {}, refresh: async () => {}, reset() {}};
  const el = (tag, cls, value) => { const node = document.createElement(tag); if (cls) node.className = cls; if (value != null) node.textContent = String(value); return node; };
  const add = (parent, ...children) => { for (const child of children) if (child) parent.append(child); return parent; };
  const link = (label, url, cls = 'text-link') => { const safe = safeUrl(url); if (!safe) return null; const node = el('a', cls, label); node.href = safe; node.target = '_blank'; node.rel = 'noopener noreferrer'; return node; };
  const button = (label, handler, cls = 'button small subtle') => { const node = el('button', cls, label); node.type = 'button'; node.addEventListener('click', handler); return node; };
  const pill = (label, tone) => el('span', `pill${tone ? ` ${tone}` : ''}`, label);
  const option = (value, label) => { const node = el('option', '', label); node.value = value; return node; };
  const labelled = (label, node) => { node.setAttribute('aria-label', label); return add(el('label', 'next-bangers-control'), el('span', 'sr-only', label), node); };
  let result = null, loading = false, error = '', version = 0, lastRequestAt = null, lastKey = null, pollTimer = null, polls = 0, rateLimited = false;
  const dismissing = new Set();

  const hoursSelect = el('select'); hoursSelect.id = 'next-bangers-hours';
  for (const [value, label] of [['6', '원문 최근 6시간'], ['24', '원문 최근 24시간'], ['168', '원문 최근 7일']]) hoursSelect.append(option(value, label));
  hoursSelect.value = '24';
  const includeSelect = el('select'); includeSelect.id = 'next-bangers-include';
  includeSelect.append(option('all', '전체'), option('admitted', '제안 가능만')); includeSelect.value = 'all';
  const generateButton = button('제안 생성 ↻', () => generate(false), 'button small primary'); generateButton.id = 'next-bangers-generate';
  const forceButton = button('강제 생성', () => generate(true)); forceButton.id = 'next-bangers-force'; forceButton.hidden = true;
  const refreshButton = button('다시 읽기', () => render()); refreshButton.id = 'next-bangers-refresh';
  const header = add(el('div', 'next-bangers-heading'),
    add(el('div'), el('div', 'eyebrow', 'EVIDENCE → WINNER PATTERNS → NEXT BANGER PROPOSALS'), el('h2', '', '다음 뱅어 제안 · AI 구상'),
      el('p', 'muted', '최근 원문(촉매·사건·캐릭터)과 TOP100 승자 패턴을 읽고, 다음 뱅어가 될 수 있는 토큰 구상을 제안합니다. 구상은 발행 결정이 아니며 발행 적격성은 기존 정책 규칙을 따릅니다.')),
    add(el('div', 'next-bangers-actions'), labelled('원문 기간', hoursSelect), labelled('표시 범위', includeSelect), generateButton, forceButton, refreshButton));
  header.id = 'next-bangers-heading';
  const status = el('div', 'next-bangers-status'); status.id = 'next-bangers-status'; status.setAttribute('role', 'status');
  const windowRead = el('div', 'next-bangers-window-read'); windowRead.id = 'next-bangers-window-read'; windowRead.hidden = true;
  const errorNode = el('div', 'next-bangers-error'); errorNode.id = 'next-bangers-error'; errorNode.setAttribute('role', 'alert'); errorNode.hidden = true;
  const listNode = el('div', 'next-bangers-list'); listNode.id = 'next-bangers-list'; listNode.setAttribute('role', 'list');
  const held = el('details', 'next-bangers-held'); held.id = 'next-bangers-held'; held.hidden = true;
  const empty = el('div', 'empty-state next-bangers-empty'); empty.id = 'next-bangers-empty';
  const footnote = el('p', 'next-bangers-footnote'); footnote.id = 'next-bangers-footnote';
  root.replaceChildren(header, status, windowRead, errorNode, listNode, held, empty, footnote);

  const selectedHours = () => NEXT_BANGERS_HOURS.includes(String(hoursSelect.value)) ? String(hoursSelect.value) : '24';
  const selectedInclude = () => includeSelect.value === 'admitted' ? 'admitted' : 'all';
  const requestKey = () => `${selectedHours()}:${selectedInclude()}`;
  const jobActive = () => ['queued', 'running'].includes(result?.job?.state);
  const canEdit = () => result?.canEdit === true;
  const stopPolling = () => { if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; } };
  function schedulePoll() {
    stopPolling();
    if (!jobActive() || polls >= POLL_LIMIT) return;
    pollTimer = setTimeout(() => { pollTimer = null; polls++; render({poll: true}); }, POLL_MS);
    pollTimer.unref?.();
  }
  function renderStatus() {
    generateButton.disabled = loading || jobActive() || !result?.canGenerate;
    generateButton.hidden = !result || result.canGenerate !== true;
    generateButton.textContent = jobActive() ? '생성 중…' : '제안 생성 ↻';
    forceButton.hidden = !rateLimited || !result?.canGenerate; refreshButton.disabled = loading;
    root.setAttribute('aria-busy', String(loading));
    errorNode.hidden = !error; errorNode.textContent = error;
    status.replaceChildren(); status.className = 'next-bangers-status';
    windowRead.replaceChildren(); windowRead.hidden = true;
    if (!result) { status.append(el('span', '', loading ? '제안을 읽는 중…' : '아직 읽은 제안이 없습니다.')); return; }
    const parts = [];
    if (result.provider?.enabled !== true) parts.push(NEXT_BANGERS_STATUS.providerOff);
    const run = result.run, job = result.job;
    if (job && jobActive()) parts.push(NEXT_BANGERS_STATUS[job.state]);
    if (job?.state === 'done' && job.result?.skipped === 'same_evidence') parts.push(NEXT_BANGERS_STATUS.sameEvidence);
    if (job?.state === 'done' && job.result?.skipped === 'insufficient_evidence') parts.push(NEXT_BANGERS_STATUS.insufficient);
    if (job?.state === 'failed' && text(job.error)) parts.push(`마지막 작업 실패 · ${job.error.slice(0, 80)}`);
    if (run) {
      if (clock(run.createdAt)) parts.push(`마지막 생성 ${clock(run.createdAt)}`);
      const evidence = run.evidence || {};
      if (number(evidence.kept)) parts.push(`원문 ${count(evidence.kept)}개${evidence.byLane && number(evidence.byLane.catalyst) ? ` (촉매 ${count(evidence.byLane.catalyst)} · 사건 ${count(evidence.byLane.event ?? 0)} · 캐릭터 ${count(evidence.byLane.character ?? 0)}${number(evidence.byLane.other) && evidence.byLane.other > 0 ? ` · 소재 원문 ${count(evidence.byLane.other)}` : ''})` : ''}`);
      const counts = run.counts || {};
      if (number(counts.admitted)) parts.push(`제안 ${count(counts.admitted)}`);
      if (number(counts.held) && counts.held > 0) parts.push(`보류 ${count(counts.held)}`);
      if (number(counts.dropped) && counts.dropped > 0) parts.push(`탈락 ${count(counts.dropped)}`);
      if (text(run.provider) === 'codex-cli') parts.push('Codex CLI');
      if (number(run.durationMs)) parts.push(`${count(Math.round(run.durationMs / 100) / 10)}초`);
      if (run.status === 'error' && text(run.error)) parts.push(`마지막 생성 실패 · ${run.error}`);
    }
    if (result.provider?.enabled === true) parts.push(number(result.provider.autoMinutes) && result.provider.autoMinutes > 0 ? `자동 생성 ${count(result.provider.autoMinutes)}분 간격` : '자동 생성 꺼짐 · 수동 생성만');
    const warn = result.provider?.enabled !== true || run?.status === 'error' || result.registry === 'unavailable';
    status.className = `next-bangers-status${warn ? ' warning' : ''}`;
    if (parts.length) status.append(el('strong', '', parts[0]));
    for (const part of parts.slice(1)) status.append(el('span', '', part));
    if (result.registry === 'unavailable' && run) status.append(el('span', '', REGISTRY_UNAVAILABLE_NOTICE));
    if (text(run?.windowReadKo)) { windowRead.hidden = false; add(windowRead, el('strong', '', '이번 창 읽기 · AI'), el('span', '', run.windowReadKo)); }
    if (run?.status === 'empty' && text(run.noProposalReasonKo)) { windowRead.hidden = false; add(windowRead, el('strong', '', '이번 창에서 제안하지 않은 이유'), el('span', '', run.noProposalReasonKo)); }
  }
  function evidenceLine(entry) {
    const li = el('li');
    if (entry.primary) li.append(pill('주 근거', 'info'));
    li.append(link('원문 ↗', entry.url) || el('span', '', '원문'));
    if (laneLabels[entry.lane]) li.append(el('span', '', laneLabels[entry.lane]));
    if (text(entry.authorHandle)) li.append(el('span', '', `@${entry.authorHandle}`));
    const at = ago(entry.publishedAt); if (at) li.append(el('span', '', at));
    if (number(entry.views)) li.append(el('span', '', `조회 ${count(entry.views)}`));
    if (number(entry.likes)) li.append(el('span', '', `좋아요 ${count(entry.likes)}`));
    if (number(entry.score)) li.append(el('span', '', `주목도 ${count(entry.score)}`));
    if (text(entry.originTier) && entry.originTier !== 'observed' && originLabels[entry.originTier]) li.append(el('span', '', originLabels[entry.originTier]));
    for (const code of list(entry.risks)) if (riskLabels[code]) li.append(pill(riskLabels[code], 'warning'));
    if (entry.robinhoodStatus === 'not_found') li.append(pill(NOT_FOUND_LABEL));
    return li;
  }
  function admissionDetail(item) {
    const admission = item.admission || {}, entries = [];
    for (const reason of list(admission.reasons)) entries.push(el('li', '', reason));
    for (const note of list(admission.notes)) entries.push(el('li', '', note));
    for (const warning of list(admission.warnings)) if (text(warning?.term)) entries.push(el('li', '', `금지 표현 관측: ${warning.term} (${warning.field})`));
    const duplicates = admission.checks?.duplicates || {};
    for (const match of list(duplicates.registry?.matches)) { const li = el('li'); add(li, el('span', '', 'Robinhood 등록부: '), link(`${text(match.tokenName) || text(match.tokenSymbol) || '토큰'} ↗`, match.url) || el('span', '', text(match.tokenName) || text(match.tokenSymbol) || '토큰')); entries.push(li); }
    for (const match of list(duplicates.top100)) entries.push(el('li', '', `TOP100: ${number(match.rank) ? `#${match.rank} ` : ''}${text(match.name) || text(match.symbol)}`));
    if (duplicates.registry?.status === 'unavailable') entries.push(el('li', '', '런치 등록부 미동기화'));
    if (!entries.length) return null;
    const details = add(el('details', 'next-banger-detail'), el('summary', '', '검증 결과'));
    const ul = el('ul'); for (const entry of entries) ul.append(entry); details.append(ul); return details;
  }
  async function act(item, path, options, done) {
    try { const response = await api(path, options); done?.(response); await render(); }
    catch (err) { toast(err.message, true); await render(); }
  }
  function dismissControl(item) {
    const wrap = el('span', 'next-banger-dismiss');
    const select = el('select'); select.setAttribute('aria-label', '제외 사유');
    for (const [value, label] of Object.entries(FEEDBACK_REASONS)) select.append(option(value, label));
    select.value = 'weak';
    add(wrap, select, button('확인', () => { dismissing.delete(item.id); return act(item, `/api/radar/next-bangers/${encodeURIComponent(item.id)}`, {method: 'PATCH', body: {feedback: 'dismiss', reason: select.value}}, () => toast('제안을 제외했습니다. 14일간 같은 이름을 다시 제안하지 않습니다.')); }, 'button small danger-outline'),
      button('취소', () => { dismissing.delete(item.id); renderAll(); }));
    return wrap;
  }
  function actions(item) {
    if (!canEdit()) return null;
    const wrap = el('div', 'next-banger-actions');
    const candidateId = item.candidate?.id || null;
    if (item.draftable) wrap.append(button('초안 만들기', async () => {
      if (item.candidate?.creativeAutoEligible === true && !confirm('이 후보는 현재 창작 자동 선별 적격 상태입니다. 초안을 만들면 자동 경로는 보류되고 수동 발행만 가능합니다. 계속할까요?')) return;
      await act(item, `/api/radar/next-bangers/${encodeURIComponent(item.id)}/draft`, {method: 'POST', body: {}}, response => { toast(`초안을 만들었습니다. 후보 창에서 시뮬레이션과 수동 발행을 진행하세요.${pairDraftNote(response, item)}`); const id = response?.candidateId || candidateId; if (id) onOpenCandidate(id); });
    }, 'button small primary'));
    if (item.draftId && candidateId) wrap.append(button('초안 열기', () => onOpenCandidate(candidateId), 'button small primary'));
    else if (candidateId && !item.draftId) wrap.append(button('후보 열기', () => onOpenCandidate(candidateId)));
    if (!candidateId && ['missing', 'queued', 'failed'].includes(item.analysis?.state) && item.operatorState !== 'dismissed') wrap.append(button('분석 우선 요청', () => act(item, `/api/radar/next-bangers/${encodeURIComponent(item.id)}/analysis`, {method: 'POST', body: {}}, () => toast('원문 분석을 우선 요청했습니다.'))));
    if (item.operatorState === 'dismissed') wrap.append(button('되돌리기', () => act(item, `/api/radar/next-bangers/${encodeURIComponent(item.id)}`, {method: 'PATCH', body: {feedback: 'restore'}})));
    else {
      wrap.append(button(item.starred ? '★ 해제' : '★ 별표', () => act(item, `/api/radar/next-bangers/${encodeURIComponent(item.id)}`, {method: 'PATCH', body: {feedback: item.starred ? 'unstar' : 'star'}})));
      if (item.operatorState !== 'drafted') wrap.append(dismissing.has(item.id) ? dismissControl(item) : button('제외', () => { dismissing.add(item.id); renderAll(); }));
    }
    return wrap.children.length ? wrap : null;
  }
  function card(item) {
    const proposal = item.tokenProposal || {};
    const article = el('article', 'next-banger'); article.setAttribute('role', 'listitem'); article.setAttribute('data-proposal', String(item.id)); article.setAttribute('data-status', String(item.status)); article.setAttribute('data-state', String(item.operatorState));
    add(article, add(el('div', 'next-banger-head'), el('span', 'next-banger-rank', `#${item.rank}`), el('h3', '', text(proposal.name) || '이름 없음'), text(proposal.symbol) ? el('span', 'next-banger-symbol', `$${proposal.symbol}`) : null));
    const pills = el('div', 'next-banger-pills');
    if (KIND_LABELS[item.kind]) pills.append(pill(KIND_LABELS[item.kind]));
    if (CONFIDENCE_LABELS[item.confidence]) pills.append(pill(`모델 확신 ${CONFIDENCE_LABELS[item.confidence]}`));
    pills.append(item.status === 'admitted' ? pill('제안 가능', 'success') : pill(`보류 · ${text(list(item.admission?.reasons)[0]) || '검증 사유'}`, 'warning'));
    if (item.starred) pills.append(pill('★ 별표'));
    if (item.draftId) pills.append(pill('초안 있음', 'info'));
    if (item.repeatOf) pills.append(pill('이전 제안 반복'));
    if (item.candidate?.creativeAutoEligible === true) pills.append(pill('창작 자동 적격', 'info'));
    if (list(item.admission?.checks?.similar).length) pills.append(pill('비슷한 이름 관측'));
    if (list(item.admission?.notes).some(note => /관측 지표가 없어/.test(note))) pills.append(pill('근거 얇음', 'warning'));
    if (list(item.patternIds).includes('political_shock')) pills.append(pill('정치·금기 주의', 'warning'));
    if (number(item.observedTraction)) pills.append(pill(`관측 주목도 ${count(item.observedTraction)}`));
    const primaryImage = list(item.evidence).some(entry => entry?.primary && entry.imageAttached === true);
    if (primaryImage) pills.append(pill(result?.image?.provider === 'source' ? '원문 이미지 캡처 → 토큰 이미지' : '원문 이미지 있음', 'info'));
    article.append(pills);
    if (text(proposal.description)) add(article, el('span', 'next-banger-label', 'Token description (EN)'), el('p', 'next-banger-description', proposal.description));
    for (const [key, label, warning] of [['jokeKo', '농담의 핵심'], ['whyNowKo', '지금인 이유'], ['namingRationaleKo', '이름 근거'], ['riskKo', '위험', true]]) if (text(item[key])) add(article, el('span', 'next-banger-label', label), el('p', `next-banger-ko${warning ? ' warning' : ''}`, item[key]));
    const chips = list(item.confirmedPatterns).filter(entry => text(entry?.id));
    if (chips.length) { const wrap = el('div', 'next-banger-patterns'); for (const chip of chips) wrap.append(el('span', 'next-banger-chip', `${text(result?.patternLabels?.[chip.id]) || text(chip.label) || chip.id}${number(chip.volumeSharePct) ? ` · TOP100 거래량 ${count(chip.volumeSharePct)}%` : ''}`)); article.append(wrap); }
    const evidence = list(item.evidence).filter(entry => entry && typeof entry === 'object');
    if (evidence.length) { article.append(el('span', 'next-banger-label', '근거 원문')); const ul = el('ul', 'next-banger-evidence'); for (const entry of [...evidence.filter(entry => entry.primary), ...evidence.filter(entry => !entry.primary)]) ul.append(evidenceLine(entry)); article.append(ul); }
    const launch = item.launchSuggestion;
    if (launch && TIMING_LABELS[launch.timing]) {
      const box = add(el('div', 'next-banger-launch'), el('strong', '', `발행 제안: ${TIMING_LABELS[launch.timing]}`));
      if (text(launch.pairAsset)) box.append(el('span', '', ` · 페어 종목 제안 ${launch.pairAsset} — 발행 파라미터 참고이며 설명 텍스트에는 넣지 않습니다${text(launch.pairRationaleKo) ? ` · ${launch.pairRationaleKo}` : ''}`));
      article.append(box);
    }
    const applied = pairApplied(item); if (applied) article.append(el('p', 'next-banger-candidate', applied));
    if (text(proposal.imagePrompt)) { const details = add(el('details', 'next-banger-detail'), el('summary', '', 'Image prompt (EN)'), el('p', '', proposal.imagePrompt)); article.append(details); }
    const admission = admissionDetail(item); if (admission) article.append(admission);
    if (item.candidate) article.append(el('p', 'next-banger-candidate', `후보: ${text(item.candidate.title) || item.candidate.id}${item.draftId ? ' · 초안 있음' : ''}`));
    else if (ANALYSIS_LABELS[item.analysis?.state]) article.append(el('p', 'next-banger-candidate', item.analysis.boostedAt ? `원문 분석 우선 요청됨 · ${ANALYSIS_LABELS[item.analysis.state]}` : ANALYSIS_LABELS[item.analysis.state]));
    const buttons = actions(item); if (buttons) article.append(buttons);
    return article;
  }
  function renderList() {
    listNode.replaceChildren(); held.replaceChildren(); held.hidden = true;
    const items = list(result?.proposals).filter(item => item && typeof item === 'object' && text(item.id));
    const visible = items.filter(item => item.status === 'admitted'), heldItems = items.filter(item => item.status === 'held');
    for (const item of visible) listNode.append(card(item));
    if (heldItems.length) {
      held.hidden = false; held.append(el('summary', '', `보류된 제안 ${count(heldItems.length)}건 · 사유 보기`));
      const ul = el('ul');
      for (const item of heldItems) { const li = el('li'); add(li, el('strong', '', `${text(item.tokenProposal?.name) || '이름 없음'}${text(item.tokenProposal?.symbol) ? ` ($${item.tokenProposal.symbol})` : ''}`), el('span', '', ` — ${list(item.admission?.reasons).join(' · ') || '검증 사유'}`)); const primary = list(item.evidence).find(entry => entry?.primary); const anchor = primary ? link(' 원문 ↗', primary.url) : null; if (anchor) li.append(anchor); if (item.candidate?.id && canEdit()) li.append(button('후보 열기', () => onOpenCandidate(item.candidate.id))); ul.append(li); }
      held.append(ul);
    }
    listNode.hidden = visible.length === 0;
    empty.hidden = visible.length > 0 || (!result && loading);
    empty.textContent = !result ? (loading ? '제안을 불러오는 중…' : NEXT_BANGERS_EMPTY) : result.canEdit ? NEXT_BANGERS_EMPTY : NEXT_BANGERS_EMPTY_READER;
    if (result && !visible.length && heldItems.length) empty.textContent = '제안 가능한 구상이 없습니다. 보류된 제안의 사유를 확인하세요.';
  }
  function renderFootnote() { footnote.textContent = text(result?.disclaimer) || NEXT_BANGERS_DISCLAIMER; }
  function renderAll() { renderStatus(); renderList(); renderFootnote(); }
  async function render({poll = false} = {}) {
    const request = ++version, key = requestKey(); loading = true; error = ''; lastRequestAt = now(); lastKey = key; if (!poll) { polls = 0; stopPolling(); } renderStatus();
    try {
      const next = await api(`/api/radar/next-bangers?hours=${selectedHours()}&include=${selectedInclude()}`);
      if (request !== version) return;
      if (!next || typeof next !== 'object') throw new Error('제안 응답 형식이 올바르지 않습니다.');
      result = next;
    } catch (err) {
      if (request !== version) return;
      if (err?.status === 404) result = {provider: {enabled: false, name: null, error: 'NOT_DEPLOYED', autoMinutes: 0}, canGenerate: false, canEdit: false, registry: 'unavailable', patternLabels: {}, job: null, run: null, proposals: [], runs: []};
      else error = `제안을 읽지 못했습니다: ${err.message}${result ? ' 마지막으로 읽은 결과를 유지합니다.' : ''}`;
    } finally { if (request === version) { loading = false; renderAll(); schedulePoll(); } }
  }
  async function generate(force) {
    if (!result?.canGenerate) return;
    try {
      const response = await api(`/api/radar/next-bangers/run`, {method: 'POST', body: {hours: Number(selectedHours()), force}});
      rateLimited = false;
      toast(response?.queued === false ? '이미 등록된 제안 작업이 있습니다. 처리되면 갱신됩니다.' : '제안 작업을 등록했습니다. 워커가 처리하면 갱신됩니다.');
      if (result) result = {...result, job: response?.job ?? {state: 'queued'}};
      polls = 0; renderAll(); schedulePoll();
    } catch (err) {
      if (err?.status === 429) { rateLimited = true; toast('10분 안에 이미 생성했습니다. 강제 생성을 누르면 다시 만듭니다.', true); renderStatus(); }
      else toast(err.message, true);
    }
  }
  function refresh() {
    if (loading) return Promise.resolve();
    if (jobActive()) return render({poll: true});
    if (lastRequestAt !== null && lastKey === requestKey() && now() - lastRequestAt < 60_000) return Promise.resolve();
    return render();
  }
  function reset() { version++; result = null; loading = false; error = ''; lastRequestAt = null; lastKey = null; rateLimited = false; polls = 0; dismissing.clear(); stopPolling(); renderAll(); }
  hoursSelect.addEventListener('change', () => render());
  includeSelect.addEventListener('change', () => render());
  renderAll();
  return {render, refresh, reset};
}
