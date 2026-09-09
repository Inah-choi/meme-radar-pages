// Public Pons snapshot review. All filtering stays local; this module never writes or launches.
const list = value => Array.isArray(value) ? value : [];
const number = value => typeof value === 'number' && Number.isFinite(value);
const text = value => typeof value === 'string' ? value.trim() : '';
const count = value => number(value) ? value.toLocaleString('ko-KR', {maximumFractionDigits: 1}) : '미제공';
const money = value => number(value) ? new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', maximumFractionDigits: 0}).format(value) : '미제공';
const percent = value => number(value) ? `${count(value)}%` : '미제공';
const date = value => { const time = Date.parse(value); return Number.isFinite(time) ? new Date(time).toLocaleString('ko-KR', {year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short'}) : '시각 미제공'; };
const utcDate = value => { const time = Date.parse(value); return Number.isFinite(time) ? new Date(time).toISOString() : '시각 미제공'; };
const safeUrl = value => { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; } };
const confidenceLabel = value => ({high: '높음', medium: '중간', low: '낮음'}[value] || text(value));
export const PONS_MARKET_PAGE_SIZE = 25;
export const PONS_MARKET_SCOPE = '이름·설명에서 읽은 밈 해석이며 공식 파생 관계나 거래량의 원인을 입증하지 않습니다. 기존 토큰을 그대로 복제하는 추천이 아닙니다.';

export function createPonsMarketReview({api, document = globalThis.document, now = () => Date.now()}) {
  const root = document.querySelector('#banger-pons-market');
  if (!root) return {render: async () => {}, refresh: async () => {}, reset() {}};
  const el = (tag, cls, value) => { const node = document.createElement(tag); if (cls) node.className = cls; if (value != null) node.textContent = String(value); return node; };
  const add = (parent, ...children) => { for (const child of children) if (child) parent.append(child); return parent; };
  const link = (label, url, cls = 'text-link') => { const safe = safeUrl(url); if (!safe) return null; const node = el('a', cls, label); node.href = safe; node.target = '_blank'; node.rel = 'noopener noreferrer'; return node; };
  const button = (label, handler, cls = 'button small subtle') => { const node = el('button', cls, label); node.type = 'button'; node.addEventListener('click', handler); return node; };
  const labelled = (label, node) => { node.setAttribute('aria-label', label); return add(el('label', 'pons-market-control'), el('span', 'sr-only', label), node); };
  const option = (value, label) => { const node = el('option', '', label); node.value = value; return node; };
  let result = null, loading = false, error = '', version = 0, lastRequestAt = null, page = 0, catalogExpanded = false;
  const expanded = new Set();

  const refreshButton = button('스냅샷 다시 읽기 ↻', () => render());
  refreshButton.id = 'pons-market-refresh';
  const header = add(el('div', 'pons-market-heading'), add(el('div'), el('div', 'eyebrow', 'PONS · VOLUME → MEME PATTERN → NEXT SOURCE'), el('h2', '', 'Pons 시장 분석'), el('p', 'muted', '거래량이 제공된 토큰의 공통 농담과 다음에 찾을 원문을 짚습니다. 전체 순위의 검증 상태와 표본 범위를 함께 확인하세요.')), refreshButton);
  const status = el('div', 'pons-market-status'); status.id = 'pons-market-status'; status.setAttribute('role', 'status');
  const scopeWarning = el('div', 'pons-market-scope-warning'); scopeWarning.id = 'pons-market-scope-warning';
  const measurementNote = el('div', 'pons-market-measurement'); measurementNote.id = 'pons-market-measurement'; measurementNote.hidden = true;
  const errorNode = el('p', 'pons-market-error'); errorNode.id = 'pons-market-error'; errorNode.setAttribute('role', 'alert'); errorNode.hidden = true;
  const stats = el('div', 'pons-market-stats'); stats.id = 'pons-market-stats';
  const families = el('section', 'pons-market-families'); families.id = 'pons-market-families'; families.setAttribute('aria-label', '거래되는 밈 계열');
  const feedback = el('details', 'pons-market-feedback'); feedback.id = 'pons-market-feedback';
  const diagnostics = el('section', 'pons-market-diagnostics'); diagnostics.id = 'pons-market-diagnostics'; diagnostics.setAttribute('aria-label', '모델 완료와 대기열 진단');
  const catalog = el('details', 'pons-market-catalog'); catalog.id = 'pons-market-catalog'; catalog.open = true;
  const catalogIntro = el('p', 'pons-market-catalog-intro');
  const catalogSearch = el('input'); catalogSearch.id = 'pons-market-catalog-search'; catalogSearch.type = 'search'; catalogSearch.maxLength = 200; catalogSearch.placeholder = 'V2 사례 이름, 농담, 계열 검색'; catalogSearch.value = '';
  const catalogCount = el('span', 'muted'); catalogCount.id = 'pons-market-catalog-count'; catalogCount.setAttribute('aria-live', 'polite');
  const catalogGrid = el('div', 'pons-market-catalog-grid'); catalogGrid.id = 'pons-market-catalog-grid';
  const catalogToggle = button('', () => { catalogExpanded = !catalogExpanded; renderCatalog(); }); catalogToggle.id = 'pons-market-catalog-toggle';
  catalog.append(el('summary', '', 'V2 소재 사례 · 거래량 순위 미확인'), catalogIntro, add(el('div', 'pons-market-catalog-controls'), labelled('V2 사례 검색', catalogSearch), catalogCount), catalogGrid, catalogToggle);
  const search = el('input'); search.id = 'pons-market-search'; search.type = 'search'; search.maxLength = 200; search.placeholder = '이름, 티커, 농담, 계열 검색'; search.value = '';
  const family = el('select'); family.id = 'pons-market-family'; family.append(option('all', '전체 계열')); family.value = 'all';
  const coverage = el('select'); coverage.id = 'pons-market-coverage';
  for (const [value, label] of [['all', '원문 대조 전체'], ['seen', '연결 원문 있음'], ['missed', '연결 원문 없음'], ['material', '소재 연결 있음'], ['unknown', '대조 미제공']]) coverage.append(option(value, label));
  coverage.value = 'all';
  const controls = add(el('div', 'pons-market-controls'), labelled('Pons 토큰 검색', search), labelled('Pons 밈 계열', family), labelled('저장 원문 대조', coverage));
  const resultLabel = el('p', 'pons-market-result-label'); resultLabel.id = 'pons-market-result-label'; resultLabel.setAttribute('aria-live', 'polite');
  const paginationTop = el('div', 'pons-market-pagination'); paginationTop.id = 'pons-market-pagination-top';
  const paginationBottom = el('div', 'pons-market-pagination'); paginationBottom.id = 'pons-market-pagination-bottom';
  const table = el('table', 'pons-market-table'); table.id = 'pons-market-table';
  const caption = el('caption', 'sr-only', 'Pons 검색 표본의 24시간 거래량 순위. 전체 Pons 순위는 별도 검증이 필요합니다.');
  const thead = el('thead'), headerRow = el('tr');
  for (const label of ['표본 순위', '토큰', '24h 거래량 · USD', '밈 해석 · 원문 연결']) { const th = el('th', '', label); th.scope = 'col'; headerRow.append(th); }
  thead.append(headerRow); const tbody = el('tbody'); table.append(caption, thead, tbody);
  const empty = el('p', 'pons-market-empty'); empty.id = 'pons-market-empty';
  const tableWrap = add(el('div', 'pons-market-table-wrap'), table);
  root.replaceChildren(header, status, measurementNote, scopeWarning, errorNode, stats, families, feedback, diagnostics, catalog, el('p', 'pons-market-scope', PONS_MARKET_SCOPE), controls, add(el('div', 'pons-market-results'), resultLabel, paginationTop), tableWrap, empty, paginationBottom);

  const tokens = () => list(result?.tokens).filter(token => token && typeof token === 'object').slice().sort((a, b) => (number(a.rank) ? a.rank : Infinity) - (number(b.rank) ? b.rank : Infinity));
  const referenceValuation = () => result?.snapshot?.measurement?.basis === 'onchain_quote_reference_usd';
  const volumeLabel = () => referenceValuation() ? '24h 환산 거래량' : '24h 거래량';
  const sampleLabel = () => referenceValuation() ? '온체인 환산 결과' : '거래량 제공 검색 결과';
  const completeRanking = () => result?.status !== 'missing' && result?.status !== 'partial' && result?.snapshot?.complete === true && result?.snapshot?.platformScope?.verified === true && result.snapshot.target === 100 && result.snapshot.count === 100 && tokens().length === 100;
  function renderStatus() {
    refreshButton.disabled = loading;
    root.setAttribute('aria-busy', String(loading));
    errorNode.hidden = !error; errorNode.textContent = error;
    const snapshot = result?.snapshot;
    status.replaceChildren(); status.className = 'pons-market-status'; scopeWarning.replaceChildren(); scopeWarning.hidden = true;
    measurementNote.replaceChildren(); measurementNote.hidden = true;
    if (!snapshot) { status.append(el('span', '', loading ? 'Pons 거래량 스냅샷을 읽는 중…' : '아직 저장된 Pons 시장 스냅샷이 없습니다.')); return; }
    const total = number(snapshot.count) ? snapshot.count : tokens().length;
    const target = number(snapshot.target) ? snapshot.target : 100;
    const complete = completeRanking(), stale = result.status === 'stale' || snapshot.stale === true;
    const state = result.status === 'missing' ? '스냅샷 없음' : complete ? `전체 TOP100 범위 확인${referenceValuation() ? ' · 환산 거래량 기준' : ''}` : '전체 TOP100 검증 대기';
    status.className = `pons-market-status${complete && !stale ? '' : ' warning'}`;
    const measuredAt = referenceValuation() ? snapshot.measurement.windowEnd : snapshot.providerReportedAt || snapshot.capturedAt;
    add(status, el('strong', '', state), stale ? el('strong', '', '오래된 스냅샷') : null, el('span', '', `${date(measuredAt)} 기준 · ${referenceValuation() ? volumeLabel() : text(snapshot.window) || '기간 미제공'} · ${text(snapshot.currency) || '통화 미제공'} · ${complete ? `${count(total)}/${count(target)}개` : `${sampleLabel()} ${count(total)}개`}`), link(referenceValuation() ? '집계 출처 ↗' : 'Pons 원본 ↗', snapshot.sourceUrl));
    if (number(snapshot.totalListed)) status.append(el('span', 'muted', `${referenceValuation() ? '집계 대상 총' : '출처 검색 총'} ${count(snapshot.totalListed)}개 · 플랫폼 전체 수와 다를 수 있음`));
    status.append(el('span', 'muted', loading ? '저장된 스냅샷 확인 중…' : '다시 읽기는 수집 시각을 바꾸지 않습니다.'));
    if (referenceValuation()) {
      measurementNote.hidden = false;
      const measurement = snapshot.measurement;
      add(measurementNote, el('strong', '', '24h 환산 거래량 · 별도 기준가격 적용'),
        el('p', 'muted', `집계 구간 (UTC) · ${utcDate(measurement.windowStart)} → ${utcDate(measurement.windowEnd)}`),
        el('p', 'muted', '온체인 거래에서 오간 상대 자산의 총 수량을 별도로 확보한 기준가격으로 USD 환산한 값입니다. 거래 시점의 USD 금액이나 Pons 공식 API 거래량을 뜻하지 않습니다.'));
      if (text(measurement.valuationNote)) measurementNote.append(el('p', 'muted', measurement.valuationNote));
    }
    const scope = snapshot.platformScope, note = text(snapshot.scopeNote) || text(scope?.basis) || text(scope);
    scopeWarning.hidden = complete && !note;
    if (!scopeWarning.hidden) {
      if (!complete) scopeWarning.append(el('strong', '', '예비 표본 · 전체 Pons TOP100이 아닙니다.'));
      scopeWarning.append(el('p', '', note || (referenceValuation() ? '전체 Pons의 V1·V2 환산 거래량 순위를 확인하지 못했습니다. 아래는 집계 범위에서 환산한 결과이며, 포함되지 않은 토큰의 거래량은 알 수 없습니다.' : '전체 Pons의 V1·V2 거래량 순위를 확인하지 못했습니다. 아래는 거래량이 제공된 검색 결과이며, 포함되지 않은 토큰의 거래량은 알 수 없습니다.')));
      const observed = list(scope?.versionsObserved).map(text).filter(Boolean), requested = list(scope?.requestedVersions).map(text).filter(Boolean);
      if (observed.length || requested.length) scopeWarning.append(el('p', 'muted', [observed.length ? `이 표본에서 관측: ${observed.join(' · ').toUpperCase()}` : '', requested.length ? `요청 범위: ${requested.join(' · ').toUpperCase()}` : ''].filter(Boolean).join(' / ')));
    }
  }
  const stat = (label, value, note) => add(el('div', 'pons-market-stat'), el('span', 'muted', label), el('strong', '', value), el('small', 'muted', note));
  function renderStats() {
    stats.replaceChildren(); if (!result?.snapshot) return;
    const summary = result.summary || {}, stored = result.coverage || {}, denominator = number(stored.total) ? stored.total : result.snapshot.count;
    const complete = completeRanking();
    add(stats, stat(`${complete ? 'TOP100' : referenceValuation() ? '온체인 표본' : '검색 표본'}의 ${volumeLabel()}`, money(summary.volume24hUsd), referenceValuation() ? `별도 기준가격으로 환산한 합계${complete ? ' · 확인된 범위' : ' · Pons 전체 아님'}` : complete ? '범위가 확인된 순위의 거래량 합계' : '이 검색 결과의 합계 · Pons 전체 아님'), stat(`표본 상위 10개 ${referenceValuation() ? '환산 거래량' : '거래량'} 비중`, percent(summary.top10SharePct), '이 스냅샷 안에서의 집중도'), stat('표본에서 읽어낸 밈 계열', count(summary.familyCount), `${count(summary.classifiedCount)}개 분류 · 이름·설명 기반`), stat('저장 원문 연결', `${count(stored.postMatches)} / ${count(denominator)}`, `소재 연결 ${count(stored.materialMatches)}개 · 사전 발견 여부는 별도`));
  }
  function setFamily(value) { family.value = value; page = 0; renderRows(); }
  function renderFamilies() {
    families.replaceChildren();
    const items = list(result?.families).filter(entry => entry && typeof entry === 'object');
    const selected = family.value;
    family.replaceChildren(option('all', '전체 계열'));
    for (const item of items) family.append(option(String(item.id), `${text(item.label) || item.id} · ${count(item.count)}개`));
    family.value = items.some(item => String(item.id) === selected) ? selected : 'all';
    families.hidden = !items.length; if (!items.length) return;
    const heading = add(el('div', 'pons-market-section-heading'), el('h3', '', '이 표본의 이름과 농담'), el('p', 'muted', `${referenceValuation() ? '24h 환산 거래량' : '제공된 거래량'} 안에서 읽은 계열입니다. 전체 시장의 비중을 뜻하지 않습니다.`));
    const grid = el('div', 'pons-market-family-grid');
    for (const item of items) {
      const card = el('article', 'pons-market-family');
      add(card, button(`${text(item.label) || '미분류'} · ${count(item.count)}개`, () => setFamily(String(item.id)), 'pons-market-family-title'), el('p', 'pons-market-family-volume', `${referenceValuation() ? `${volumeLabel()} ` : ''}${money(item.volume24hUsd)} · 표본 ${percent(item.sharePct)}`));
      if (text(item.thesis)) card.append(el('p', '', item.thesis));
      const examples = list(item.examples).filter(entry => entry && typeof entry === 'object');
      if (examples.length) card.append(el('p', 'pons-market-examples', examples.map(entry => `${number(entry.rank) ? `#${entry.rank} ` : ''}${text(entry.name) || text(entry.symbol)}`).join(' · ')));
      const queries = list(item.scoutQueries).filter(value => text(value));
      if (text(item.nextLookFor) || queries.length) {
        const detail = add(el('details', 'pons-market-scout'), el('summary', '', '다음 원문 탐색'));
        if (text(item.nextLookFor)) detail.append(el('p', '', item.nextLookFor));
        for (const query of queries) detail.append(link(`${query} ↗`, `https://x.com/search?${new URLSearchParams({q: query, f: 'live'})}`, 'pons-market-query'));
        card.append(detail);
      }
      grid.append(card);
    }
    families.append(heading, grid);
  }
  function renderFeedback() {
    const open = feedback.open; feedback.replaceChildren(); feedback.open = open;
    const items = list(result?.feedback).filter(entry => entry && typeof entry === 'object');
    feedback.hidden = !items.length; if (!items.length) return;
    feedback.append(el('summary', '', `레이더의 빈틈 · 다음 탐색 신호 ${items.length}개`));
    feedback.append(el('p', 'pons-market-scope', '현재 보관 데이터와 수집 규칙을 대조한 진단입니다. 연결 원문이 없다는 사실만으로 발행 전에 놓쳤다고 단정하지 않습니다.'));
    const grid = el('div', 'pons-market-feedback-grid');
    for (const item of items) {
      const card = add(el('article'), el('h4', '', text(item.title) || '수집 진단'));
      for (const [key, label] of [['observation', '관측'], ['missedBecause', '놓칠 수 있는 이유'], ['change', '다음 탐색']]) if (text(item[key])) card.append(add(el('p'), el('strong', '', `${label} · `), el('span', '', item[key])));
      grid.append(card);
    }
    feedback.append(grid);
  }
  function filteredTokens() {
    const q = text(search.value).toLocaleLowerCase().slice(0, 200);
    return tokens().filter(token => {
      if (family.value !== 'all' && String(token.familyId) !== family.value) return false;
      const matched = token.coverage || {};
      if (coverage.value === 'seen' && !(number(matched.postMatches) && matched.postMatches > 0)) return false;
      if (coverage.value === 'missed' && matched.postMatches !== 0) return false;
      if (coverage.value === 'material' && !(number(matched.materialMatches) && matched.materialMatches > 0)) return false;
      if (coverage.value === 'unknown' && number(matched.postMatches)) return false;
      return !q || [token.name, token.symbol, token.address, token.description, token.familyLabel, token.memeSummary, token.mechanism, ...list(token.tags)].map(text).join(' ').toLocaleLowerCase().includes(q);
    });
  }
  function coverageText(token) {
    const value = token.coverage || {};
    return [value.listingFound === true ? '상장 목록 연결' : value.listingFound === false ? '상장 목록 미연결' : '상장 대조 미제공', number(value.postMatches) ? `원문 ${count(value.postMatches)}건` : '원문 대조 미제공', number(value.materialMatches) ? `소재 ${count(value.materialMatches)}건` : '소재 대조 미제공'].join(' · ');
  }
  function tokenIdentity(token) {
    const name = text(token.name) || '이름 미제공';
    const visual = el('span', 'pons-market-token-image'), imageUrl = safeUrl(token.imageUrl);
    if (imageUrl) { const img = el('img'); img.src = imageUrl; img.alt = name; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; img.addEventListener('error', () => visual.replaceChildren(el('span', '', text(token.symbol).slice(0, 2) || '—')), {once: true}); visual.append(img); }
    else visual.append(el('span', '', text(token.symbol).slice(0, 2) || '—'));
    const nameBlock = add(el('div'), link(name, token.launchpadUrl, 'pons-market-token-name') || el('strong', 'pons-market-token-name', name), el('span', 'pons-market-symbol', text(token.symbol) ? `$${token.symbol}` : '티커 미제공'), el('span', 'pons-market-family-label', text(token.familyLabel) || '미분류'));
    return add(el('div', 'pons-market-token'), visual, nameBlock);
  }
  function tokenRow(token) {
    const tr = el('tr'); tr.setAttribute('data-rank', String(token.rank));
    tr.append(el('td', 'pons-market-rank', number(token.rank) ? `#${token.rank}` : '—'));
    tr.append(add(el('td', 'pons-market-identity'), tokenIdentity(token)));
    const volume = add(el('td', 'pons-market-volume'), el('strong', '', money(token.volume24hUsd)), el('small', 'muted', referenceValuation() ? `${volumeLabel()} · USD` : '24h · USD'));
    if (number(token.volume24hUsd)) volume.title = `${referenceValuation() ? `${volumeLabel()}: ` : ''}${token.volume24hUsd.toLocaleString('en-US', {maximumFractionDigits: 8})} USD${referenceValuation() ? ' · 별도 기준가격 환산' : ''}`;
    tr.append(volume);
    const interpretation = el('td', 'pons-market-interpretation');
    interpretation.append(el('p', 'pons-market-meme', text(token.memeSummary) || '밈 해석 미제공'));
    interpretation.append(el('p', 'pons-market-coverage-note', coverageText(token)));
    interpretation.append(tokenDetails(token)); tr.append(interpretation); return tr;
  }
  function tokenDetails(token) {
    const key = text(token.address) || String(token.rank), details = add(el('details', 'pons-market-token-detail'), el('summary', '', '해석 · 출처 더 보기'));
    details.open = expanded.has(key); details.addEventListener('toggle', () => details.open ? expanded.add(key) : expanded.delete(key));
    const detailBody = el('div', 'pons-market-detail-body');
    if (text(token.description)) detailBody.append(add(el('p'), el('strong', '', '출처 설명 · '), el('span', '', token.description)));
    if (text(token.mechanism)) detailBody.append(add(el('p'), el('strong', '', '농담 구조 · '), el('span', '', token.mechanism)));
    const basis = Array.isArray(token.analysisBasis) ? token.analysisBasis.map(text).filter(Boolean).join(' · ') : text(token.analysisBasis);
    if (basis) detailBody.append(add(el('p'), el('strong', '', '해석 근거 · '), el('span', '', basis)));
    const confidence = confidenceLabel(token.confidence);
    if (confidence) detailBody.append(el('p', 'muted', `분류 확신도 ${confidence} · 흥행·수익 확률이 아님`));
    detailBody.append(el('p', 'muted', `시가총액 ${money(token.marketCapUsd)} · 유동성 ${money(token.liquidityUsd)}${text(token.launchedAt) ? ` · 출시 ${date(token.launchedAt)}` : ''}`));
    if (text(token.address)) detailBody.append(el('p', 'pons-market-address', token.address));
    const tags = list(token.tags).filter(value => text(value)); if (tags.length) detailBody.append(el('p', 'muted', tags.join(' · ')));
    const refs = el('div', 'pons-market-source-links');
    for (const ref of list(token.sourceRefs).filter(entry => entry && typeof entry === 'object')) add(refs, link(`${text(ref.label) || '출처'} ↗`, ref.url));
    add(refs, link('Pons 토큰 원본 ↗', token.launchpadUrl));
    if (refs.children.length) detailBody.append(refs); else detailBody.append(el('p', 'muted', '출처 링크 미제공'));
    details.append(detailBody); return details;
  }
  function renderCatalog() {
    const entries = list(result?.catalogExamples).filter(token => token && typeof token === 'object');
    catalog.hidden = entries.length === 0;
    const q = text(catalogSearch.value).toLocaleLowerCase().slice(0, 200);
    const matches = entries.filter(token => !q || [token.name, token.symbol, token.description, token.familyLabel, token.memeSummary, token.mechanism, ...list(token.tags)].map(text).join(' ').toLocaleLowerCase().includes(q));
    const visible = catalogExpanded ? matches : matches.slice(0, 6);
    catalogIntro.textContent = `졸업 카탈로그에서 선별한 ${count(entries.length)}개 사례입니다. 거래량이 제공되지 않아 순위를 매기지 않았으며, 전체 V2 목록이 아닙니다. 아래 ${referenceValuation() ? '온체인 환산 거래량' : '거래량 검색'} 표본과 별개입니다.`;
    catalogCount.textContent = `사례 ${count(entries.length)}개 · 검색 ${count(matches.length)}개 · ${count(visible.length)}개 표시`;
    catalogGrid.replaceChildren();
    for (const token of visible) {
      const card = el('article', 'pons-market-catalog-card');
      add(card, tokenIdentity(token), el('p', 'pons-market-catalog-volume', `V2 · ${volumeLabel()} 미제공 · 순위 없음`), el('p', 'pons-market-meme', text(token.memeSummary) || '밈 해석 미제공'), tokenDetails(token));
      catalogGrid.append(card);
    }
    if (!matches.length && entries.length) catalogGrid.append(el('p', 'muted', '검색어에 맞는 V2 사례가 없습니다.'));
    catalogToggle.hidden = matches.length <= 6;
    catalogToggle.textContent = catalogExpanded ? '사례 6개만 보기' : `전체 ${count(matches.length)}개 펼치기`;
    catalogToggle.setAttribute('aria-expanded', String(catalogExpanded));
  }
  function renderDiagnostics() {
    diagnostics.replaceChildren();
    const value = result?.diagnostics;
    diagnostics.hidden = !value || typeof value !== 'object'; if (diagnostics.hidden) return;
    diagnostics.append(el('h3', '', '모델 완료 · 현재 대기열'));
    const grid = el('div', 'pons-market-diagnostic-grid');
    for (const [key, label] of [['readyLastHour', '최근 1시간 모델 분석 완료'], ['skippedLastHour', '최근 1시간 건너뜀'], ['queued', '현재 대기'], ['expiredRunning', '실행 기한 지난 작업']]) grid.append(add(el('div'), el('span', 'muted', label), el('strong', '', count(value[key]))));
    diagnostics.append(grid, el('p', 'muted', `마지막 모델 완료: ${date(value.lastReadyAt)} · 대기·건너뜀은 모델 분석 완료에 포함하지 않습니다.`));
  }
  function renderPagination(node, length) {
    node.replaceChildren(); const pages = Math.ceil(length / PONS_MARKET_PAGE_SIZE); node.hidden = pages < 2; if (pages < 2) return;
    const previous = button('이전', () => { page--; renderRows(); }); previous.disabled = page === 0; node.append(previous);
    for (let index = 0; index < pages; index++) { const pick = button(String(index + 1), () => { page = index; renderRows(); }, `button small ${index === page ? 'primary' : 'subtle'}`); pick.setAttribute('aria-label', `${index + 1}페이지`); if (index === page) pick.setAttribute('aria-current', 'page'); node.append(pick); }
    const next = button('다음', () => { page++; renderRows(); }); next.disabled = page === pages - 1; node.append(next);
  }
  function renderRows() {
    const items = filteredTokens(), full = tokens().length;
    page = Math.max(0, Math.min(page, Math.ceil(items.length / PONS_MARKET_PAGE_SIZE) - 1));
    const start = page * PONS_MARKET_PAGE_SIZE, visible = items.slice(start, start + PONS_MARKET_PAGE_SIZE);
    const complete = completeRanking();
    resultLabel.textContent = `${complete ? '범위 확인 TOP100' : sampleLabel()} ${count(full)}개 · 필터 결과 ${count(items.length)}개${items.length ? ` · ${start + 1}–${start + visible.length} 표시` : ''} · ${referenceValuation() ? '24h 환산 거래량 순위 · ' : ''}${complete ? '순위는 필터 전 기준' : '표본 내 순위'}`;
    caption.textContent = referenceValuation() ? `${complete ? '범위가 확인된 Pons' : 'Pons 온체인 표본의'} 24h 환산 거래량 ${complete ? 'TOP100' : '순위 · 전체 Pons 순위 아님'}. 별도 기준가격으로 환산했으며 거래 시점 USD 금액이 아닙니다. 순위는 필터 전 스냅샷 기준입니다.` : complete ? '범위가 확인된 Pons 24시간 거래량 TOP100. 순위는 필터 전 스냅샷 기준입니다.' : 'Pons 검색 표본의 24시간 거래량 순위. 전체 Pons 순위가 아니며 순위는 필터 전 표본 기준입니다.';
    headerRow.children[0].textContent = complete ? '순위' : '표본 순위';
    headerRow.children[2].textContent = `${volumeLabel()} · USD`;
    tbody.replaceChildren(...visible.map(tokenRow));
    tableWrap.hidden = !visible.length; empty.hidden = visible.length > 0;
    empty.textContent = loading && !result ? 'Pons 시장 스냅샷을 불러오는 중…' : !result?.snapshot || result.status === 'missing' ? '저장된 거래량 스냅샷이 없습니다. 수집된 자료가 있으면 확인된 범위와 함께 표시합니다.' : !full ? '이 스냅샷에는 토큰 행이 없습니다.' : '검색·계열·원문 연결 필터에 맞는 토큰이 없습니다.';
    renderPagination(paginationTop, items.length); renderPagination(paginationBottom, items.length);
  }
  function renderAll() { renderStatus(); renderStats(); renderFamilies(); renderFeedback(); renderDiagnostics(); renderCatalog(); renderRows(); }
  async function render() {
    const request = ++version; loading = true; error = ''; lastRequestAt = now(); renderStatus(); if (!result) renderRows();
    try { const next = await api('/api/radar/pons-top100'); if (request !== version) return; if (!next || typeof next !== 'object') throw new Error('스냅샷 응답 형식이 올바르지 않습니다.'); result = next; }
    catch (err) { if (request !== version) return; error = `Pons 스냅샷을 읽지 못했습니다: ${err.message}${result ? ' 마지막으로 읽은 스냅샷을 유지합니다.' : ''}`; }
    finally { if (request === version) { loading = false; renderAll(); } }
  }
  function refresh() { if (loading || (lastRequestAt !== null && now() - lastRequestAt < 60_000)) return Promise.resolve(); return render(); }
  function reset() { version++; result = null; loading = false; error = ''; lastRequestAt = null; page = 0; catalogExpanded = false; expanded.clear(); renderAll(); }
  for (const control of [family, coverage]) control.addEventListener('change', () => { page = 0; renderRows(); });
  search.addEventListener('input', () => { page = 0; renderRows(); });
  catalogSearch.addEventListener('input', () => { catalogExpanded = false; renderCatalog(); });
  renderAll();
  return {render, refresh, reset};
}
