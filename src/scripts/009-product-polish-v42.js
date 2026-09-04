const ProductPolishV42 = (() => {
  let installed = false;

  function refineCopy() {
    const brandSubtitle = document.querySelector('.v4-brand span');
    if (brandSubtitle) brandSubtitle.textContent = 'Classroom planning workspace';
    const saveStatus = document.getElementById('inlineSaveStatus');
    if (saveStatus) {
      saveStatus.setAttribute('aria-label', 'Open save and backup options');
    }
  }

  function install() {
    if (installed) return;
    installed = true;
    document.body.classList.add('product-v42');
    document.body.dataset.productExperience = '4.2';
    document.body.dataset.workspaceExperience = '4.2';
    refineCopy();
  }

  function afterReady() {
    refineCopy();
    updateSaveHealthPanel();
  }

  return Object.freeze({ install, afterReady });
})();

