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
    window.InteroperabilityV69,
    window.ClassroomDigitalTwinV700,
    window.ActivityLayoutsV701,
    window.StationRotationsV702,
    window.TestingModeV703,
    window.PlannerPacksV720
  ].filter(Boolean);

  function install() {
    if (installed) return;
    installed = true;
    modules().forEach(module => module.install?.());
  }

  function afterReady() {
    modules().forEach(module => module.afterReady?.());
    document.body.dataset.featurePack = '7.2.2';
  }

  return Object.freeze({ install, afterReady });
})();

'use strict';
