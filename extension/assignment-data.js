const refinedAssignmentData = (() => {
  function relativeDue(date) {
    const hours = (date - Date.now()) / 3600000;
    if (hours < 0) {
      const days = Math.floor(-hours / 24);
      return days === 0 ? 'overdue' : days === 1 ? 'yesterday' : days + 'd ago';
    }
    if (hours < 1) return Math.max(1, Math.ceil(hours * 60)) + 'min';
    if (hours < 24) return Math.floor(hours) + 'hrs';
    const days = Math.floor(hours / 24);
    return days >= 7 ? Math.floor(days / 7) + 'wk' : days + 'd';
  }

  async function assignments(courseId) {
    let url = '/api/v1/courses/' + courseId + '/assignments?include[]=submission&order_by=due_at&per_page=100';
    const result = [];
    while (url) {
      const response = await fetch(url, {credentials: 'same-origin'});
      if (!response.ok) throw new Error('Assignments unavailable');
      result.push(...await response.json());
      const next = response.headers.get('Link')?.match(/<([^>]+)>;\s*rel="next"/)?.[1];
      url = next && new URL(next, location.origin).origin === location.origin ? next : null;
    }
    return result.filter(item => item.due_at && Date.parse(item.due_at) >= Date.now() - 86400000 && !['submitted', 'graded'].includes(item.submission?.workflow_state))
      .sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at));
  }

  return {assignments, relativeDue};
})();
