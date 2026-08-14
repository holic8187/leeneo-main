'use strict';

(function bindLoginBootstrap() {
  const form = document.getElementById('loginForm');
  const status = document.getElementById('loginStatus');
  if (!form || form.dataset.loginBootstrapBound === 'true') return;

  form.dataset.loginBootstrapBound = 'true';
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (form.dataset.loginPending === 'true') return;

    const submitButton = form.querySelector('button[type="submit"]');
    const username = document.getElementById('username')?.value.trim() || '';
    const password = document.getElementById('password')?.value || '';
    form.dataset.loginPending = 'true';
    if (submitButton) submitButton.disabled = true;
    if (status) status.textContent = '계정을 확인하는 중입니다.';

    try {
      const response = await fetch('/api/v2/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.msg || data.error || '로그인에 실패했습니다.');

      localStorage.setItem('v2Token', String(data.token || ''));
      localStorage.setItem('v2IsAdmin', String(Boolean(data.isAdmin)));
      localStorage.setItem('v2DisplayName', String(data.displayName || username));
      window.location.reload();
    } catch (error) {
      if (status) status.textContent = error.message || '로그인에 실패했습니다.';
      form.dataset.loginPending = 'false';
      if (submitButton) submitButton.disabled = false;
    }
  });
})();
