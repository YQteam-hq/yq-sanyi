{{#core}}
const version = document.getElementById('version');

if (version) {
  version.textContent = yq.version;
}
{{#example}}
yq.define('yq-counter', {
  template: '<div class="counter"><b>{{ count }}</b><button yq-on:click="inc">+1</button><button yq-on:click="reset">reset</button></div>',
  style: '.counter { display: flex; align-items: center; gap: 12px; } .counter b { font-size: 1.25rem; } .counter button { font: inherit; padding: 4px 12px; border: 1px solid #6366f1; border-radius: 6px; background: #6366f1; color: #ffffff; cursor: pointer; }',
  script: function () {
    return {
      state: { count: 0 },
      inc: function (state) {
        state.count = state.count + 1;
      },
      reset: function (state) {
        state.count = 0;
      }
    };
  }
});
{{/example}}
{{/core}}
