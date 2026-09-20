import { CARDS } from './cards.js';

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

export function buildGallery({
  viewport,
  dots,
  counter,
  label,
  variant = 'clean',
  onChange
}) {
  const cards = CARDS.slice();
  let index = 0;
  let ticking = false;

  const stack = document.createElement('div');
  stack.className = 'cc-stack';

  for (const [i, card] of cards.entries()) {
    const slide = document.createElement('section');
    slide.className = 'cc-slide';
    slide.dataset.index = String(i);

    const link = document.createElement('a');
    link.className = 'cc-card';
    link.href = card.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `Open CannaCardz #${card.id} ${card.title}`);

    const img = document.createElement('img');
    img.src = card.cover;
    img.alt = `CannaCardz #${card.id} ${card.title} cover`;
    img.loading = i < 2 ? 'eager' : 'lazy';
    img.decoding = 'async';
    img.draggable = false;

    link.appendChild(img);
    slide.appendChild(link);
    stack.appendChild(slide);
  }

  viewport.replaceChildren(stack);

  if (dots) {
    dots.replaceChildren(...cards.map((card, i) => {
      const btn = document.createElement('button');
      btn.className = 'cc-dot';
      btn.type = 'button';
      btn.setAttribute('aria-label', `Show ${card.title}`);
      btn.addEventListener('click', () => go(i));
      return btn;
    }));
  }

  function update(nextIndex) {
    index = clamp(nextIndex, 0, cards.length - 1);
    const card = cards[index];
    if (counter) counter.textContent = `${String(index + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
    if (label) label.textContent = `#${card.id} · ${card.title}`;
    if (dots) [...dots.children].forEach((dot, i) => dot.classList.toggle('is-active', i === index));
    viewport.dataset.index = String(index);
    onChange?.({ index, card });
  }

  function go(nextIndex, smooth = true) {
    const bounded = clamp(nextIndex, 0, cards.length - 1);
    viewport.scrollTo({
      top: bounded * viewport.clientHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
    update(bounded);
  }

  viewport.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const h = viewport.clientHeight || 1;
      update(Math.round(viewport.scrollTop / h));
      ticking = false;
    });
  }, { passive: true });

  viewport.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'PageDown') {
      event.preventDefault();
      go(index + 1);
    } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
      event.preventDefault();
      go(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      go(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      go(cards.length - 1);
    }
  });

  window.addEventListener('resize', () => go(index, false));

  update(0);
  return { cards, go, get index() { return index; }, variant };
}
