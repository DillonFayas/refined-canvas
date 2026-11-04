async function setup() {
  const settings = await chrome.storage.local.get({ dark: true, formatting: true });
  for (const [key, value] of Object.entries(settings)) {
    const input = document.getElementById(key);
    input.checked = value;
    input.disabled = false;
    input.addEventListener('change', async () => {
      const checked = input.checked;
      try {
        await chrome.storage.local.set({ [key]: checked });
      } catch {
        input.checked = !checked;
        document.getElementById('status').textContent = 'Could not save the setting.';
      }
    });
  }
}
setup().catch(() => {
  document.getElementById('status').textContent = 'Could not load settings.';
});
