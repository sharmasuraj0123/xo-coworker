// @ts-check

// The page's hidden layers: Settings over the main area, then Create a project, the sheets and the popovers.

export const PAGE_REGIONS = `
      <section class="arts" id="arts" aria-labelledby="arts-h" tabindex="-1" hidden></section>
      <section class="lpp" id="lpp" aria-labelledby="lpp-h" tabindex="-1" hidden></section>
`;

export const MAIN_LAYERS = `
      <section class="panel" id="panel" aria-labelledby="pn-h" hidden>
        <header class="pn-top">
          <div class="pn-title"><h2 id="pn-h" tabindex="-1">Needs you</h2><p class="pn-count" id="pn-count" aria-live="polite"></p></div>
          <button type="button" class="pn-x" id="pn-x" aria-label="Close decisions" title="Close (Esc)"></button>
        </header>
        <div class="pn-rail" id="pn-rail" aria-hidden="true"></div>
        <div class="pn-stage" id="pn-stage"></div>
        <footer class="pn-foot" id="pn-foot"></footer>
      </section>

      <section class="viewer" id="viewer" role="dialog" aria-labelledby="vw-h" tabindex="-1" hidden></section>

      <div class="toast-wrap"><div class="toast" id="toast" role="status" hidden></div></div>
`;

export const SHELL_DOCK = `
    <section class="shd" id="shd" aria-label="Shells" hidden></section>
`;

export const SETTINGS = `
<section class="settings" id="settings" role="dialog" aria-labelledby="set-h" hidden tabindex="-1">
  <header class="set-top"><h1 id="set-h">Settings</h1><button type="button" class="x" id="set-x" aria-label="Close settings" title="Close (Esc)"></button></header>
  <div class="set-body">
    <nav class="set-nav" aria-label="Settings" role="tablist" aria-orientation="vertical">
      <button type="button" role="tab" id="set-t-general" data-set="general" aria-selected="true" aria-controls="set-p-general">General</button>
      <button type="button" role="tab" id="set-t-appearance" data-set="appearance" aria-selected="false" aria-controls="set-p-appearance" tabindex="-1">Appearance</button>
      <button type="button" role="tab" id="set-t-shape" data-set="shape" aria-selected="false" aria-controls="set-p-shape" tabindex="-1">Shape</button>
      <button type="button" role="tab" id="set-t-routing" data-set="routing" aria-selected="false" aria-controls="set-p-routing" tabindex="-1">Routing</button>
      <button type="button" role="tab" id="set-t-runtimes" data-set="runtimes" aria-selected="false" aria-controls="set-p-runtimes" tabindex="-1">Runtimes</button>
      <button type="button" role="tab" id="set-t-accounts" data-set="accounts" aria-selected="false" aria-controls="set-p-accounts" tabindex="-1">Accounts</button>
      <button type="button" role="tab" id="set-t-rules" data-set="rules" aria-selected="false" aria-controls="set-p-rules" tabindex="-1">Rules</button>
      <button type="button" role="tab" id="set-t-worktrees" data-set="worktrees" aria-selected="false" aria-controls="set-p-worktrees" tabindex="-1">Worktrees</button>
      <button type="button" role="tab" id="set-t-keys" data-set="keys" aria-selected="false" aria-controls="set-p-keys" tabindex="-1">Keyboard</button>
    </nav>
    <div class="set-page" role="tabpanel" id="set-p-general" aria-labelledby="set-t-general" data-page="general"><header class="set-ph"><h2>General</h2><p class="set-intro">How the conversation shows what happens behind it.</p></header>
      <div class="set-row"><div class="set-l"><b id="hops-l">Show how messages travel</b><span>Inside a thread, a quiet line each time a message passes between the workspace, a project's coordinator and the thread. Off unless you turn it on.</span></div><button type="button" class="switch" id="hops-tog" role="switch" aria-checked="false" aria-labelledby="hops-l"><span class="th-track" aria-hidden="true"><span class="th-knob"></span></span></button></div>
      <div class="set-row"><div class="set-l"><b id="webpics-l">Show pictures from the web</b><span>A picture an agent links to shows in the conversation, read straight from its site, which can tell someone looked. Off, it's a link. Only on this device.</span></div><button type="button" class="switch" id="webpics-tog" role="switch" aria-checked="true" aria-labelledby="webpics-l"><span class="th-track" aria-hidden="true"><span class="th-knob"></span></span></button></div>
    </div>
    <div class="set-page" role="tabpanel" id="set-p-appearance" aria-labelledby="set-t-appearance" data-page="appearance" hidden><header class="set-ph"><h2>Appearance</h2><p class="set-intro">How XO looks on this device.</p></header>
      <div class="set-row"><div class="set-l"><b id="mode-l">Mode</b><span>Dark, light, or whichever your system is set to. Only on this device.</span></div><div class="rt-seg is-paid" id="mode-seg" role="radiogroup" aria-labelledby="mode-l"></div></div>
      <div class="set-row is-stack"><div class="set-l"><b id="flavour-l">Flavour</b><span>Each after a well-loved palette: its surfaces, words, accent and status colours, in dark and in light. The XO mark stays as it is. Only on this device.</span></div><div class="set-choices fl-grid" id="flavour-seg" role="radiogroup" aria-labelledby="flavour-l"></div></div>
      <div class="set-row"><div class="set-l"><b id="bubbles-l">Chat bubbles</b><span>Messages in bubbles, as in a messaging app. Off, an agent's reply reads as a full-width document, with room for its math, code, charts and diagrams. Only on this device.</span></div><button type="button" class="switch" id="bubbles-tog" role="switch" aria-checked="false" aria-labelledby="bubbles-l"><span class="th-track" aria-hidden="true"><span class="th-knob"></span></span></button></div>
    </div>
    <div class="set-page" role="tabpanel" id="set-p-shape" aria-labelledby="set-t-shape" data-page="shape" hidden><header class="set-ph"><h2>Shape</h2><p class="set-intro">What XO shows you, and in which words. It changes only when you change it.</p></header><div class="shp"></div></div>
    <div class="set-page" role="tabpanel" id="set-p-routing" aria-labelledby="set-t-routing" data-page="routing" hidden><header class="set-ph"><h2>Routing</h2></header><div class="set-live"></div></div>
    <div class="set-page" role="tabpanel" id="set-p-runtimes" aria-labelledby="set-t-runtimes" data-page="runtimes" hidden><header class="set-ph"><h2>Runtimes</h2><p class="set-intro">The agents XO can run threads on, and where each project's work may go.</p></header><div class="set-live"></div></div>
    <div class="set-page" role="tabpanel" id="set-p-accounts" aria-labelledby="set-t-accounts" data-page="accounts" hidden><header class="set-ph"><h2>Accounts</h2><p class="set-intro">The accounts XO works with for you. Each signs in once, for the whole Space.</p></header><div class="set-live"></div></div>
    <div class="set-page" role="tabpanel" id="set-p-rules" aria-labelledby="set-t-rules" data-page="rules" hidden><header class="set-ph"><h2>Rules</h2></header><div class="set-live"></div></div>
    <div class="set-page" role="tabpanel" id="set-p-worktrees" aria-labelledby="set-t-worktrees" data-page="worktrees" hidden><header class="set-ph"><h2>Worktrees</h2></header><div class="set-live"></div></div>
    <div class="set-page" role="tabpanel" id="set-p-keys" aria-labelledby="set-t-keys" data-page="keys" hidden><header class="set-ph"><h2>Keyboard</h2></header><div id="set-keys-list"></div></div>
  </div>
</section>
`;

export const OVERLAYS = `
<dialog class="dlg" id="create-dlg" aria-labelledby="create-title">
  <form id="create-form" method="dialog" autocomplete="off" novalidate>
    <header class="dlg-head">
      <span class="dlg-ic" id="dlg-ic"></span>
      <div><h2 id="create-title">Create XO Project</h2><p>Its own coordinator, plan and memory.</p></div>
    </header>
    <div class="cp-mode" id="cp-mode" role="radiogroup" aria-label="Start from">
      <button type="button" role="radio" aria-checked="true" data-mode="empty"><span class="cpm-ic" id="cpm-empty"></span>Start empty</button>
      <button type="button" role="radio" aria-checked="false" data-mode="clone"><span class="cpm-ic" id="cpm-clone"></span>From GitHub</button>
    </div>
    <label class="field cp-repo" id="cp-repo-f" hidden>
      <span>Repository</span>
      <span class="cp-in"><span class="cp-in-ic" id="cp-repo-ic"></span><input id="cp-repo" name="repo" maxlength="300" spellcheck="false" autocapitalize="off" placeholder="owner/repo or a Git URL"></span>
      <small class="cp-note" id="cp-gh" aria-live="polite"></small>
    </label>
    <label class="field">
      <span>Project name</span>
      <input id="cp-name" name="name" required maxlength="80" placeholder="e.g. Billing API">
      <small class="cp-note" id="cp-where"></small>
    </label>
    <label class="field">
      <span>What is it for? <em>optional</em></span>
      <textarea id="cp-desc" name="description" rows="2" maxlength="600" placeholder="One or two sentences for the project brief."></textarea>
    </label>
    <div class="cp-prog" id="cp-prog" hidden>
      <div class="cp-bar" id="cp-bar" role="progressbar" aria-label="Cloning"><i></i></div>
      <div class="cp-row">
        <p class="cp-what"><span class="cp-phase" id="cp-phase" aria-live="polite"></span><span class="cp-facts" id="cp-facts"></span></p>
        <span class="cp-t" id="cp-time"></span>
        <button type="button" class="btn cp-stop" id="cp-stop" hidden>Stop</button>
      </div>
      <p class="cp-hint" id="cp-hint" hidden>Big repos take a while. You can close this; you'll hear when it's ready.</p>
    </div>
    <p class="dlg-err" id="cp-err" role="alert" hidden></p>
    <footer class="dlg-foot">
      <button type="button" class="btn" id="cp-cancel">Cancel</button>
      <button type="submit" class="btn btn-pri" id="cp-submit">Create project</button>
    </footer>
  </form>
</dialog>

<div class="sheet" id="runs" role="dialog" aria-modal="true" aria-labelledby="runs-h" hidden>
  <div class="sheet-card runs-card" id="runs-card" tabindex="-1"></div>
</div>

<div class="iq-pop cs-pop" id="cs-pop" role="dialog" aria-label="New chat" tabindex="-1" hidden></div>

<div class="iq-pop" id="iq-pop" role="dialog" aria-labelledby="iq-hh" tabindex="-1" hidden></div>

<div class="sheet" id="jump" role="dialog" aria-modal="true" aria-label="Jump to" hidden>
  <div class="sheet-card jump-card">
    <div class="jump-field"><span id="jump-ic"></span><input id="jump-q" placeholder="Go to a place, or type an action" aria-controls="jump-list" autocomplete="off"></div>
    <ul class="jump-list" id="jump-list" role="listbox" aria-label="Places"></ul>
  </div>
</div>

<div class="sheet" id="keys" role="dialog" aria-modal="true" aria-labelledby="keys-h" hidden>
  <div class="sheet-card keys-card">
    <header class="sheet-h"><h2 id="keys-h">Keys</h2><button type="button" class="x" data-close aria-label="Close"></button></header>
    <div class="keys-cols" id="keys-cols"></div>
  </div>
</div>

<div id="live" class="sr-only" aria-live="polite"></div>
`;
