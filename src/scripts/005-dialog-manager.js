const DialogManager = (() => {
  const stack = [];
  const openers = new WeakMap();
  const auxiliarySurfaces = new Map();
  const protectedIds = new Set(['welcomeSecurityModal', 'pageLockOverlay', 'saveConflictModal']);
  const DIALOG_Z_BASE = 70000;
  const DIALOG_Z_STEP = 20;
  const AUXILIARY_Z_GAP = 10;
  let installed = false;
  let auxiliarySequence = 0;

  function visibleDialogs() {
    return Array.from(document.querySelectorAll('.modal-backdrop.show'));
  }

  function focusable(dialog) {
    return Array.from(dialog.querySelectorAll('button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'))
      .filter(node => !node.hidden && node.offsetParent !== null);
  }

  function closeTransientSurfaces() {
    document.querySelectorAll('.context-menu.show, .v4-popover.show, .mobile-action-drawer.show')
      .forEach(node => node.classList.remove('show'));
  }

  function clearStackState(dialog) {
    dialog.classList.remove('dialog-stack-managed', 'dialog-stack-top');
    dialog.style.removeProperty('--dialog-stack-z');
    delete dialog.dataset.dialogStackIndex;
    delete dialog.dataset.dialogStackZ;
    if (!dialog.classList.contains('show')) dialog.setAttribute('aria-hidden', 'true');
  }

  function activeAuxiliarySurfaces() {
    return [...auxiliarySurfaces.values()]
      .filter(record => record.active && record.element.isConnected)
      .sort((left, right) => left.anchorDepth - right.anchorDepth || left.order - right.order);
  }

  function normalizedAnchor(record) {
    return Math.max(0, Math.min(stack.length, Number(record.anchorDepth) || 0));
  }

  function auxiliaryIsCovered(record) {
    return record.hideWhenCovered && stack.length > normalizedAnchor(record);
  }

  function topInteractiveAuxiliary() {
    return activeAuxiliarySurfaces()
      .filter(record => !auxiliaryIsCovered(record))
      .sort((left, right) => Number(left.element.dataset.auxiliaryStackZ || 0) - Number(right.element.dataset.auxiliaryStackZ || 0))
      .at(-1) || null;
  }

  function applyStackLayers() {
    const auxiliaries = activeAuxiliarySurfaces();
    const topIndex = stack.length - 1;

    stack.forEach((dialog, index) => {
      const insertedSurfaces = auxiliaries.filter(record => normalizedAnchor(record) <= index).length;
      const zIndex = DIALOG_Z_BASE + ((index + insertedSurfaces) * DIALOG_Z_STEP);
      dialog.classList.add('dialog-stack-managed');
      dialog.classList.toggle('dialog-stack-top', index === topIndex);
      dialog.style.setProperty('--dialog-stack-z', String(zIndex));
      dialog.dataset.dialogStackIndex = String(index);
      dialog.dataset.dialogStackZ = String(zIndex);
      if (index === topIndex) dialog.removeAttribute('aria-hidden');
      else dialog.setAttribute('aria-hidden', 'true');
    });

    document.querySelectorAll('.modal-backdrop:not(.show).dialog-stack-managed').forEach(clearStackState);

    auxiliaries.forEach((record, index) => {
      const anchor = normalizedAnchor(record);
      const earlierAtOrBefore = auxiliaries.slice(0, index)
        .filter(other => normalizedAnchor(other) <= anchor).length;
      const zIndex = DIALOG_Z_BASE + (anchor * DIALOG_Z_STEP) - AUXILIARY_Z_GAP + (earlierAtOrBefore * 4);
      const covered = auxiliaryIsCovered(record);
      record.element.style.setProperty('--auxiliary-stack-z', String(zIndex));
      record.element.dataset.auxiliaryStackAnchor = String(anchor);
      record.element.dataset.auxiliaryStackZ = String(zIndex);
      record.element.classList.toggle('dialog-auxiliary-covered', covered);
      record.element.toggleAttribute('inert', covered);
    });
  }

  function syncInert(top) {
    const interactiveAuxiliaries = new Set(
      activeAuxiliarySurfaces()
        .filter(record => !auxiliaryIsCovered(record))
        .map(record => record.element)
    );

    Array.from(document.body.children).forEach(child => {
      const shouldRemainInteractive = !top
        || child === top
        || interactiveAuxiliaries.has(child)
        || child.classList?.contains('page-lock-overlay');
      child.toggleAttribute('inert', !shouldRemainInteractive);
    });
  }

  function focusAuxiliary(record) {
    if (!record) return false;
    const target = typeof record.focusTarget === 'function' ? record.focusTarget() : record.focusTarget;
    if (!(target instanceof HTMLElement) || !target.isConnected) return false;
    target.focus({ preventScroll: true });
    return true;
  }

  function synchronize() {
    const visible = visibleDialogs();
    const previousTop = stack[stack.length - 1] || null;
    let newlyOpenedTop = null;

    visible.forEach(dialog => {
      if (stack.includes(dialog)) return;
      stack.push(dialog);
      newlyOpenedTop = dialog;
      openers.set(dialog, document.activeElement instanceof HTMLElement ? document.activeElement : null);
      dialog.setAttribute('aria-modal', 'true');
      if (!dialog.getAttribute('role')) dialog.setAttribute('role', 'dialog');
    });

    const closed = [];
    for (let index = stack.length - 1; index >= 0; index -= 1) {
      if (visible.includes(stack[index])) continue;
      closed.push(stack[index]);
      clearStackState(stack[index]);
      stack.splice(index, 1);
    }

    if (newlyOpenedTop) closeTransientSurfaces();
    applyStackLayers();
    const top = stack[stack.length - 1] || null;
    syncInert(top);

    if (newlyOpenedTop && newlyOpenedTop === top) {
      const first = focusable(top)[0];
      setTimeout(() => first?.focus?.(), 0);
      return;
    }

    if (previousTop && previousTop !== top && closed.includes(previousTop)) {
      const exposedAuxiliary = topInteractiveAuxiliary();
      const opener = openers.get(previousTop);
      setTimeout(() => {
        if (focusAuxiliary(exposedAuxiliary)) return;
        if (top) {
          const target = opener?.isConnected && top.contains(opener) ? opener : focusable(top)[0];
          target?.focus?.();
        } else if (opener?.isConnected) {
          opener.focus?.();
        }
      }, 0);
    }
  }

  function closeDialog(dialog) {
    if (!dialog || protectedIds.has(dialog.id)) return false;
    const closeButton = dialog.querySelector('[id^="close"], [data-dialog-close], .panel-header button');
    if (closeButton) closeButton.click();
    else dialog.classList.remove('show');
    synchronize();
    return true;
  }

  function registerAuxiliarySurface(element, options = {}) {
    if (!(element instanceof HTMLElement)) return null;
    let record = auxiliarySurfaces.get(element);
    if (!record) {
      record = {
        element,
        order: auxiliarySequence += 1,
        anchorDepth: stack.length,
        active: true,
        hideWhenCovered: true,
        focusTarget: null
      };
      auxiliarySurfaces.set(element, record);
      element.classList.add('dialog-auxiliary-surface');
    }

    const update = nextOptions => {
      const next = nextOptions || {};
      if (Number.isFinite(next.anchorDepth)) record.anchorDepth = Number(next.anchorDepth);
      if (typeof next.active === 'boolean') record.active = next.active;
      if (typeof next.hideWhenCovered === 'boolean') record.hideWhenCovered = next.hideWhenCovered;
      if ('focusTarget' in next) record.focusTarget = next.focusTarget;
      applyStackLayers();
      syncInert(stack[stack.length - 1] || null);
    };

    update({
      anchorDepth: Number.isFinite(options.anchorDepth) ? options.anchorDepth : stack.length,
      active: options.active !== false,
      hideWhenCovered: options.hideWhenCovered !== false,
      focusTarget: options.focusTarget || null
    });

    return Object.freeze({
      update,
      unregister: () => {
        element.classList.remove('dialog-auxiliary-surface', 'dialog-auxiliary-covered');
        element.style.removeProperty('--auxiliary-stack-z');
        element.removeAttribute('inert');
        delete element.dataset.auxiliaryStackAnchor;
        delete element.dataset.auxiliaryStackZ;
        auxiliarySurfaces.delete(element);
        applyStackLayers();
        syncInert(stack[stack.length - 1] || null);
      }
    });
  }

  function onKeydown(event) {
    if (topInteractiveAuxiliary()) return;
    const top = stack[stack.length - 1];
    if (!top) return;
    if (event.key === 'Escape') {
      if (protectedIds.has(top.id) || top.getAttribute('role') === 'alertdialog') return;
      event.preventDefault();
      closeDialog(top);
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusable(top);
    if (!items.length) {
      event.preventDefault();
      top.focus?.();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function install() {
    if (installed) return;
    installed = true;
    document.body.dataset.dialogManager = 'installed';
    document.addEventListener('keydown', onKeydown, true);
    document.addEventListener('click', event => {
      const backdrop = event.target instanceof Element ? event.target.closest('.modal-backdrop.show') : null;
      if (!backdrop || event.target !== backdrop || backdrop !== stack[stack.length - 1]) return;
      if (protectedIds.has(backdrop.id) || backdrop.getAttribute('role') === 'alertdialog') return;
      closeDialog(backdrop);
    }, true);
    const observer = new MutationObserver(records => {
      const visibilityChanged = records.some(record => {
        const target = record.target;
        if (!(target instanceof Element) || !target.classList.contains('modal-backdrop')) return false;
        const oldClasses = new Set(String(record.oldValue || '').split(/\s+/).filter(Boolean));
        return oldClasses.has('show') !== target.classList.contains('show');
      });
      if (visibilityChanged) synchronize();
    });
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
      attributeOldValue: true
    });
    synchronize();
  }

  return Object.freeze({
    install,
    synchronize,
    closeDialog,
    registerAuxiliarySurface,
    top: () => stack[stack.length - 1] || null,
    stack: () => [...stack],
    topAuxiliary: () => topInteractiveAuxiliary()?.element || null
  });
})();

