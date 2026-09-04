window.InteroperabilityUiBridgeV69 = (() => {
  'use strict';

  let installed = false;

  function openFromEvent(event) {
    const target = event.target instanceof Element ? event.target.closest('#openInteroperabilityV69Btn,#openInteroperabilityV69MenuBtn') : null;
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.InteroperabilityV69?.openHub?.();
  }

  function install() {
    if (installed) return;
    installed = true;
    // Capture phase intentionally runs before the modern More Actions menu consumes the click.
    document.addEventListener('click', openFromEvent, true);
  }

  install();
  return Object.freeze({ version: '6.9.0', install });
})();

'use strict';
