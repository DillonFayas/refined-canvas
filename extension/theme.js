const defaults = { dark: true, formatting: true };

if (/^\/courses\/\d+\/grades(?:\/|$)/.test(location.pathname)) {
  document.documentElement.setAttribute('data-refined-grades', '');
}

if (/^\/calendar\/?$/.test(location.pathname)) {
  document.documentElement.setAttribute('data-refined-calendar', '');
}

if (/^\/courses\/\d+\/?$/.test(location.pathname)) {
  document.documentElement.setAttribute('data-refined-course-home', '');
}

if (/^\/(?:courses|groups)\/\d+\/discussion_topics(?:\/|$)/.test(location.pathname)) {
  document.documentElement.setAttribute('data-refined-discussions', '');
}

if (document.documentElement.matches('[data-refined-discussions], [data-refined-grades]')) {
  // InstUI keeps keyboard focus in the combobox. Reflect its active descendant
  // on the option row without depending on generated Emotion class names.
  const syncActiveOptions = () => {
    document.querySelectorAll('[data-refined-option-active]').forEach(row =>
      row.removeAttribute('data-refined-option-active'));
    for (const input of document.querySelectorAll(':is(#discussion-drawer-layout, #GradeSummarySelectMenuGroup) [role="combobox"][aria-expanded="true"]')) {
      const option = document.getElementById(input.getAttribute('aria-activedescendant'));
      const list = document.getElementById(input.getAttribute('aria-controls'));
      if (option?.matches('[role="option"]') && list?.contains(option)) {
        option.closest('[data-cid="Options.Item"]')?.setAttribute('data-refined-option-active', '');
      }
    }
  };
  let optionFrame;
  new MutationObserver(() => {
    if (optionFrame) return;
    optionFrame = requestAnimationFrame(() => {
      optionFrame = null;
      syncActiveOptions();
    });
  }).observe(document.documentElement, {
    subtree: true, childList: true, attributes: true,
    attributeFilter: ['aria-activedescendant', 'aria-expanded', 'aria-controls']
  });
}

function apply(settings) {
  for (const key of Object.keys(defaults)) {
    document.documentElement.toggleAttribute('data-refined-canvas-' + key, settings[key]);
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  for (const key of Object.keys(defaults)) {
    if (changes[key]) {
      apply({ ...Object.fromEntries(Object.keys(defaults).map(name => [
        name, document.documentElement.hasAttribute('data-refined-canvas-' + name)
      ])), [key]: changes[key].newValue ?? defaults[key] });
    }
  }
});
chrome.storage.local.get(defaults).then(apply);

if (location.pathname === '/' || location.pathname === '/dashboard' || location.pathname === '/calendar') {
  const widgetAreas = location.pathname === '/calendar' ? '#content, #right-side' : '#right-side, .ic-Dashboard-header, .ic-DashboardCard';
  const markers = ['data-refined-light-surface', 'data-refined-dark-label'];

  function luminance(color) {
    const channels = color.match(/[\d.]+/g)?.map(Number);
    if (!channels || channels.length < 3 || channels[3] === 0) return null;
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }

  function themeWidgets() {
    document.querySelectorAll(markers.map(marker => '[' + marker + ']').join(','))
      .forEach(element => markers.forEach(marker => element.removeAttribute(marker)));
    if (!document.documentElement.hasAttribute('data-refined-canvas-dark')) return;

    const surfaces = [];
    const labels = [];
    for (const element of document.querySelectorAll(widgetAreas + ', :is(' + widgetAreas + ') *')) {
      if (element.closest('img, video, canvas, iframe, .ic-DashboardCard__header_image')) continue;
      const style = getComputedStyle(element);
      const svgText = element.matches('svg text, svg tspan');
      if (!element.closest('svg')) {
        const background = luminance(style.backgroundColor);
        if (background !== null && background > 185) surfaces.push(element);
      }
      if (svgText || [...element.childNodes].some(node =>
        node.nodeType === Node.TEXT_NODE && node.textContent.trim()
      )) {
        const foreground = luminance(svgText ? style.fill : style.color);
        if (foreground !== null && foreground < 160) labels.push(element);
      }
    }
    surfaces.forEach(element => element.setAttribute(markers[0], ''));
    labels.forEach(element => element.setAttribute(markers[1], ''));
  }

  let pending;
  new MutationObserver(records => {
    if (!records.some(record => record.attributeName === 'data-refined-canvas-dark' ||
      record.target.parentElement?.closest(widgetAreas) ||
      record.target instanceof Element && (
        record.target.closest(widgetAreas) || [...record.addedNodes].some(node =>
          node instanceof Element && (node.matches(widgetAreas) || node.querySelector(widgetAreas))
        )
      )
    )) return;
    clearTimeout(pending);
    pending = setTimeout(themeWidgets, 60);
  }).observe(document.documentElement, {
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ['data-refined-canvas-dark', 'class', 'style']
  });
  themeWidgets();
}

// BetterCampus portals each own a shadow root. Install one reversible stylesheet
// per root, including roots mounted after initial page load.
const campusSheet = new CSSStyleSheet();
campusSheet.replaceSync(`
:host, html {
  color-scheme: dark;
  --bcbackground-0: #202632 !important;
  --bcbackground-0-ungradient: #202632 !important;
  --bcbackground-1: #2b3444 !important;
  --bcbackground-2: #354156 !important;
  --bctext-0: #edf1f7 !important;
  --bctext-1: #bdc9db !important;
  --bctext-2: #a9b8ce !important;
  --bcborders: #465369 !important;
  --bccards: #202632 !important;
  --background: #202632 !important;
  --foreground: #edf1f7 !important;
  --card: #202632 !important;
  --card-foreground: #edf1f7 !important;
  --popover: #252d3a !important;
  --popover-foreground: #edf1f7 !important;
  --secondary: #354156 !important;
  --secondary-foreground: #edf1f7 !important;
  --muted: #2b3444 !important;
  --muted-foreground: #bdc9db !important;
  --border: #465369 !important;
  --input: #465369 !important;
  --accent: #354156 !important;
  --accent-foreground: #edf1f7 !important;
  --brand-text: #b6b3ff !important;
}
:focus-visible { outline: 2px solid #9bc9ff; outline-offset: 2px; }
[data-refined-gauge] circle {
  stroke-width: var(--refined-ring-width) !important;
}
[data-refined-gauge] circle:not([stroke-dasharray]) { stroke: transparent !important; }
[data-refined-gauge] circle.opacity-33 { stroke: #354156 !important; opacity: 1 !important; }
[data-refined-gauge] circle[data-refined-empty] { visibility: hidden; }
@media (prefers-reduced-motion: reduce) {
  [data-refined-gauge] circle { transition: none !important; }
}
`);
function syncCampusRoots() {
  const enabled = document.documentElement.hasAttribute('data-refined-canvas-dark');
  for (const host of document.querySelectorAll('bettercampus-element, bettercampus-todo-list, bettercanvas-todo-list, bc-stickers-root')) {
    if (!/^(bettercampus-|bettercanvas-|bc-stickers-root)/.test(host.localName)) continue;
    const root = host.shadowRoot;
    if (!root) continue;
    const installed = root.adoptedStyleSheets.includes(campusSheet);
    if (enabled && !installed) root.adoptedStyleSheets = [...root.adoptedStyleSheets, campusSheet];
    if (!enabled && installed) root.adoptedStyleSheets = root.adoptedStyleSheets.filter(sheet => sheet !== campusSheet);
    if (host.localName === 'bettercampus-todo-list') {
      for (const svg of root.querySelectorAll('svg[viewBox="0 0 300 300"]')) {
        svg.setAttribute('data-refined-gauge', '');
        for (const circle of svg.querySelectorAll('circle')) {
          const width = Number(circle.getAttribute('stroke-width'));
          if (Number.isFinite(width) && width > 0) {
            circle.style.setProperty('--refined-ring-width', Math.min(width, 14) + 'px');
          }
          const dash = Number(circle.getAttribute('stroke-dasharray'));
          const offset = Number(circle.getAttribute('stroke-dashoffset'));
          circle.toggleAttribute('data-refined-empty', dash > 0 && offset >= dash - 0.01);
        }
      }
    }
  }
}
new MutationObserver(syncCampusRoots).observe(document.documentElement, {
  attributes: true, attributeFilter: ['data-refined-canvas-dark']
});
setInterval(() => { if (!document.hidden) syncCampusRoots(); }, 3000);
syncCampusRoots();

// Accept only height reports from the actual Canvas document preview frame.
window.addEventListener('message', event => {
  if (event.origin !== 'https://canvadocs.instructure.com' ||
      event.data?.type !== 'refined-document-height') return;
  if (!document.documentElement.hasAttribute('data-refined-canvas-formatting')) return;
  const height = event.data.height;
  if (!Number.isFinite(height) || height < 100 || height > 1000000) return;
  for (const frame of document.querySelectorAll('iframe[aria-label^="File preview"]')) {
    if (frame.contentWindow !== event.source) continue;
    frame.style.setProperty('height', height + 'px', 'important');
    frame.parentElement.style.setProperty('height', height + 'px', 'important');
    frame.parentElement.style.setProperty('overflow', 'visible', 'important');
    frame.parentElement.style.setProperty('resize', 'none', 'important');
  }
});

// Keep Canvas's native actions and table structure, correcting detail-cell spans.
let weeklyModuleTargets = [];
const courseHome = /^\/courses\/\d+\/?$/.test(location.pathname);
const modulesPage = /\/modules\/?$/.test(location.pathname);
if (modulesPage) document.documentElement.setAttribute('data-refined-modules', '');
const modulesPath = location.pathname.replace(/\/$/, '') + (courseHome ? '/modules' : '');
const modulePinsKey = 'module-pins:' + location.origin + modulesPath;
let modulePins;
let savingModulePin = false;
if (courseHome || modulesPage) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[modulePinsKey]) return;
    modulePins = changes[modulePinsKey].newValue ?? {};
    refinePageLayout();
  });
  chrome.storage.local.get({[modulePinsKey]: {}}).then(result => {
    modulePins = result[modulePinsKey];
    refinePageLayout();
  }, () => {
    modulePins = {};
    refinePageLayout();
  });
}
function syncWeekShortcuts() {
  const modules = document.getElementById('context_modules');
  const existing = document.querySelector('.refined-week-shortcuts');
  if (!modules) {
    existing?.remove();
    weeklyModuleTargets = [];
    return;
  }
  if (!modulePins) return;
  const targets = new Map();
  const otherTargets = [];
  for (const module of modules?.querySelectorAll('.context_module') ?? []) {
    if (module.closest('[hidden], [aria-hidden="true"], .template')) continue;
    const title = module.querySelector('.ig-header-title');
    const name = (title?.querySelector('.name') ?? title)?.textContent.trim();
    const match = /^(?:week|wk\.?)\s*#?\s*(\d{1,2})\b(?:\s*(?:[-–—/&]|to\b)\s*(?:week|wk\.?)?\s*#?\s*(\d{1,2})\b)?/i.exec(name ?? '');
    const id = module.id || module.getAttribute('data-module-id');
    if (!id || !title || !name) continue;
    const pinned = modulePins[id] ?? Boolean(match);
    let pin = module.querySelector('.refined-module-pin');
    if (!pin) {
      pin = document.createElement('button');
      pin.type = 'button';
      pin.className = 'refined-module-pin';
      pin.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m16 3 5 5-3 1-3 3v4l-1 1-7-7 1-1h4l3-3zM10 14l-7 7"/></svg>';
      (title.closest('.ig-header') || title.parentElement).append(pin);
      pin.addEventListener('click', async event => {
        event.stopPropagation();
        if (savingModulePin) return;
        savingModulePin = true;
        const next = {...modulePins, [id]: pin.getAttribute('aria-pressed') !== 'true'};
        pin.disabled = true;
        try {
          await chrome.storage.local.set({[modulePinsKey]: next});
          modulePins = next;
          syncWeekShortcuts();
        } catch {
          pin.title = 'Could not save pin. Try again.';
        } finally {
          savingModulePin = false;
          pin.disabled = false;
        }
      });
    }
    pin.setAttribute('aria-label', 'Pin ' + name + ' to module shortcuts');
    pin.setAttribute('aria-pressed', String(pinned));
    pin.title = pinned ? 'Unpin module' : 'Pin module';
    if (!pinned) continue;
    if (!match) {
      otherTargets.push({module, name});
      continue;
    }
    const first = Number(match[1]);
    const last = Number(match[2] ?? match[1]);
    if (first < 1 || last < first) continue;
    for (let number = first; number <= last; number++) {
      const span = last - first;
      if (!targets.has(number) || span < targets.get(number).span) {
        targets.set(number, {number, module, name, span});
      }
    }
  }
  const weeks = [...[...targets.values()].sort((a, b) => a.number - b.number), ...otherTargets];
  if (!weeks.length) {
    existing?.remove();
    weeklyModuleTargets = [];
    return;
  }
  if (existing?.nextElementSibling === modules && weeks.length === weeklyModuleTargets.length &&
      weeks.every((week, i) => week.module === weeklyModuleTargets[i].module &&
        week.name === weeklyModuleTargets[i].name && week.number === weeklyModuleTargets[i].number)) return;

  const shortcuts = document.createElement('nav');
  shortcuts.className = 'refined-week-shortcuts';
  shortcuts.setAttribute('aria-label', 'Jump to module');
  const label = document.createElement('span');
  label.className = 'refined-week-shortcuts-label';
  label.textContent = 'Jump to module:';
  shortcuts.append(label);
  for (const week of weeks) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = week.number === undefined ? week.name : String(week.number);
    button.setAttribute('aria-label', week.number === undefined ? week.name : 'Week ' + week.number);
    button.title = week.name;
    button.addEventListener('click', () => {
      const heading = week.module.querySelector('.ig-header') ?? week.module;
      const focusTarget = heading.querySelector('button, [role="button"]') ?? heading;
      if (focusTarget === heading) heading.tabIndex = -1;
      focusTarget.focus({preventScroll: true});
      heading.scrollIntoView({block: 'start'});
    });
    shortcuts.append(button);
  }
  existing?.remove();
  modules.before(shortcuts);
  weeklyModuleTargets = weeks;
}

let exportForm;
let exportAnchor;
let collapseButton;
let collapseAnchor;
function syncCourseCollapse() {
  const nativeButton = document.querySelector('#content #expand_collapse_all');
  if (nativeButton && nativeButton !== collapseButton) {
    collapseButton?.remove();
    collapseAnchor?.remove();
    collapseButton = nativeButton;
    collapseAnchor = document.createComment('Collapse All position');
    collapseButton.before(collapseAnchor);
  }
  if (!collapseAnchor?.isConnected) return;
  const shortcuts = document.querySelector('html[data-refined-canvas-formatting] #content .refined-week-shortcuts');
  if (shortcuts) {
    if (collapseButton.parentElement !== shortcuts) shortcuts.append(collapseButton);
  } else if (collapseAnchor.nextSibling !== collapseButton) {
    collapseAnchor.after(collapseButton);
  }
}

function syncCourseExport(formatting) {
  const sidebar = document.querySelector('#right-side');
  const lastAction = sidebar && [...sidebar.querySelectorAll('.button-sidebar-wide')].at(-1);
  const nativeForm = document.querySelector('#content button.offline_web_export')?.closest('form');
  if (nativeForm && nativeForm !== exportForm) {
    if (exportForm?.classList.contains('refined-sidebar-export')) exportForm.remove();
    exportAnchor?.remove();
    exportForm = nativeForm;
    exportAnchor = document.createComment('Course export position');
    exportForm.before(exportAnchor);
  }
  if (!exportForm || !exportAnchor?.isConnected) return;
  if (formatting && lastAction && sidebar.getClientRects().length) {
    if (exportForm.previousElementSibling !== lastAction) lastAction.after(exportForm);
    exportForm.classList.add('refined-sidebar-export');
  } else if (exportAnchor.isConnected) {
    if (exportAnchor.nextSibling !== exportForm) exportAnchor.after(exportForm);
    exportForm.classList.remove('refined-sidebar-export');
  }
}

function refinePageLayout() {
  const formatting = document.documentElement.hasAttribute('data-refined-canvas-formatting');
  if (formatting && (courseHome || modulesPage)) syncWeekShortcuts();
  if (courseHome) {
    syncCourseExport(formatting);
    syncCourseCollapse();
  }
  if (!formatting) return;
  const table = document.querySelector('#grades_summary');
  if (table) {
    addFinalGradeCalculator();
    const columns = table.querySelector('thead tr')?.children.length;
    if (columns) {
      for (const cell of table.querySelectorAll(':scope > tbody > tr.comments > td[colspan]')) {
        if (cell.colSpan !== columns) cell.colSpan = columns;
      }
    }
  }
  if (document.querySelector('#doc_preview')) {
    for (const link of document.querySelectorAll('#content a[href*="/download?"]')) {
      if (link.hasAttribute('data-refined-download')) continue;
      link.setAttribute('data-refined-download', ''); link.parentElement.classList.add('refined-download-row');
      link.title = link.textContent.trim();
      link.setAttribute('aria-label', link.textContent.trim());
      link.textContent = /\.pptx\b/i.test(link.title) ? 'Download PowerPoint' : 'Download PDF';
      // Canvas renders the size as a sibling text node, outside the link.
      const downloadRow = link.parentElement.closest('div');
      for (const node of [...(downloadRow || link.parentElement).childNodes]) {
        if (node.nodeType !== Node.TEXT_NODE) continue;
        const size = node.textContent.match(/^\s*\(([\d.,]+\s*(?:bytes?|[KMGT]i?B))\)\s*$/i);
        if (!size) continue;
        link.append(document.createTextNode(' · ' + size[1]));
        link.setAttribute('aria-label', link.getAttribute('aria-label') + ', ' + size[1]);
        node.remove();
        break;
      }
    }
  }
}
if (courseHome || modulesPage) {
  // Canvas can mount the modules, export form and sidebar in separate renders.
  // Reconcile each batch once, including when the formatting preference arrives.
  let layoutFrame = 0;
  const scheduleLayout = () => {
    if (layoutFrame) return;
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = 0;
      refinePageLayout();
    });
  };
  new MutationObserver(scheduleLayout).observe(document.documentElement, {
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ['data-refined-canvas-formatting', 'hidden', 'aria-hidden']
  });
  if (courseHome) window.addEventListener('resize', scheduleLayout);
  scheduleLayout();
} else if (/\/(?:grades|files|modules)(?:\/|$)/.test(location.pathname)) {
  setInterval(() => { if (!document.hidden) refinePageLayout(); }, 3000);
  refinePageLayout();
}

 
// The toolbar lives in the scrolling Canvas page; the authenticated renderer stays in its frame.
function readerTopInset(toolbar) {
  return (toolbar && getComputedStyle(toolbar).flexDirection !== 'column' ? toolbar.offsetHeight : 0) + 12;
}

const pdfOrigin = 'https://canvadocs.instructure.com';
window.addEventListener('message', event => {
  if (event.origin !== pdfOrigin || event.data?.type !== 'refined-pdf-state') return;
  const frame = [...document.querySelectorAll('#doc_preview iframe')].find(item => item.contentWindow === event.source);
  if (!frame || !document.documentElement.hasAttribute('data-refined-canvas-formatting')) return;
  const preview = frame.closest('#doc_preview');
    const existing = preview.querySelector('.refined-pdf-tools');
  if (existing?.pdfFrame === frame) {
    existing.updateReader(event.data);
    frame.contentWindow.postMessage({type:'refined-pdf-action',action:'ready'},pdfOrigin);
    return;
  }
  existing?.disposeReader?.();
  existing?.remove();
  const bar = document.createElement('form');
  bar.className = 'refined-pdf-tools';
  bar.setAttribute('aria-label', 'PDF navigation');
  const send = (action, page) => frame.contentWindow.postMessage({type:'refined-pdf-action',action,page},pdfOrigin);
  const button = (label, click, title = label) => {
    const item = document.createElement('button');
    item.type = 'button';
    const icons = {
      'Previous page': 'M15 18l-6-6 6-6',
      'Next page': 'M9 18l6-6-6-6',
      'Zoom out': 'M21 21l-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM8 11h6',
      'Zoom in': 'M21 21l-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM8 11h6m-3-3v6',
      'Move to side': 'M4 4h16v16H4zM15 4v16'
    };
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', icons[title]);
    svg.append(path);
    item.append(svg);
    item.setAttribute('aria-label', title);
    item.title = title;
    item.onclick = click;
    if (title === 'Zoom out' || title === 'Move to side') {
      const divider = document.createElement('i');
      divider.className = 'refined-reader-divider';
      divider.setAttribute('aria-hidden', 'true');
      bar.append(divider);
    }
    bar.append(item);
    return item;
  };
  const page = document.createElement('input');
  page.type = 'number';
  page.min = '1';
  page.max = String(event.data.count);
  page.value = '1';
  page.required = true;
  page.setAttribute('aria-label', 'PDF page number');
  const jump = value => {
    const target = Math.max(1, Math.min(Number(page.max), Math.trunc(value) || 1));
    currentPage = target;
    page.value = String(target);
    previous.disabled = target <= 1;
    next.disabled = target >= Number(page.max);
    send('page', target);
  };
  const previous = button('‹', () => jump(Number(page.value) - 1), 'Previous page');
  bar.append(page);
  const total = document.createElement('span');
  bar.append(total);
  const next = button('›', () => jump(Number(page.value) + 1), 'Next page');
  page.addEventListener('change', () => jump(page.valueAsNumber));
  bar.pdfFrame = frame;
  bar.updateCount = count => {
    page.max = String(count);
    total.textContent = '/ ' + count;
    previous.disabled = Number(page.value) <= 1;
    next.disabled = Number(page.value) >= count;
  };

  button('−', () => send('out'), 'Zoom out');
  const zoom = document.createElement('span');
  zoom.title = 'Zoom relative to the initial document view';
  bar.append(zoom);
  button('+', () => send('in'), 'Zoom in');
  const placement = button('Move to side', () => {
    bar.toggleAttribute('data-side');
    const side = bar.hasAttribute('data-side');
    placement.title = side ? 'Move to top' : 'Move to side';
    placement.setAttribute('aria-label', placement.title);

    chrome.storage.local.set({pdfSide: side});
  });
  chrome.storage.local.get({pdfSide:false}).then(({pdfSide}) => {
    bar.toggleAttribute('data-side', pdfSide);
    if (pdfSide) placement.title = 'Move to top';
    placement.setAttribute('aria-label', placement.title);
  });
  bar.onsubmit = e => { e.preventDefault(); jump(page.valueAsNumber); };
  let pageTops = [];
  let currentPage = 1;
  let resizeTimer;
  bar.syncPage = () => {
    // Course menu toggles resize the frame without resizing the window.
    // Update the page indicator without jumping to the start of that page.
    if (resizeTimer || !pageTops.length) return;
    const readingLine = readerTopInset(bar) - frame.getBoundingClientRect().top + 2;
    currentPage = Math.max(1, pageTops.findLastIndex(top => top <= readingLine) + 1);
    if (document.activeElement !== page) page.value = String(currentPage);
    bar.updateCount(Number(page.max));
  };
  bar.restoreAfterResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeTimer = null;
      if (bar.isConnected) send('page', currentPage);
    }, 200);
  };
  bar.updateReader = ({count, tops, zoom: percent}) => {
    pageTops = Array.isArray(tops) ? tops : [];
    zoom.textContent = Number.isFinite(percent) && percent > 0 ? percent + '%' : '—';
    bar.updateCount(count);
    bar.syncPage();
  };
  const bookmarkKey = 'reader-bookmarks:' + location.origin + location.pathname;
  const bookmarks = document.createElement('details');
  bookmarks.className = 'refined-bookmarks';
  const summary = document.createElement('summary');
  summary.title = 'Bookmarks';
  summary.setAttribute('aria-label', 'Bookmarks');
  summary.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 4h12v16l-6-4-6 4z"/></svg>';
  const panel = document.createElement('div');
  panel.className = 'refined-bookmark-panel';
  const quick = document.createElement('div');
  quick.className = 'refined-bookmark-quick';
  bookmarks.append(summary, panel);
  bar.append(bookmarks, quick);
  let saved = [];

  function bookmarkButton(label, action, icon) {
    const control = document.createElement('button');
    control.type = 'button';
    if (icon) {
      control.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="' + icon + '"/></svg>';
      control.setAttribute('aria-label', label);
      control.title = label;
    } else {
      control.textContent = label;
    }
    control.onclick = action;
    return control;
  }

  function renderBookmarks() {
    panel.replaceChildren();
    quick.replaceChildren();
    const label = document.createElement('input');
    label.type = 'text';
    label.placeholder = 'Optional label';
    label.setAttribute('aria-label', 'Bookmark label');
    label.maxLength = 60;
    const add = bookmarkButton('Save page', () => {
      const existing = saved.find(item => item.page === currentPage);
      if (existing) existing.label = label.value.trim();
      else saved.push({page: currentPage, label: label.value.trim(), pinned: false});
      saveBookmarks();
    }, 'M12 5v14M5 12h14');
    label.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      add.click();
    });
    const editor = document.createElement('div');
    editor.className = 'refined-bookmark-row';
    editor.append(label, add);
    panel.append(editor);
    for (const entry of saved) {
      const row = document.createElement('div');
      row.className = 'refined-bookmark-row';
      const name = entry.label ? entry.page + ' · ' + entry.label : 'Page ' + entry.page;
      const go = bookmarkButton(name, () => {
        bookmarks.open = false;
        jump(entry.page);
        summary.focus({preventScroll: true});
      });
      go.title = name;
      const pin = bookmarkButton(entry.pinned ? 'Unpin' : 'Pin', () => {
        entry.pinned = !entry.pinned;
        saveBookmarks();
      }, 'M12 17v5M5 17h14v-2l-3-3V6l1-2H7l1 2v6l-3 3z');
      pin.setAttribute('aria-pressed', String(entry.pinned));
      pin.disabled = !entry.pinned && saved.filter(item => item.pinned).length >= 3;
      const remove = bookmarkButton('Remove bookmark', () => {
        saved = saved.filter(item => item !== entry);
        saveBookmarks();
      }, 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5m4-5v5');
      remove.setAttribute('aria-label', 'Remove bookmark for ' + name);
      row.append(go, pin, remove);
      panel.append(row);
      if (entry.pinned) {
        const shortcut = bookmarkButton(String(entry.page), () => jump(entry.page));
        shortcut.title = name;
        shortcut.setAttribute('aria-label', 'Jump to ' + name);
        quick.append(shortcut);
      }
    }
  }

  function saveBookmarks() {
    chrome.storage.local.set({[bookmarkKey]: saved});
    renderBookmarks();
  }

  chrome.storage.local.get({[bookmarkKey]: []}).then(result => {
    saved = result[bookmarkKey];
    renderBookmarks();
  });
  preview.prepend(bar);
  bar.updateReader(event.data);
  send('ready');
  const previewResize = new ResizeObserver(() => {
    if (!bar.isConnected || !frame.isConnected) {
      previewResize.disconnect();
      return;
    }
    if (document.documentElement.hasAttribute('data-refined-canvas-formatting')) bar.syncPage();
  });
  bar.disposeReader = () => {
    previewResize.disconnect();
    clearTimeout(resizeTimer);
  };
  previewResize.observe(frame);
});
window.addEventListener('message', event => {
  if (event.origin !== pdfOrigin || event.data?.type !== 'refined-pdf-jump' ||
      !document.documentElement.hasAttribute('data-refined-canvas-formatting')) return;
  const frame = [...document.querySelectorAll('#doc_preview iframe')].find(item => item.contentWindow === event.source);
  const top = event.data.top;
  if (!frame || !Number.isFinite(top) || top < 0 || top > 1000000) return;
  const toolbar = frame.closest('#doc_preview').querySelector('.refined-pdf-tools');
  const marker = document.createElement('span');
  const preview = frame.closest('#doc_preview');
  marker.style.cssText = 'position:absolute;width:1px;height:1px;pointer-events:none';
  marker.style.top = (frame.getBoundingClientRect().top - preview.getBoundingClientRect().top + top) + 'px';
  marker.style.scrollMarginTop = readerTopInset(toolbar) + 'px';
  preview.append(marker);
  marker.scrollIntoView({block:'start',inline:'nearest',behavior:'instant'});
  marker.remove();
});
const canvasView = location.pathname.match(/^\/(?:courses|groups|users)\/\d+\/(users|files|quizzes)(?:\/|$)/)?.[1];
if (canvasView) document.documentElement.dataset.refinedCanvasView = canvasView;





let readerScrollFrame;
window.addEventListener('scroll', () => {
  if (readerScrollFrame) return;
  readerScrollFrame = requestAnimationFrame(() => {
    readerScrollFrame = null;
    document.querySelector('#doc_preview .refined-pdf-tools')?.syncPage();
  });
}, {capture:true, passive:true});

window.addEventListener('resize', () => {
  if (!document.documentElement.hasAttribute('data-refined-canvas-formatting')) return;
  document.querySelector('#doc_preview .refined-pdf-tools')?.restoreAfterResize();
});

document.addEventListener('DOMContentLoaded', () => {
  const moduleButtons = document.createElement('nav');
  moduleButtons.className = 'refined-module-buttons';
  moduleButtons.setAttribute('aria-label', 'Module navigation');
  document.body.append(moduleButtons);
  function syncModuleButtons() {
    for (const button of document.querySelectorAll('#assignments-student-footer button')) {
      button.toggleAttribute('data-refined-new-attempt', /^new attempt$/i.test(button.textContent.trim()));
    }
    const footer = document.querySelector('.module-sequence-footer, #assignments-student-footer');
    if (!footer || footer.hasAttribute('data-refined-module-relocated')) return;
    const links = footer.querySelectorAll('a[href][data-testid="previous-assignment-btn"], a[href][data-testid="next-assignment-btn"], a[href][rel~=prev], a[href][rel~=next], .module-sequence-footer-button--previous a[href], .module-sequence-footer-button--next a[href], a.module-sequence-footer-button--previous[href], a.module-sequence-footer-button--next[href]');
    if (!links.length) return;
    moduleButtons.replaceChildren();
    for (const link of links) {
      const previous = link.dataset.testid === 'previous-assignment-btn' || link.relList.contains('prev') || !!link.closest('.module-sequence-footer-button--previous');
      const control = document.createElement('a');
      control.href = link.href;
      control.className = 'refined-module-button';
      control.title = previous ? 'Previous module item' : 'Next module item';
      control.setAttribute('aria-label', control.title);
      control.textContent = previous ? '←' : '→';
      moduleButtons.append(control);
    }
    footer.setAttribute('data-refined-module-relocated', '');
  }
  if (!/\/taking(?:\/|$)/.test(location.pathname)) {
    new MutationObserver(syncModuleButtons).observe(document.body, {childList: true, subtree: true});
  }
  syncModuleButtons();
const courseMenuToggle = document.getElementById('courseMenuToggle');
if (courseMenuToggle) {
  // Match the course term without fading the navigation links around it.
  const termLabel = [...document.querySelectorAll('#left-side *')].find(element =>
    element.childElementCount === 0 &&
    /\b(?:Fall|Spring|Summer|Winter)\s+(?:Semester|Quarter|Term)\b/i.test(element.textContent)
  );
  const menuRow = courseMenuToggle.closest('.ic-app-nav-toggle-and-crumbs');
  if (!menuRow) return;
  const anchor = document.createElement('div');
  anchor.setAttribute('aria-hidden', 'true');
  menuRow.before(anchor);
  menuRow.classList.add('refined-floating-menu-host');
  const menuSpacer = document.createElement('span');
  menuSpacer.className = 'refined-menu-spacer';
  menuSpacer.setAttribute('aria-hidden', 'true');
  courseMenuToggle.before(menuSpacer);
  termLabel?.classList.add('refined-course-term');
  const backToTop = document.createElement('button');
  backToTop.type = 'button';
  backToTop.className = 'refined-back-to-top';
  backToTop.hidden = true;
  backToTop.title = 'Back to top';
  backToTop.setAttribute('aria-label', 'Back to top');
  backToTop.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5h14M12 20V9m-5 5 5-5 5 5"/></svg>';
  courseMenuToggle.after(backToTop);
  let courseScroller;
  backToTop.onclick = event => {
    if (event.detail === 0) courseMenuToggle.focus({preventScroll: true});
    // The hamburger is translated as you scroll, so it cannot serve as a scroll target.
    for (let container = courseMenuToggle.parentElement; container; container = container.parentElement) {
      if (container.scrollTop > 0) container.scrollTo({top: 0, behavior: 'instant'});
    }
    courseScroller?.scrollTo({top: 0, behavior: 'instant'});
    window.scrollTo({top: 0, behavior: 'instant'});
    scheduleCourseMenu();
  };
  let menuOffset = 0;
  let menuFrame;
  function positionCourseMenu() {
    menuFrame = null;
    const top = anchor.getBoundingClientRect().top;
    menuOffset = document.documentElement.hasAttribute('data-refined-canvas-formatting')
      ? Math.max(0, -top)
      : 0;
    menuRow.style.setProperty('--refined-menu-left', menuRow.getBoundingClientRect().left + 'px');
    const toggleStyle = getComputedStyle(courseMenuToggle);
    menuSpacer.style.inlineSize = courseMenuToggle.offsetWidth + 'px';
    menuSpacer.style.marginInline = toggleStyle.marginInline;
    document.documentElement.toggleAttribute('data-refined-menu-pinned', menuOffset > 0);
    backToTop.hidden = menuOffset < 64;
    const toggleBounds = courseMenuToggle.getBoundingClientRect();
    moduleButtons.style.left = toggleBounds.left + 'px';
    moduleButtons.style.setProperty('--module-button-size', toggleBounds.height + 'px');
    document.documentElement.style.setProperty(
      '--refined-course-links-top', (courseMenuToggle.offsetHeight + 24) + 'px'
    );
  }
  function scheduleCourseMenu() {
    if (!menuFrame) menuFrame = requestAnimationFrame(positionCourseMenu);
  }
  window.addEventListener('scroll', event => {
    if (event.target instanceof Element && event.target.matches('#wrapper, #main, #not_right_side, #content-wrapper, #content')) {
      courseScroller = event.target;
    }
    scheduleCourseMenu();
  }, {capture: true, passive: true});
  window.addEventListener('resize', scheduleCourseMenu);
  const courseSidebar = document.getElementById('left-side');
  if (courseSidebar) {
    const sidebarResize = new ResizeObserver(scheduleCourseMenu);
    sidebarResize.observe(courseSidebar);
  }
  const menuLayout = new MutationObserver(scheduleCourseMenu);
  menuLayout.observe(document.body, {attributes: true, attributeFilter: ['class']});
  courseMenuToggle.addEventListener('click', event => {
    if (event.detail > 0) courseMenuToggle.blur();
    scheduleCourseMenu();
  });
  scheduleCourseMenu();
}
});










document.addEventListener('DOMContentLoaded', () => {
  for (const heading of document.querySelectorAll('#right-side :is(h2, h3)')) {
    if (heading.textContent.trim() !== 'Recent Feedback') continue;
    heading.nextElementSibling?.classList.add('recent-feedback');
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('header');
  if (!header) return;
  const syncCollapsed = () => header.toggleAttribute('data-refined-collapsed', header.getBoundingClientRect().width < 85);
  new ResizeObserver(syncCollapsed).observe(header);
  syncCollapsed();
  const tooltip = document.createElement('div');
  tooltip.className = 'refined-nav-tooltip';
  tooltip.setAttribute('aria-hidden', 'true');
  tooltip.hidden = true;
  document.body.append(tooltip);

  const navLinkSelector = '.ic-app-header__menu-list-link:has(.menu-item__text)';
  let immediateTooltipLink;
  for (const link of header.querySelectorAll(navLinkSelector)) {
    const label = link.querySelector('.menu-item__text');
    if (!label) continue;
    link.removeAttribute('title');
    link.querySelectorAll('[title]').forEach(element => element.removeAttribute('title'));
    const show = () => {
      if (!document.documentElement.hasAttribute('data-refined-canvas-dark') ||
          label.getClientRects().length && getComputedStyle(label).visibility === 'visible' &&
          label.getBoundingClientRect().width > 4 && link.offsetWidth > 80) return;
      const bounds = link.getBoundingClientRect();
      tooltip.textContent = label.textContent.trim();
      tooltip.style.left = (bounds.right + 8) + 'px';
      tooltip.style.top = (bounds.top + bounds.height / 2) + 'px';
      tooltip.hidden = !tooltip.textContent;
      document.documentElement.toggleAttribute('data-refined-nav-tooltip', !tooltip.hidden);
    };
    let hoverTimer;
    const hide = () => {
      clearTimeout(hoverTimer);
      tooltip.hidden = true;
      document.documentElement.removeAttribute('data-refined-nav-tooltip');
    };
    link.addEventListener('mouseenter', () => {
      if (document.documentElement.hasAttribute('data-refined-canvas-dark')) {
        document.documentElement.setAttribute('data-refined-nav-tooltip', '');
      }
      if (immediateTooltipLink === link) show();
      else hoverTimer = setTimeout(show, 1000);
      immediateTooltipLink = null;
    });
    link.addEventListener('focus', show);
    link.addEventListener('mouseleave', event => {
      const nextLink = event.relatedTarget?.closest?.(navLinkSelector);
      immediateTooltipLink = !tooltip.hidden && nextLink && header.contains(nextLink) ? nextLink : null;
      hide();
    });
    link.addEventListener('blur', hide);
    link.addEventListener('click', hide);
    link.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); });
  }
});


if (/^\/(?:conversations|inbox)(?:\/|$)/.test(location.pathname)) {
  document.documentElement.setAttribute('data-refined-inbox', '');
}


if (document.documentElement.hasAttribute('data-refined-inbox')) {
  document.addEventListener('DOMContentLoaded', () => {
    const inbox = document.querySelector('#main');
    if (!inbox) return;
    let refreshFrame;
    function refreshInbox() {
      refreshFrame = null;
      const dark = document.documentElement.hasAttribute('data-refined-canvas-dark');
      for (const element of inbox.querySelectorAll('[data-refined-inbox-surface], [data-refined-inbox-text]')) {
        element.removeAttribute('data-refined-inbox-surface');
        element.removeAttribute('data-refined-inbox-text');
      }
      if (!dark) return;

      const surfaces = [];
      const labels = [];
      const brightness = color => {
        const values = color.match(/[\d.]+/g)?.map(Number);
        if (!values || values.length < 3 || values[3] === 0) return null;
        return values[0] * .213 + values[1] * .715 + values[2] * .072;
      };
      for (const element of inbox.querySelectorAll('div, section, header, li, span, p, button, label, time, a, input')) {
        const style = getComputedStyle(element);
        const background = brightness(style.backgroundColor);
        if (background !== null && background > 190) surfaces.push(element);
        const color = brightness(style.color);
        if (color !== null && color < 150 &&
            (element.matches('button, input, time') || [...element.childNodes].some(node =>
              node.nodeType === Node.TEXT_NODE && node.textContent.trim()
            ))) labels.push(element);
      }
      surfaces.forEach(element => element.setAttribute('data-refined-inbox-surface', ''));
      labels.forEach(element => element.setAttribute('data-refined-inbox-text', ''));
    }

    function scheduleInboxRefresh() {
      if (!refreshFrame) refreshFrame = requestAnimationFrame(refreshInbox);
    }
    const observer = new MutationObserver(scheduleInboxRefresh);
    observer.observe(inbox, {
      subtree: true, childList: true, characterData: true, attributes: true,
      attributeFilter: ['class', 'style', 'aria-selected', 'aria-checked', 'disabled']
    });
    observer.observe(document.documentElement, {attributes: true, attributeFilter: ['data-refined-canvas-dark']});
    scheduleInboxRefresh();
  });
}



if (/^\/profile\/(?:communication|files|settings|announcements)(?:\/|$)/.test(location.pathname)) {
  document.documentElement.setAttribute('data-refined-account-view', '');
}

if (/^\/users\/\d+\/files(?:\/|$)/.test(location.pathname)) {
  document.documentElement.setAttribute('data-refined-account-view', '');
}
if (/^\/profile\/settings\/?$/.test(location.pathname)) {
  document.documentElement.setAttribute('data-refined-account-settings', '');
}

if (/^\/(?:profile\/files|users\/\d+\/files|files)(?:\/|$)/.test(location.pathname)) {
  document.documentElement.setAttribute('data-refined-personal-files', '');
  document.documentElement.setAttribute('data-refined-account-view', '');
}






if (/^\/courses\/\d+\/assignments\/?$/.test(location.pathname)) {
  document.documentElement.setAttribute('data-refined-assignment-index', '');
}
if (/^\/courses\/?$/.test(location.pathname)) {
  document.documentElement.setAttribute('data-refined-courses-index', '');
}

document.addEventListener('DOMContentLoaded', () => {
  const menu = document.querySelector('#header #menu');
  if (!menu) return;
  const hideShortcut = () => {
    for (const host of menu.querySelectorAll('bettercampus-element')) {
      // Keep the mounted component alive: removing it makes BetterCampus recreate it.
      // Its shadow reset overrides host inline styles, so hide from inside that root.
      const root = host.shadowRoot;
      if (!root || root.getElementById('refined-hide-shortcut')) continue;
      const style = document.createElement('style');
      style.id = 'refined-hide-shortcut';
      style.textContent = ':host{display:none!important}';
      root.append(style);
    }
  };
  new MutationObserver(hideShortcut).observe(menu, {
    childList: true,
    subtree: true
  });
  hideShortcut();
  // Shadow roots can attach after their hosts, without a light-DOM mutation.
  setInterval(() => { if (!document.hidden) hideShortcut(); }, 3000);
});


if (/^\/courses\/\d+\/assignments\/\d+/.test(location.pathname)) {
  document.documentElement.setAttribute('data-refined-submission', '');
  document.addEventListener('DOMContentLoaded', () => {
    const content = document.getElementById('content');
    if (!content) return;
    const syncEditors = () => {
      for (const frame of content.querySelectorAll('iframe.tox-edit-area__iframe')) {
        const editor = frame.contentDocument;
        if (!editor?.head || editor.getElementById('refined-editor-theme')) continue;
        const style = editor.createElement('style');
        style.id = 'refined-editor-theme';
        style.textContent = 'html, body { background: #191e28 !important; color: #ecf1fa !important; color-scheme: dark; }';
        editor.head.append(style);
      }
      for (const frame of content.querySelectorAll('iframe.tox-edit-area__iframe')) {
        const style = frame.contentDocument?.getElementById('refined-editor-theme');
        if (style) style.disabled = !document.documentElement.hasAttribute('data-refined-canvas-dark');
      }
    };
    const editorSelector = 'iframe.tox-edit-area__iframe';
    const observer = new MutationObserver(records => {
      if (records.some(record => record.type === 'attributes' ||
        [...record.addedNodes].some(node => node instanceof Element &&
          (node.matches(editorSelector) || node.querySelector(editorSelector))))) {
        syncEditors();
      }
    });
    observer.observe(content, { childList: true, subtree: true });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-refined-canvas-dark'] });
    content.addEventListener('load', syncEditors, true);
    syncEditors();
    if (/\/taking(?:\/|$)/.test(location.pathname)) return;

    const description = ':is(#assignment_description, [data-testid="assignment-description"], .user_content)';
    const pdfLinks = new WeakMap();
    let rubricDescriptionPending = false;
    content.addEventListener('click', event => {
      rubricDescriptionPending = Boolean(event.target.closest('[data-refined-rubric-description]'));
    }, true);
    const syncRubric = () => {
      const table = content.querySelector('#rubric-header-criteria')?.closest('table, [role="table"]');
      for (const button of table?.querySelectorAll('button, a') || []) {
        const label = button.getAttribute('aria-label') || button.textContent.trim();
        button.toggleAttribute('data-refined-rubric-description', /^view longer description$/i.test(label.trim()));
        const selectedLabel = [...button.querySelectorAll('[class*="screenReaderContent"]')]
          .some(element => /^(?:selected(?: rating)?|rating selected)[:.!]?$/i.test(element.textContent.trim()));
        button.toggleAttribute('data-refined-rubric-selected',
          /^selected\b/i.test(label.trim()) || selectedLabel);
      }
      if (!rubricDescriptionPending) return;
      const dialog = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')]
        .reverse().find(element => element.getClientRects().length);
      if (dialog) {
        dialog.setAttribute('data-refined-rubric-dialog', '');
        rubricDescriptionPending = false;
      }
    };
    new MutationObserver(syncRubric).observe(document.body, { childList: true, subtree: true });
    syncRubric();
    const syncDescriptionPdfs = () => {
      const enabled = document.documentElement.hasAttribute('data-refined-canvas-formatting');
      for (const link of content.querySelectorAll(`${description} a[href]:not(.refined-open-pdf, .refined-file-download)`)) {
        const url = new URL(link.href);
        if (!/^https?:$/.test(url.protocol)) continue;
        const name = [link.title, link.textContent.trim(), url.pathname].find(value => /\.pdf$/i.test(value));
        const canvasFile = url.origin === location.origin && /\/files\/\d+(?:\/(?:preview|download))?\/?$/.test(url.pathname);
        if (!name || (!canvasFile && !/\.pdf$/i.test(url.pathname))) continue;
        // Canvas adds a separate download action beside the original file link.
        if (canvasFile && (link.matches('[download], [role="button"]') || /\/download\/?$/.test(url.pathname)) &&
            [link.title, link.getAttribute('aria-label'), link.textContent.trim()]
              .some(label => /^Download\s/i.test(label || ''))) continue;
        const existing = pdfLinks.get(link);
        if (!enabled) {
          if (existing) {
            link.classList.toggle('auto_open', existing.autoOpen);
            link.classList.toggle('inline_disabled', existing.inlineDisabled);
            link.removeAttribute('data-refined-inline-pdf');
            existing.button.closest('.refined-file-actions')?.remove();
            pdfLinks.delete(link);
          }
          continue;
        }
        if (existing?.button.isConnected) continue;
        const button = document.createElement('a');
        button.className = 'refined-open-pdf';
        if (canvasFile) {
          url.pathname = url.pathname.replace(/\/(?:preview|download)\/?$/, '').replace(/\/$/, '');
          url.searchParams.set('wrap', '1');
          url.searchParams.delete('download_frd');
        }
        button.href = url.href;
        button.target = '_blank';
        button.rel = 'noopener';
        const label = link.textContent.trim() || link.title || name.split('/').pop();
        button.textContent = label + ' ↗';
        button.title = label;
        button.setAttribute('aria-label', `Open ${label} in a new tab`);
        pdfLinks.set(link, existing || {
          autoOpen: link.classList.contains('auto_open'),
          inlineDisabled: link.classList.contains('inline_disabled'),
          button
        });
        pdfLinks.get(link).button = button;
        link.classList.remove('auto_open');
        link.classList.add('inline_disabled');
        link.setAttribute('data-refined-inline-pdf', '');
        const actions = document.createElement('span');
        actions.className = 'refined-file-actions';
        actions.append(button);
        const download = document.createElement('a');
        download.className = 'refined-file-download';
        const downloadUrl = new URL(url);
        if (canvasFile) {
          downloadUrl.pathname += '/download';
          downloadUrl.searchParams.delete('wrap');
          downloadUrl.searchParams.set('download_frd', '1');
        }
        download.href = downloadUrl.href;
        download.setAttribute('download', '');
        download.setAttribute('aria-label', `Download ${label}`);
        download.title = `Download ${label}`;
        download.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5"/></svg>';
        actions.append(download);
        link.after(actions);
      }
      if (!enabled) return;
      for (const frame of content.querySelectorAll(`${description} iframe:is(
        [title^="File preview for " i][title$=".pdf" i],
        [aria-label^="File preview for " i][aria-label$=".pdf" i]
      )`)) {
        const toggle = (frame.closest('.file_preview, .inline_preview') || frame.parentElement)
          .querySelector('a[href="#"]');
        if (toggle) toggle.setAttribute('data-refined-inline-pdf', '');
        frame.remove();
      }
    };
    let pdfUpdatePending = false;
    const schedulePdfUpdate = () => {
      if (pdfUpdatePending) return;
      pdfUpdatePending = true;
      requestAnimationFrame(() => {
        pdfUpdatePending = false;
        syncDescriptionPdfs();
      });
    };
    const pdfObserver = new MutationObserver(schedulePdfUpdate);
    pdfObserver.observe(content, { childList: true, subtree: true });
    pdfObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-refined-canvas-formatting'] });
    syncDescriptionPdfs();

  });
}




function addFinalGradeCalculator() {
  if (!document.querySelector('#grades_summary') || document.querySelector('.refined-grade-calculator')) return;
  const weights = [...document.querySelectorAll('#right-side table')].find(table =>
    [...table.rows].some(row => /\bgroup\b/i.test(row.cells[0]?.textContent) &&
      /^weight$/i.test(row.cells[1]?.textContent.trim()))
  );
  if (!weights) return;

  const candidates = [...weights.rows].filter(row =>
    /^(?:(?:course|cumulative|comprehensive)\s+)?final(?:\s+(?:exam(?:ination)?s?|test|assessment))?(?:\s*\([^)]*\))?$/i
      .test(row.cells[0]?.textContent.trim())
  );
  const weightText = candidates.length === 1 ? candidates[0].cells[1]?.textContent.trim() : '';
  const detectedWeight = /^(\d+(?:\.\d+)?)\s*%$/.exec(weightText || '')?.[1];
  const calculator = document.createElement('section');
  calculator.className = 'refined-grade-calculator';
  calculator.setAttribute('aria-labelledby', 'refined-grade-calculator-title');
  calculator.innerHTML = `
    <label>Current grade before final (%)<input name="coursework" type="number" min="0" step="any" placeholder="e.g. 88"></label>
    <label>Final exam weight (%)<input name="weight" type="number" min="0" max="100" step="any"></label>
    <p class="refined-grade-weight-note"></p>
    <label>Desired course grade (%)<input name="target" type="number" min="0" step="any" placeholder="e.g. 90"></label>
    <output aria-live="polite"></output>
  `;
  const [coursework, weight, target] = calculator.querySelectorAll('input');
  const output = calculator.querySelector('output');
  const quips = {
    negative: [
      'You’d have to get points deducted from an exam you took last semester.',
      'You’d have to show your work on why the professor’s answer key is wrong.',
      'You’d have to hand in a blank exam and get it docked for being off-topic.'
    ],
    zero: [
      'The scantron can stay in its original packaging.',
      'Even a blank page meets the brief.',
      'Your past self has already turned in the group project.'
    ],
    low: [
      'You can save the essay-length apology for another class.',
      'For once, “show your work” can include a little doodle.',
      'You have enough breathing room to read the directions twice.'
    ],
    moderate: [
      'Study enough that “all of the above” feels like a decision.',
      'A practice exam is probably worth more than reorganizing your desk again.',
      'Time to find out which of those highlighted paragraphs you actually read.'
    ],
    eightyToNinety: [
      'You can miss a few. Try not to make them the entire back page.',
      'You need a good exam, not a handwritten letter of recommendation from your calculator.',
      'There’s room for a silly mistake. Give it a small room.'
    ],
    high: [
      'When they say “round to two decimals,” this time they mean you personally.',
      'Read the back page like it owes you money.',
      'This is a bad time to discover you’ve been practicing with the solutions open.'
    ],
    over: [
      'Ask whether the bonus question has a bonus question.',
      'You’ll need a curve with a fairly aggressive turning radius.',
      'A perfect exam gets you most of the way. The rest is a conversation about extra credit.'
    ]
  };
  const pickQuips = () => Object.fromEntries(Object.entries(quips).map(([range, choices]) =>
    [range, choices[Math.floor(Math.random() * choices.length)]]
  ));
  let messages = pickQuips();
  const validWeight = Number(detectedWeight) > 0 && Number(detectedWeight) <= 100;
  if (validWeight) weight.value = detectedWeight;
  const note = calculator.querySelector('.refined-grade-weight-note');
  note.hidden = validWeight;
  note.textContent = 'Enter the exam weight from your syllabus.';

  calculator.addEventListener('input', () => {
    const [average, examWeight, goal] = [coursework, weight, target].map(input => input.valueAsNumber);
    if (![examWeight, goal].every(Number.isFinite) || (examWeight !== 100 && !Number.isFinite(average))) {
      output.textContent = 'Enter your grades and exam weight.';
      return;
    }
    if (examWeight <= 0 || examWeight > 100 || goal < 0 || (examWeight !== 100 && average < 0)) {
      output.textContent = 'Use nonnegative grades and an exam weight above 0% and up to 100%.';
      return;
    }
    const required = examWeight === 100 ? goal : (goal * 100 - average * (100 - examWeight)) / examWeight;
    const rounded = Math.ceil((required - 1e-9) * 100) / 100;
    if (!Number.isFinite(rounded)) {
      output.textContent = 'Enter smaller values to calculate an estimate.';
    } else if (required < 0) {
      const score = rounded === 0 ? 'less than 0%' : rounded + '%';
      output.textContent = 'You’d need at least ' + score + ' on the final to get ' +
        goal + '% overall. ' + messages.negative;
    } else if (rounded === 0) {
      output.textContent = 'Even with a 0% on the final, you’d reach ' + goal +
        '% overall. ' + messages.zero;
    } else {
      const range = rounded > 100 ? 'over'
        : rounded > 90 ? 'high'
        : rounded >= 80 ? 'eightyToNinety'
        : rounded <= 60 ? 'low' : 'moderate';
      const intro = range === 'low' ? 'You only need at least ' : 'You’ll need at least ';
      output.textContent = intro + rounded + '% on the final to get ' +
        goal + '% overall. ' + messages[range];
    }
  });

  const filterGroup = document.querySelector('#GradeSummarySelectMenuGroup');
  const applyRow = filterGroup?.querySelector('#apply_select_menus')?.closest('[direction="row"]');
  const disclosure = document.createElement('details');
  const toggle = document.createElement('summary');
  toggle.id = 'refined-grade-calculator-title';
  toggle.className = 'Button';
  toggle.textContent = 'Open final exam calculator';
  disclosure.append(toggle, calculator);
  const updateCalculator = (control, open) => {
    control.textContent = open ? 'Close final exam calculator' : 'Open final exam calculator';
    if (!open) return;
    messages = pickQuips();
    const total = document.querySelector('#right-side .final_grade, #right-side #final_grade');
    const grade = total?.textContent.match(/\b(\d+(?:\.\d+)?)\s*%/);
    if (grade && !coursework.value) coursework.value = grade[1];
    if (target.value) calculator.dispatchEvent(new Event('input'));
  };
  if (!applyRow) {
    disclosure.addEventListener('toggle', () => updateCalculator(toggle, disclosure.open));
    weights.after(disclosure);
    return;
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.id = toggle.id;
  button.className = 'Button';
  button.textContent = toggle.textContent;
  button.setAttribute('aria-expanded', 'false');
  calculator.id = 'refined-grade-calculator-panel';
  calculator.hidden = true;
  button.setAttribute('aria-controls', calculator.id);
  button.addEventListener('click', () => {
    const open = calculator.hidden;
    calculator.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    updateCalculator(button, open);
  });
  applyRow.classList.add('refined-grades-filter-row');
  applyRow.append(button);
  filterGroup.after(calculator);
}


