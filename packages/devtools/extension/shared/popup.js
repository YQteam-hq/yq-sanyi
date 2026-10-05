document.getElementById('open').addEventListener('click', function() {
  if (typeof chrome !== 'undefined' && chrome.devtools) {
    chrome.devtools.openPanel ? chrome.devtools.openPanel() : null;
  }
});
