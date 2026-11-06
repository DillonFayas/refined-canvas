(async () => {
  const courseId = location.pathname.match(/^\/courses\/(\d+)\/?$/)?.[1];
  if (!courseId && !['/', '/dashboard'].includes(location.pathname)) return;
  const {assignments, relativeDue} = refinedAssignmentData;
  const section = document.createElement('section');
  section.className = 'refined-grouped-todo';
  const heading = document.createElement('h2');
  heading.textContent = 'To-Do List';
  const loading = document.createElement('div');
  loading.setAttribute('role', 'status');
  loading.className = 'refined-todo-loading';
  loading.setAttribute('aria-label', 'Loading assignments');
  section.append(heading, loading);
  let signature = '';
  let saving = false;
  const storageKey = 'completed-todo:' + location.origin;
  let completed;
  let loadingSince;
  let courseEntries;
  let requestedCourse = false;
  function refresh() {
    if (saving) return;
    const host = document.querySelector('.Sidebar__TodoListContainer') ||
      (courseId && document.querySelector('#right-side [data-testid="ToDoSidebar"]'));
    const cards = [...document.querySelectorAll('.ic-DashboardCard')];
    if (!host || (!courseId && (!cards.length || document.querySelector('.bettercanvas-card-assignments'))) ||
        !document.documentElement.hasAttribute('data-refined-canvas-formatting')) {
      section.remove();
      signature = '';
      loadingSince = undefined;
      return;
    }
    if (courseId && !requestedCourse) {
      requestedCourse = true;
      assignments(courseId).then(items => {
        courseEntries = items.flatMap(item => {
          const url = new URL(item.html_url, location.origin);
          if (url.origin !== location.origin) return [];
          return [{title: item.name, href: url.href, date: item.due_at}];
        });
      }).catch(() => {
        courseEntries = [];
      }).finally(scheduleRefresh);
    }
    const waiting = completed === undefined || (courseId ? courseEntries === undefined : cards.some(card => {
      const due = card.querySelector('.refined-course-due');
      return !due || due.querySelector('p')?.textContent.startsWith('Loading');
    }));
    if (waiting) {
      loadingSince ??= Date.now();
      if (!signature && Date.now() - loadingSince < 8000 && section.previousElementSibling !== host) {
        section.replaceChildren(heading, loading);
        host.after(section);
      } else if (!signature && Date.now() - loadingSince >= 8000) {
        section.remove();
      }
      return;
    }
    loadingSince = undefined;
    const entries = courseId ? courseEntries.map(item => ({
      ...item, relative: relativeDue(Date.parse(item.date))
    })) : cards.flatMap(card => [...card.querySelectorAll('.refined-course-due li')].map(row => ({
      title: row.querySelector('a')?.textContent,
      href: row.querySelector('a')?.href,
      date: row.querySelector('time')?.dateTime,
      relative: row.querySelector('time')?.textContent,
      course: card.querySelector('.ic-DashboardCard__header-subtitle')?.textContent,
      color: card.querySelector('.ic-DashboardCard__header_hero')?.style.backgroundColor
    }))).filter(item => item.date);
    const next = JSON.stringify([entries, completed]);
    if (next === signature && (!entries.length || section.previousElementSibling === host)) return;
    signature = next;
    const openGroups = new Map([...section.querySelectorAll('details')].map(group => [group.dataset.label, group.open]));
    section.replaceChildren(heading);
    const groups = new Map();
    const day = date => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
    entries.sort((a,b) => Date.parse(a.date) - Date.parse(b.date));
    for (const item of entries) {
      const days = day(new Date(item.date)) - day(new Date());
      const isComplete = completed.includes(item.href);
      const label = isComplete ? 'Completed' : days < 0 ? 'Overdue' : days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : days <= 3 ? 'Due in ' + days + ' days' : 'Due later';
      if (!groups.has(label)) {
        const group = document.createElement('details');
        group.dataset.label = label;
        group.open = openGroups.get(label) ?? (label !== 'Completed');
        const summary = document.createElement('summary');
        summary.textContent = label;
        group.append(summary);
        groups.set(label, group);
        section.append(group);
      }
      const article = document.createElement('div');
      article.className = 'refined-todo-card';
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.className = 'refined-todo-check';
      check.checked = isComplete;
      check.setAttribute('aria-label', 'Mark ' + item.title + (isComplete ? ' incomplete' : ' complete'));
      check.addEventListener('change', async () => {
        if (saving) { check.checked = isComplete; return; }
        saving = true;
        check.disabled = true;
        const updated = check.checked ? [...completed, item.href] : completed.filter(href => href !== item.href);
        try {
          await chrome.storage.local.set({[storageKey]: updated});
          completed = updated;
          if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
            await article.animate([{opacity: 1}, {opacity: 0, transform: 'translateX(5px)'}], {
              duration: 150, easing: 'ease-in', fill: 'forwards'
            }).finished.catch(() => {});
          }
        } catch {
          check.checked = isComplete;
          check.disabled = false;
          check.title = 'Could not save. Try again.';
        } finally {
          saving = false;
          refresh();
        }
      });
      article.style.setProperty('--course-color', item.color || '#537eae');
      const course = document.createElement('small');
      course.textContent = item.course || '';
      const link = document.createElement('a');
      link.href = item.href;
      link.textContent = item.title;
      const due = document.createElement('time');
      due.dateTime = item.date;
      due.textContent = 'Due ' + item.relative;
      due.title = new Date(item.date).toLocaleString();
      article.append(check);
      if (item.course) article.append(course);
      article.append(link, due);
      groups.get(label).append(article);
    }
    if (groups.has('Completed')) section.append(groups.get('Completed'));
    if (!entries.length) {
      section.remove();
      return;
    }
    host.after(section);
  }
  let frame;
  const scheduleRefresh = () => {
    frame ??= requestAnimationFrame(() => {
      frame = undefined;
      refresh();
    });
  };
  new MutationObserver(scheduleRefresh).observe(document.documentElement, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['data-refined-canvas-formatting']
  });
  setInterval(refresh, 1500);
  chrome.storage.local.get({[storageKey]: []}).then(result => {
    completed = result[storageKey];
    scheduleRefresh();
  }).catch(() => {
    completed = [];
    scheduleRefresh();
  });
  refresh();
})();
