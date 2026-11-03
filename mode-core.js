/* LifeOS experience rules — plain script shared with UI and tests. */
(function (root) {
  'use strict';
  const MODES = ['simple','standard','advanced'];
  const FOCUS = ['fitness','food','money','home','pets','wellness','routines','projects','goals','vault','journal','library'];
  const CORE_SIMPLE = ['today','planner','dayplan','calendar','reminders','capture','explore'];
  const CORE_STANDARD = ['today','planner','dayplan','calendar','reminders','capture','insights','explore'];
  function mode(value) { return MODES.includes(value) ? value : 'simple'; }
  function interests(input) {
    return [...new Set((Array.isArray(input) ? input : ['fitness','food','money']).filter(x => FOCUS.includes(x)))];
  }
  function visible(inputMode, inputFocus, hidden, available) {
    const level = mode(inputMode), chosen = interests(inputFocus);
    const allowed = new Set(Array.isArray(available) ? available : []);
    const blocked = new Set(Array.isArray(hidden) ? hidden : []);
    if(level === 'advanced') return [...allowed].filter(k => k!=='settings' && !blocked.has(k));
    const core = level==='simple' ? CORE_SIMPLE : CORE_STANDARD;
    const extra = level==='simple' ? chosen.slice(0,3) : chosen;
    return [...new Set([...core,...extra])].filter(k => allowed.has(k) && !blocked.has(k));
  }
  function selectedExtras(inputFocus, inputMode) {
    const list = interests(inputFocus);
    return mode(inputMode)==='simple'?list.slice(0,3):list;
  }
  function shouldShowOnboarding(settings,itemCount) {
    return !settings?.onboarded && !Number(itemCount||0);
  }
  root.LifeOSModes = Object.freeze({ MODES, FOCUS, CORE_SIMPLE, CORE_STANDARD, mode, interests, visible, selectedExtras, shouldShowOnboarding });
})(typeof window !== 'undefined' ? window : globalThis);
