(() => {
  const canvasOrigin = 'https://msoe.instructure.com';
  if (location.ancestorOrigins[0] !== canvasOrigin) return;

  const layout = document.createElement('style');
  let settings = {formatting: true, dark: true};
  let lastHeight = 0;
  function update() {
    const customReader = settings.formatting && document.documentElement.hasAttribute('data-msoe-custom-tools');
    const nativeToolbar = settings.formatting && !customReader ? '.ViewerControls{min-height:60px!important;flex-shrink:0!important;overflow-x:auto!important;overflow-y:hidden!important;align-items:center!important;padding-block:4px!important;scrollbar-width:thin}' : '';
    const css = nativeToolbar + (customReader ? 'html,body,#App{height:auto!important;min-height:0!important;overflow:clip!important}#App{display:block!important}.Pages{height:auto!important;min-height:0!important;max-height:none!important;flex:none!important;overflow-x:auto!important;overflow-y:clip!important}html[data-msoe-custom-tools] .ViewerControls{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip-path:inset(50%);visibility:hidden}html[data-msoe-custom-tools] .Pages{padding-block-start:0!important;margin-block-start:0!important}html[data-msoe-custom-tools] .Page-container:first-child{margin-block-start:0!important}html[data-msoe-custom-tools] #App:has(.Pages){padding-block-start:0!important}html[data-msoe-custom-tools] .ViewerControls{display:none!important}' : '') +
      (settings.dark ? 'html,body,#App,.Pages{background:#151922!important;scrollbar-color:#63748d #151922}.ViewerControls{background:#202632!important;color:#edf1f7!important;border-bottom:1px solid #465369;padding:4px 8px;box-sizing:border-box;scrollbar-color:#63748d #202632}.AnnotationControlButton,.AnnotationControlButton-outer,.AnnotationControlButton-inner{background:transparent!important;color:#edf1f7!important;border-radius:7px!important;box-shadow:none!important}.AnnotationControlButton{margin:0 2px!important;min-width:32px;min-height:32px;transition:background-color 140ms ease}.AnnotationControlButton svg{color:inherit}.AnnotationControlButton:focus-visible{outline:2px solid #9bc9ff;outline-offset:1px}.AnnotationControlButton:hover:not(:disabled){background:#354156!important}.AnnotationControlButton:disabled{opacity:.4}.ViewerControls input{background:#151922!important;color:#edf1f7!important;border:1px solid #465369!important;border-radius:6px!important}.ViewerControls button:focus-visible{outline:2px solid #9bc9ff;outline-offset:2px}@media(prefers-reduced-motion:reduce){.AnnotationControlButton{transition:none}}' : '');
    const downloadStyle = settings.formatting && !customReader ? `
      .ViewerControls :is(a[href], button):is(
        [download], [aria-label*="download" i], [title*="download" i],
        [class*="download" i], [href*="download" i], :has(svg:is([aria-label*="download" i], [name*="download" i]))
      ) {
        display: inline-flex !important;
        flex: 0 0 auto;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        width: 48px;
        height: 48px;
        margin-inline: 2px;
        padding: 0;
        border: 1px solid ${settings.dark ? '#465369' : '#c7cdd1'} !important;
        border-radius: 8px;
        background: transparent !important;
        color: inherit !important;
      }
      .ViewerControls :is(a[href], button):is([download], [aria-label*="download" i],
        [title*="download" i], [class*="download" i], [href*="download" i],
        :has(svg:is([aria-label*="download" i], [name*="download" i]))):hover {
        background: ${settings.dark ? '#354156' : '#edf2f7'} !important;
      }
      .ViewerControls a:focus-visible {
        outline: 2px solid ${settings.dark ? '#9bc9ff' : '#245784'};
        outline-offset: -3px;
      }
    ` : '';
    const viewerStyle = css + downloadStyle;
    if (layout.textContent !== viewerStyle) layout.textContent = viewerStyle;
    if (!layout.isConnected) document.documentElement.append(layout);
    if (!settings.formatting || window.parent === window) return;
    const pages = [...document.querySelectorAll('.Page-container')];
    if (!pages.length) return;
    // Measure document pages, never the viewport-sized flex container.
    const bottom = Math.max(...pages.map(page => page.getBoundingClientRect().bottom + window.scrollY));
    const height = Math.ceil(bottom + 48);
    if (height === lastHeight) return;
    lastHeight = height;
    window.parent.postMessage({type:'msoe-document-height',height}, 'https://msoe.instructure.com');
  }
  chrome.storage.local.get(settings).then(value => { settings = value; update(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const key of ['dark','formatting']) if (changes[key]) settings[key] = changes[key].newValue !== false;
    lastHeight = 0;
    update();
  });


   

  const pdfPages = () => [...document.querySelectorAll('.Page-container')];
  let initialPageWidth;
  let lastReaderState;
  function reportReaderState() {
    if (!settings.formatting || window.parent === window) return;
    const bounds = pdfPages().map(page => page.getBoundingClientRect());
    if (!bounds.length) return;
    if (!initialPageWidth && bounds[0].width > 0) initialPageWidth = bounds[0].width;
    const state = {
      type: 'msoe-pdf-state',
      count: bounds.length,
      zoom: initialPageWidth ? Math.round(100 * bounds[0].width / initialPageWidth) : null,
      tops: bounds.map(rect => rect.top + window.scrollY)
    };
    const signature = JSON.stringify(state);
    if (signature === lastReaderState) return;
    lastReaderState = signature;
    window.parent.postMessage(state, canvasOrigin);
  }
  let observedPage;
  const pageResize = new ResizeObserver(() => { update(); reportReaderState(); });
  function refreshReaderState() {
    const firstPage = document.querySelector('.Page-container');
    if (firstPage !== observedPage) {
      pageResize.disconnect();
      observedPage = firstPage;
      if (firstPage) pageResize.observe(firstPage);
    }
    reportReaderState();
  }
  refreshReaderState();
  setInterval(() => { if (!document.hidden) { update(); refreshReaderState(); } }, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { update(); refreshReaderState(); } });
  window.addEventListener('message', event => {
    if (!settings.formatting || event.origin !== canvasOrigin || event.source !== window.parent ||
        event.data?.type !== 'msoe-pdf-action') return;
    const {action,page} = event.data;
    if (action === 'ready' && !document.documentElement.hasAttribute('data-msoe-custom-tools')) {
      document.documentElement.setAttribute('data-msoe-custom-tools', '');
      update();
      reportReaderState();
    }
    if (action === 'page' && Number.isInteger(page)) {
      const target = pdfPages()[page - 1];
      if (target) window.parent.postMessage({type:'msoe-pdf-jump',top:target.getBoundingClientRect().top + window.scrollY},canvasOrigin);
    } else if (action === 'in' || action === 'out') {
      const name = action === 'in' ? 'Zoom In' : 'Zoom Out';
      document.querySelector('.ViewerControls [aria-label="' + name + '"]')?.click();
    }
  });
})();
