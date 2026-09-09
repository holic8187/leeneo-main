import './toast.css';

let currentIncident = null;
let busy = false;
let resolved = false;
const title = document.querySelector('#incident-title');
const body = document.querySelector('#incident-body');
const toast = document.querySelector('#incident-toast');
const choices = document.querySelector('#incident-choices');
const status = document.querySelector('#toast-status');
const bridge = window.hoiDesktop;

function openGame() {
  if (currentIncident && !resolved) bridge?.openIncident?.({ id: currentIncident.id, instanceId: currentIncident.instanceId });
}

bridge?.onIncident((incident) => {
  currentIncident = incident;
  busy = false;
  resolved = false;
  title.textContent = incident?.title || '돌발 업무 도착';
  body.textContent = incident?.summary || '카드부에서 확인해 주세요.';
  document.querySelector('#incident-kind').textContent = incident?.mythic ? '✦ 신화 이벤트' : (incident?.special ? '✦ 특별 이벤트' : '돌발 업무');
  toast.classList.toggle('is-special', Boolean(incident?.special));
  toast.classList.toggle('is-mythic', Boolean(incident?.mythic));
  status.textContent = '게임을 열지 않고도 여기서 선택할 수 있어요.';
  choices.replaceChildren();
  for (const choice of incident?.choices || []) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'incident-toast__choice';
    button.textContent = choice.label;
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      if (busy || resolved) return;
      busy = true;
      status.textContent = '선택과 보상을 저장하고 있습니다…';
      for (const child of choices.children) child.disabled = true;
      try {
        const result = await bridge?.chooseIncident?.({ incidentId: currentIncident.id, instanceId: currentIncident.instanceId, choiceId: choice.id });
        resolved = result?.ok === true || result?.code === 'stale';
        status.textContent = result?.message || '처리하지 못했습니다. 게임을 열어 확인해 주세요.';
        toast.classList.toggle('is-resolved', result?.ok === true);
        if (resolved) window.setTimeout(() => bridge?.dismissToast?.(), 4500);
      } catch {
        status.textContent = '게임과 연결하지 못했습니다. 다시 선택하거나 게임을 열어 주세요.';
      } finally {
        busy = false;
        for (const child of choices.children) child.disabled = resolved;
      }
    });
    choices.append(button);
  }
});

document.querySelector('#toast-open').addEventListener('click', openGame);
// Empty space, the status text and event heading also bring the main game forward.
toast.addEventListener('click', (event) => { if (!event.target.closest('button')) openGame(); });
toast.addEventListener('keydown', (event) => {
  if (event.target === toast && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openGame(); }
  if (event.key === 'Escape') bridge?.dismissToast?.();
});
document.querySelector('#toast-dismiss').addEventListener('click', () => bridge?.dismissToast?.());
