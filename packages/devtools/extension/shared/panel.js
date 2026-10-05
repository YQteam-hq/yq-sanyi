var status = document.getElementById('status');
var tree = document.getElementById('tree');

function reload() {
  status.textContent = 'querying inspected window...';
  tree.classList.add('empty');
  tree.textContent = '(no components mounted)';
  if (typeof chrome === 'undefined' || !chrome.devtools) {
    status.textContent = 'devtools API unavailable (load this page inside Chrome DevTools or Firefox devtools)';
    return;
  }
  try {
    var result = await new Promise(function(resolve, reject) {
      chrome.devtools.inspectedWindow.eval(
        'JSON.stringify(typeof globalThis.yq === "object" ? Object.keys(globalThis.yq).filter(function(k) { return !k.startsWith("_"); }).slice(0, 10) : null)',
        function(payload, exception) { exception ? reject(exception) : resolve(payload); }
      );
    });
    status.textContent = 'inspected window exposes yq';
    tree.classList.remove('empty');
    tree.textContent = result;
  } catch (e) {
    status.className = 'error';
    status.textContent = 'inspect error: ' + (e && e.message ? e.message : String(e));
  }
}

reload();
