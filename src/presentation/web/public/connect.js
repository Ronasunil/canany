(() => {
  const copyButton = document.querySelector('[data-copy-target]');
  const status = document.querySelector('.connect-copy-status');

  if (!copyButton) return;

  const target = document.getElementById(copyButton.dataset.copyTarget);
  if (!target) return;

  async function copyText(value) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const field = document.createElement('textarea');
    field.value = value;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    document.execCommand('copy');
    field.remove();
  }

  copyButton.addEventListener('click', async () => {
    try {
      await copyText(target.textContent.trim());
      copyButton.classList.add('is-copied');
      copyButton.setAttribute('aria-label', 'Connect command copied');
      if (status) status.textContent = 'Connect command copied.';
      window.setTimeout(() => {
        copyButton.classList.remove('is-copied');
        copyButton.setAttribute('aria-label', 'Copy connect command');
      }, 1600);
    } catch {
      if (status) status.textContent = 'Could not copy the connect command.';
    }
  });
})();
