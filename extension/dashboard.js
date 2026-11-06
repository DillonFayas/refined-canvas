(() => {
  if (!['/', '/dashboard'].includes(location.pathname)) return;
  const requests = new Map();
  const fields = {title: 'Title', subtitle: 'Subtitle', term: 'Term'};
  const shortcuts = {
    announcements: ['Announcements', 'announcement'],
    assignments: ['Assignments', 'assignment'],
    discussion_topics: ['Discussions', 'discussion'],
    modules: ['Modules', 'module'],
    grades: ['Grades', 'gradebook'],
    home: ['Home', 'home'],
    files: ['Files', 'folder']
  };
  let preferences = {};
  const preferenceKey = 'course-card-preferences:' + location.origin;
  const visibilityKey = 'hidden-course-cards:' + location.origin;
  let hiddenCards = [];

  function cardCourseId(card) {
    return card.querySelector('.ic-DashboardCard__link')?.pathname?.match(/\/courses\/(\d+)/)?.[1];
  }

  function manageCards() {
    const dialog = document.createElement('dialog');
    dialog.className = 'refined-card-dialog refined-card-visibility';
    dialog.setAttribute('aria-label', 'Manage course cards');
    dialog.innerHTML = '<form><h2>Manage course cards</h2><p>Choose which cards appear on your dashboard.</p><fieldset><legend>Visible courses</legend></fieldset><p role="status"></p><button type="button">Cancel</button> <button type="submit">Save</button></form>';
    const form = dialog.querySelector('form');
    const options = new Map();
    for (const card of document.querySelectorAll('.ic-DashboardCard')) {
      const id = cardCourseId(card);
      if (!id || options.has(id)) continue;
      const title = card.querySelector('.ic-DashboardCard__header-title.refined-card-text:not([hidden])') ||
        card.querySelector('.ic-DashboardCard__header-title');
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !hiddenCards.includes(id);
      label.append(input, title?.textContent.trim() || card.getAttribute('aria-label') || 'Course ' + id);
      form.querySelector('fieldset').append(label);
      options.set(id, input);
    }
    dialog.addEventListener('close', () => dialog.remove());
    form.querySelector('button[type="button"]').onclick = () => dialog.close();
    form.onsubmit = async event => {
      event.preventDefault();
      const save = form.querySelector('button[type="submit"]');
      save.disabled = true;
      const next = hiddenCards.filter(id => !options.has(id));
      for (const [id, input] of options) {
        if (!input.checked) next.push(id);
      }
      try {
        await chrome.storage.local.set({[visibilityKey]: next});
        hiddenCards = next;
        schedule();
        dialog.close();
      } catch {
        form.querySelector('[role="status"]').textContent = 'Could not save. Try again.';
        save.disabled = false;
      }
    };
    document.body.append(dialog);
    dialog.setAttribute('closedby', 'any');
    dialog.showModal();
  }

  function configureCard(card, courseId) {
    const config = preferences[courseId] || {};
    const order = config.links?.map(path => path === 'pages' ? 'home' : path);
    const controls = {};
    for (const field of Object.keys(fields)) {
      const original = card.querySelector('.ic-DashboardCard__header-' + field + ':not(.refined-card-text)');
      if (!original) continue;
      controls[field] = original;
      let replacement = original.nextElementSibling;
      if (!replacement?.classList.contains('refined-card-text')) {
        replacement = original.cloneNode(false);
        replacement.removeAttribute('id');
        replacement.removeAttribute('data-testid');
        replacement.classList.add('refined-card-text');
        original.after(replacement);
      }
      const value = config.fields?.[field];
      original.toggleAttribute('data-refined-card-replaced', value !== undefined);
      replacement.hidden = !value?.visible;
      if (value?.visible) {
        const label = value.text || original.textContent;
        if (replacement.textContent !== label) replacement.textContent = label;
        replacement.title = label;
      }
    }
    const actions = card.querySelector('.ic-DashboardCard__action-container');
    // Generated shortcuts share the row but must not count as Canvas links.
    const native = new Map(Array.from(actions?.querySelectorAll('a[href]:not(.refined-card-shortcuts a)') || [], link => [
      new URL(link.href).pathname.split('/').filter(Boolean).at(-1), link
    ]));
    let extra = card.querySelector('.refined-card-shortcuts');
    if (!extra) {
      extra = document.createElement('div');
      extra.className = 'refined-card-shortcuts';
      if (actions) actions.append(extra);
      else card.querySelector('.ic-DashboardCard__header').after(extra);
    }
    if (actions && extra.parentElement !== actions) actions.append(extra);
    for (const [path, link] of native) {
      link.toggleAttribute('data-refined-card-replaced', Boolean(order && (shortcuts[path] || path === 'pages') && !order.includes(path)));
      link.style.setProperty('--refined-shortcut-order', order?.includes(path) ? order.indexOf(path) : 99);
    }
    const missing = (order || []).filter(path => shortcuts[path] && !native.has(path));
    if (extra.dataset.links !== missing.join(',')) {
      extra.dataset.links = missing.join(',');
      extra.replaceChildren(...missing.map(path => {
        const [name, icon] = shortcuts[path];
        const link = document.createElement('a');
        link.href = '/courses/' + courseId + (path === 'home' ? '' : '/' + path);
        link.dataset.shortcut = path;
        link.title = name;
        link.setAttribute('aria-label', name);
        const glyph = document.createElement('i');
        glyph.className = 'icon-' + icon;
        glyph.setAttribute('aria-hidden', 'true');
        link.append(glyph);
        return link;
      }));
    }
    for (const link of extra.children) {
      link.style.setProperty('--refined-shortcut-order', order.indexOf(link.dataset.shortcut));
    }
    const header = card.querySelector('.ic-DashboardCard__header');
    const nativeButton = header.querySelector('.ic-DashboardCard__header-button');
    if (nativeButton?.offsetWidth) {
      const bounds = nativeButton.getBoundingClientRect();
      const headerBounds = header.getBoundingClientRect();
      header.style.setProperty('--refined-edit-width', nativeButton.offsetWidth + 'px');
      header.style.setProperty('--refined-edit-height', nativeButton.offsetHeight + 'px');
      header.style.setProperty('--refined-edit-top', bounds.top - headerBounds.top + 'px');
      header.style.setProperty('--refined-edit-right', headerBounds.right - bounds.left + 6 + 'px');
    }
    if (card.querySelector('.refined-card-edit')) return;
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'refined-card-edit';
    edit.setAttribute('aria-label', 'Edit course card');
    edit.title = 'Edit course card';
    const pencil = document.createElement('i');
    pencil.className = 'icon-edit';
    pencil.setAttribute('aria-hidden', 'true');
    edit.append(pencil);
    edit.addEventListener('click', () => {
      const current = preferences[courseId] || {};
      const dialog = document.createElement('dialog');
      dialog.className = 'refined-card-dialog';
      dialog.innerHTML = '<form><h2>Edit course card</h2><fieldset><legend>Card text</legend></fieldset><fieldset><legend>Quick links</legend></fieldset><p role="status"></p><button type="button">Cancel</button> <button type="submit">Save</button></form>';
      const form = dialog.querySelector('form');
      const [textFields, linkFields] = form.querySelectorAll('fieldset');
      const edits = {};
      for (const [key, element] of Object.entries(controls)) {
        const label = document.createElement('label');
        const visible = document.createElement('input');
        visible.type = 'checkbox';
        visible.checked = current.fields?.[key]?.visible ?? true;
        visible.setAttribute('aria-label', 'Show ' + fields[key]);
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = element.textContent.trim();
        input.value = current.fields?.[key]?.text || '';
        input.setAttribute('aria-label', fields[key]);
        label.append(visible, fields[key], input);
        textFields.append(label);
        edits[key] = {visible, input};
      }
      const selected = new Map();
      const savedOrder = current.links?.map(path => path === 'pages' ? 'home' : path);
      for (const path of new Set([...(savedOrder || []), ...Object.keys(shortcuts)])) {
        if (!shortcuts[path]) continue;
        const [name] = shortcuts[path];
        const row = document.createElement('div');
        row.className = 'refined-shortcut-option';
        row.dataset.shortcut = path;
        const label = document.createElement('label');
        const check = document.createElement('input');
        check.type = 'checkbox';
        check.checked = savedOrder?.includes(path) ??
          Boolean(card.querySelector('.ic-DashboardCard__action-container a[href$="/' + path + '"]:not(.refined-card-shortcuts a)'));
        label.append(check, name);
        row.append(label);
        for (const direction of ['up', 'down']) {
          const move = document.createElement('button');
          move.type = 'button';
          move.textContent = direction === 'up' ? '↑' : '↓';
          move.setAttribute('aria-label', 'Move ' + name + ' ' + direction);
          move.onclick = () => {
            const sibling = direction === 'up' ? row.previousElementSibling : row.nextElementSibling;
            if (!sibling?.matches('.refined-shortcut-option')) return;
            if (direction === 'up') sibling.before(row);
            else sibling.after(row);
            move.focus();
          };
          row.append(move);
        }
        linkFields.append(row);
        selected.set(path, check);
      }
      dialog.setAttribute('aria-label', 'Edit course card');
      dialog.addEventListener('close', () => dialog.remove());
      form.querySelector(':scope > button[type="button"]').onclick = () => dialog.close();
      form.onsubmit = async event => {
        event.preventDefault();
        const save = form.querySelector('[type="submit"]');
        save.disabled = true;
        const next = {...preferences, [courseId]: {
          fields: Object.fromEntries(Object.entries(edits).map(([key, {visible, input}]) =>
            [key, {visible: visible.checked, text: input.value.trim()}])),
          links: [...linkFields.querySelectorAll('[data-shortcut]')].map(row => row.dataset.shortcut)
            .filter(path => selected.get(path).checked)
        }};
        try {
          await chrome.storage.local.set({[preferenceKey]: next});
          preferences = next;
          configureCard(card, courseId);
          dialog.close();
        } catch {
          form.querySelector('[role="status"]').textContent = 'Could not save. Try again.';
          save.disabled = false;
        }
      };
      document.body.append(dialog);
      dialog.setAttribute('closedby', 'any');
      dialog.showModal();
    });
    header.append(edit);
  }
  const {assignments, relativeDue} = refinedAssignmentData;

  function updateCards() {
    for (const tabs of document.querySelectorAll('[class*="contextView__content"] [data-cid="Tabs"]')) {
      const labels = [...tabs.querySelectorAll('[role="tab"]')].map(tab => tab.textContent.trim());
      if (labels.includes('Color') && labels.includes('Move')) {
        tabs.closest('[class*="contextView__content"]').setAttribute('data-refined-course-menu', '');
      }
    }
    for (const button of document.querySelectorAll('.ic-Dashboard-header button')) {
      button.toggleAttribute('data-refined-dashboard-switch', button.textContent.trim() === 'Switch to new dashboard view');
    }
    const switchButton = document.querySelector('.ic-Dashboard-header [data-refined-dashboard-switch]');
    const header = document.querySelector('.ic-Dashboard-header');
    if (header && !header.querySelector('.refined-manage-cards')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'refined-manage-cards';
      button.textContent = 'Manage course cards';
      button.setAttribute('aria-haspopup', 'dialog');
      button.onclick = manageCards;
      if (switchButton) switchButton.after(button);
      else (header.querySelector('.ic-Dashboard-header__layout') || header).append(button);
    }
    const manageButton = header?.querySelector('.refined-manage-cards');
    if (manageButton) manageButton.hidden = !document.querySelector('.ic-DashboardCard .ic-DashboardCard__link');
    // Canvas may portal the menu outside the dashboard header.
    const menuTriggers = document.querySelectorAll('.ic-Dashboard-header [aria-expanded="true"], .ic-DashboardCard__header-button[aria-expanded="true"]');
    for (const trigger of menuTriggers) {
      if (trigger.id) {
        document.querySelectorAll('[role="menu"][aria-labelledby~="' + CSS.escape(trigger.id) + '"]').forEach(menu => {
          menu.setAttribute('data-refined-dashboard-menu', '');
        });
      }
      const id = trigger.getAttribute('aria-controls') || trigger.closest('[data-position-target]')?.getAttribute('data-position-target');
      if (id) {
        const position = CSS.escape(id);
        document.querySelectorAll('#' + position + ', [data-position="' + position + '"], [aria-labelledby~="' + position + '"]').forEach(popup => {
          if (popup.contains(trigger)) return;
          const surface = popup.closest('[data-cid~="Popover"], [data-cid~="Tray"], [role="dialog"]') || popup;
          surface.setAttribute('data-refined-dashboard-menu', '');
        });
      }
    }
    for (const item of document.querySelectorAll('.ToDoSidebarItem')) {
      const courseId = item.querySelector('a[href*="/courses/"]')?.getAttribute('href')?.match(/\/courses\/(\d+)/)?.[1];
      if (!courseId) continue;
      const card = [...document.querySelectorAll('.ic-DashboardCard')].find(card =>
        card.querySelector('a[href="/courses/' + courseId + '"]'));
      const hero = card?.querySelector('.ic-DashboardCard__header_hero');
      if (hero) item.style.setProperty('--refined-course-color', getComputedStyle(hero).backgroundColor);
    }
    if (!document.documentElement.hasAttribute('data-refined-canvas-formatting')) return;
    for (const card of document.querySelectorAll('.ic-DashboardCard')) {
      const courseId = cardCourseId(card);
      if (!courseId) continue;
      card.toggleAttribute('data-refined-card-hidden', hiddenCards.includes(courseId));
      configureCard(card, courseId);
      if (card.querySelector('.refined-course-due, .bettercanvas-card-assignments')) continue;
      const section = document.createElement('section');
      section.className = 'refined-course-due';
      const heading = document.createElement('h3');
      heading.textContent = 'Due';
      const list = document.createElement('ul');
      const status = document.createElement('p');
      status.textContent = 'Loading assignments…';
      section.append(heading, list, status);
      card.append(section);
      if (!requests.has(courseId)) requests.set(courseId, assignments(courseId));
      requests.get(courseId).then(items => {
        status.textContent = items.length ? '' : 'No upcoming assignments';
        status.hidden = items.length > 0;
        for (const item of items) {
          const row = document.createElement('li');
          const anchor = document.createElement('a');
          const url = new URL(item.html_url, location.origin);
          if (url.origin !== location.origin) continue;
          anchor.href = url.href;
          anchor.textContent = item.name;
          anchor.title = item.name;
          const time = document.createElement('time');
          time.dateTime = item.due_at;
          time.title = new Date(item.due_at).toLocaleString();
          time.textContent = relativeDue(Date.parse(item.due_at));
          row.append(anchor, time);
          list.append(row);
        }
      }).catch(() => { status.textContent = 'Assignments unavailable. Open the course to view due dates.'; });
    }
  }
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; updateCards(); });
  };
  new MutationObserver(schedule).observe(document.documentElement, {childList: true, subtree: true, attributes: true, attributeFilter: ['data-refined-canvas-formatting', 'aria-expanded']});
  setInterval(() => {
    document.querySelectorAll('.refined-course-due time').forEach(time => {
      time.textContent = relativeDue(Date.parse(time.dateTime));
    });
  }, 60000);
  schedule();
  chrome.storage.local.get({[preferenceKey]: {}, [visibilityKey]: []}).then(result => {
    preferences = result[preferenceKey];
    hiddenCards = result[visibilityKey];
    schedule();
  }).catch(() => {});
})();
