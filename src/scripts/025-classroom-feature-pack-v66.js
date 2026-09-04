window.ClassroomFeaturePackV66 = (() => {
  let installed = false;

  const modules = () => [
    window.SeatGuidanceV66,
    window.PlanningToolsV66,
    window.ExportSupportV66,
    window.DrivePollingV66,
    window.LocalizationShortcutsV66,
    window.ClassroomIntelligenceV68,
    window.GroupedSeatingVisualsV681,
    window.PhysicalTablePodsV682,
    window.InteroperabilityV69
  ].filter(Boolean);

  function install() {
    if (installed) return;
    installed = true;
    modules().forEach(module => module.install?.());
  }

  function afterReady() {
    modules().forEach(module => module.afterReady?.());
    document.body.dataset.featurePack = '6.9.0';
  }

  return Object.freeze({ install, afterReady });
})();

'use strict';

