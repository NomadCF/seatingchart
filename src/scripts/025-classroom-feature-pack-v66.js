window.ClassroomFeaturePackV66 = (() => {
  let installed = false;

  const modules = () => [
    window.SeatGuidanceV66,
    window.PlanningToolsV66,
    window.ExportSupportV66,
    window.DrivePollingV66,
    window.LocalizationShortcutsV66
  ].filter(Boolean);

  function install() {
    if (installed) return;
    installed = true;
    modules().forEach(module => module.install?.());
  }

  function afterReady() {
    modules().forEach(module => module.afterReady?.());
    document.body.dataset.featurePack = '6.6';
  }

  return Object.freeze({ install, afterReady });
})();

'use strict';

