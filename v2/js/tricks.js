// Interface tricks: the scares that happen to the page itself, not the hallway.
// A window whose × runs from your cursor, a tab that talks while you're gone, a text field that types
// by itself, a timer that lies. Each is short, readable, and skippable in Gentle mode.

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * A retro system window: "Leave the party?". Both buttons say Stay. The × runs from your cursor
 * (it gets tired after a few tries). When you finally close it, it multiplies.
 * Resolves when every copy has gone.
 */
export function leaveDialog(host, { audio, gentle = false, title = 'NOCTURNE NIGHT', body = 'Are you sure you want to leave the party?' } = {}) {
  return new Promise((resolve) => {
    const layer = document.createElement('div');
    layer.className = 'trick-layer';
    host.appendChild(layer);
    const win = makeWindow(title, body, true);
    win.style.left = '50%';
    win.style.top = '46%';
    win.style.transform = 'translate(-50%, -50%)';
    layer.appendChild(win);
    const x = win.querySelector('.retro__x');
    x.focus();
    let dodges = 0;
    let stays = 0;
    const tired = gentle ? 0 : 5;
    x.addEventListener('pointerenter', () => {
      if (dodges >= tired) return;
      dodges += 1;
      const dx = (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 220);
      const dy = (Math.random() - 0.5) * 260;
      x.style.transform = `translate(${dx}px, ${dy}px) rotate(${(Math.random() - 0.5) * 40}deg)`;
      audio?.errorChime();
      if (dodges === tired) x.textContent = '×';
      else if (dodges === 3) x.textContent = 'no';
    });
    win.querySelectorAll('[data-stay]').forEach((b) => b.addEventListener('click', () => {
      stays += 1;
      audio?.errorChime();
      win.classList.remove('is-shaking');
      void win.offsetWidth;
      win.classList.add('is-shaking');
      win.querySelector('.retro__body p').textContent = ['Good. Stay.', 'We knew you would.', 'You can’t press the other one either.'][Math.min(2, stays - 1)];
    }));
    x.addEventListener('click', async () => {
      audio?.staticBurst(0.5, 0.35);
      win.remove();
      if (gentle) {
        layer.remove();
        resolve();
        return;
      }
      // It doesn't close. It multiplies.
      const lines = ['WHY ARE YOU LEAVING', 'STAY', 'THE PARTY ISN’T OVER', 'WE CAN SEE YOU', 'STAY', 'DON’T GO', 'IT’S BEHIND YOU', 'STAY'];
      for (let i = 0; i < 16; i += 1) {
        const copy = makeWindow('NOCTURNE NIGHT', lines[i % lines.length], false);
        copy.style.left = `${8 + ((i * 37) % 64) + Math.random() * 6}%`;
        copy.style.top = `${10 + ((i * 23) % 62) + Math.random() * 6}%`;
        copy.style.transform = `rotate(${(Math.random() - 0.5) * 6}deg)`;
        layer.appendChild(copy);
        audio?.errorChime();
        await wait(Math.max(40, 160 - i * 9));
      }
      await wait(700);
      layer.remove();
      resolve();
    });
  });
}

function makeWindow(title, text, interactive) {
  const win = document.createElement('div');
  win.className = 'retro';
  win.setAttribute('role', interactive ? 'alertdialog' : 'presentation');
  win.innerHTML = `
    <div class="retro__bar"><span></span><button type="button" class="retro__x" aria-label="Close">×</button></div>
    <div class="retro__body"><span class="retro__icon" aria-hidden="true">!</span><p></p></div>
    <div class="retro__actions"><button type="button" class="retro__ok" data-stay>Stay</button><button type="button" class="retro__ok" data-stay>Stay</button></div>`;
  win.querySelector('.retro__bar span').textContent = title;
  win.querySelector('.retro__body p').textContent = text;
  if (!interactive) win.querySelectorAll('button').forEach((b) => (b.tabIndex = -1));
  return win;
}

/** The tab talks while you're gone. onReturn() fires when you come back. */
export function watchTab({ onReturn, titles = ['(1) come back', 'it’s quiet without you', 'I’m in your room'] } = {}) {
  const original = document.title;
  let timers = [];
  const handler = () => {
    if (document.hidden) {
      timers = titles.map((t, i) => setTimeout(() => (document.title = t), 600 + i * 2600));
    } else {
      timers.forEach(clearTimeout);
      const was = document.title !== original;
      document.title = original;
      if (was) onReturn?.();
    }
  };
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}

/** A text field that types by itself, then erases it, as if someone else had the keyboard. */
export async function typeByItself(input, text, { audio, speed = 110 } = {}) {
  const saved = input.value;
  input.readOnly = true;
  for (const ch of text) {
    input.value += ch;
    audio?.clunk?.();
    await wait(speed + Math.random() * 80);
  }
  await wait(900);
  while (input.value.length > saved.length) {
    input.value = input.value.slice(0, -1);
    await wait(35);
  }
  input.readOnly = false;
  input.focus();
}

/** The timer lies for a moment. */
export function timerLie(el, text = 'BEHIND YOU', ms = 650) {
  el.dataset.lie = '1';
  el.textContent = text;
  setTimeout(() => delete el.dataset.lie, ms);
}
