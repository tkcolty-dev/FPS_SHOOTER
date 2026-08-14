// Scratch-style block definitions. Block types are REAL Scratch opcodes,
// field/input names match scratch-vm, so export to .sb3 is a direct mapping.
(function () {
  const C = {
    motion: '#4C97FF', looks: '#9966FF', sound: '#CF63CF', events: '#FFBF00',
    control: '#FFAB19', sensing: '#5CB1D6', operators: '#59C059', variables: '#FF8C1A',
  };

  const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const KEYS = [['space', 'space'], ['up arrow', 'up arrow'], ['down arrow', 'down arrow'],
    ['left arrow', 'left arrow'], ['right arrow', 'right arrow'], ['any', 'any'],
    ...LETTERS.map(l => [l, l]), ...'0123456789'.split('').map(d => [d, d])];

  // Dynamic dropdowns ask the app for current costumes/sounds/sprites.
  const dyn = fn => function () {
    try { const o = fn(); if (o && o.length) return o; } catch (e) {}
    return [['—', '—']];
  };
  const costumeOptions = dyn(() => window.SP && SP.costumeOptions());
  const soundOptions = dyn(() => window.SP && SP.soundOptions());
  const touchingOptions = dyn(() => window.SP && SP.touchingOptions());
  const towardsOptions = dyn(() => window.SP && SP.towardsOptions());
  const gotoOptions = dyn(() => window.SP && SP.gotoOptions());

  const stmt = { previousStatement: null, nextStatement: null };
  const B = [];
  const def = (type, colour, message0, extra) => B.push(Object.assign({ type, colour, message0 }, extra));

  // ---------- Events ----------
  def('event_whenflagclicked', C.events, 'when ⚑ clicked', { nextStatement: null });
  def('event_whenkeypressed', C.events, 'when %1 key pressed', {
    nextStatement: null, args0: [{ type: 'field_dropdown', name: 'KEY_OPTION', options: KEYS }] });
  def('event_whenthisspriteclicked', C.events, 'when this sprite clicked', { nextStatement: null });
  def('event_whenbroadcastreceived', C.events, 'when I receive %1', {
    nextStatement: null, args0: [{ type: 'field_input', name: 'BROADCAST_OPTION', text: 'message1' }] });
  def('event_broadcast', C.events, 'broadcast %1', Object.assign({}, stmt, {
    args0: [{ type: 'field_input', name: 'BROADCAST_INPUT', text: 'message1' }] }));

  // ---------- Motion ----------
  const num = name => ({ type: 'input_value', name, check: 'Number' });
  def('motion_movesteps', C.motion, 'move %1 steps', Object.assign({}, stmt, { args0: [num('STEPS')] }));
  def('motion_turnright', C.motion, 'turn ↻ %1 degrees', Object.assign({}, stmt, { args0: [num('DEGREES')] }));
  def('motion_turnleft', C.motion, 'turn ↺ %1 degrees', Object.assign({}, stmt, { args0: [num('DEGREES')] }));
  def('motion_goto', C.motion, 'go to %1', Object.assign({}, stmt, {
    args0: [{ type: 'field_dropdown', name: 'TO', options: gotoOptions }] }));
  def('motion_gotoxy', C.motion, 'go to x: %1 y: %2', Object.assign({}, stmt, { args0: [num('X'), num('Y')] }));
  def('motion_glidesecstoxy', C.motion, 'glide %1 secs to x: %2 y: %3', Object.assign({}, stmt, { args0: [num('SECS'), num('X'), num('Y')] }));
  def('motion_pointindirection', C.motion, 'point in direction %1', Object.assign({}, stmt, { args0: [num('DIRECTION')] }));
  def('motion_pointtowards', C.motion, 'point towards %1', Object.assign({}, stmt, {
    args0: [{ type: 'field_dropdown', name: 'TOWARDS', options: towardsOptions }] }));
  def('motion_changexby', C.motion, 'change x by %1', Object.assign({}, stmt, { args0: [num('DX')] }));
  def('motion_setx', C.motion, 'set x to %1', Object.assign({}, stmt, { args0: [num('X')] }));
  def('motion_changeyby', C.motion, 'change y by %1', Object.assign({}, stmt, { args0: [num('DY')] }));
  def('motion_sety', C.motion, 'set y to %1', Object.assign({}, stmt, { args0: [num('Y')] }));
  def('motion_ifonedgebounce', C.motion, 'if on edge, bounce', Object.assign({}, stmt));
  def('motion_xposition', C.motion, 'x position', { output: 'Number' });
  def('motion_yposition', C.motion, 'y position', { output: 'Number' });
  def('motion_direction', C.motion, 'direction', { output: 'Number' });

  // ---------- Looks ----------
  const anyIn = name => ({ type: 'input_value', name });
  def('looks_sayforsecs', C.looks, 'say %1 for %2 seconds', Object.assign({}, stmt, { args0: [anyIn('MESSAGE'), num('SECS')] }));
  def('looks_say', C.looks, 'say %1', Object.assign({}, stmt, { args0: [anyIn('MESSAGE')] }));
  def('looks_thinkforsecs', C.looks, 'think %1 for %2 seconds', Object.assign({}, stmt, { args0: [anyIn('MESSAGE'), num('SECS')] }));
  def('looks_switchcostumeto', C.looks, 'switch costume to %1', Object.assign({}, stmt, {
    args0: [{ type: 'field_dropdown', name: 'COSTUME', options: costumeOptions }] }));
  def('looks_nextcostume', C.looks, 'next costume', Object.assign({}, stmt));
  def('looks_changesizeby', C.looks, 'change size by %1', Object.assign({}, stmt, { args0: [num('CHANGE')] }));
  def('looks_setsizeto', C.looks, 'set size to %1 %%', Object.assign({}, stmt, { args0: [num('SIZE')] }));
  def('looks_show', C.looks, 'show', Object.assign({}, stmt));
  def('looks_hide', C.looks, 'hide', Object.assign({}, stmt));
  def('looks_size', C.looks, 'size', { output: 'Number' });

  // ---------- Sound ----------
  def('sound_play', C.sound, 'start sound %1', Object.assign({}, stmt, {
    args0: [{ type: 'field_dropdown', name: 'SOUND_MENU', options: soundOptions }] }));
  def('sound_playuntildone', C.sound, 'play sound %1 until done', Object.assign({}, stmt, {
    args0: [{ type: 'field_dropdown', name: 'SOUND_MENU', options: soundOptions }] }));
  def('sound_stopallsounds', C.sound, 'stop all sounds', Object.assign({}, stmt));

  // ---------- Control ----------
  const boolIn = name => ({ type: 'input_value', name, check: 'Boolean' });
  const stack = name => ({ type: 'input_statement', name });
  def('control_wait', C.control, 'wait %1 seconds', Object.assign({}, stmt, { args0: [num('DURATION')] }));
  def('control_repeat', C.control, 'repeat %1 %2 %3', Object.assign({}, stmt, {
    args0: [num('TIMES'), { type: 'input_end_row' }, stack('SUBSTACK')] }));
  def('control_forever', C.control, 'forever %1 %2', {
    previousStatement: null, args0: [{ type: 'input_end_row' }, stack('SUBSTACK')] });
  def('control_if', C.control, 'if %1 then %2 %3', Object.assign({}, stmt, {
    args0: [boolIn('CONDITION'), { type: 'input_end_row' }, stack('SUBSTACK')] }));
  def('control_if_else', C.control, 'if %1 then %2 %3 else %4 %5', Object.assign({}, stmt, {
    args0: [boolIn('CONDITION'), { type: 'input_end_row' }, stack('SUBSTACK'), { type: 'input_end_row' }, stack('SUBSTACK2')] }));
  def('control_wait_until', C.control, 'wait until %1', Object.assign({}, stmt, { args0: [boolIn('CONDITION')] }));
  def('control_repeat_until', C.control, 'repeat until %1 %2 %3', Object.assign({}, stmt, {
    args0: [boolIn('CONDITION'), { type: 'input_end_row' }, stack('SUBSTACK')] }));
  def('control_stop', C.control, 'stop %1', {
    previousStatement: null,
    args0: [{ type: 'field_dropdown', name: 'STOP_OPTION', options: [['all', 'all'], ['this script', 'this script']] }] });

  // ---------- Sensing ----------
  def('sensing_touchingobject', C.sensing, 'touching %1 ?', {
    output: 'Boolean', args0: [{ type: 'field_dropdown', name: 'TOUCHINGOBJECTMENU', options: touchingOptions }] });
  def('sensing_keypressed', C.sensing, 'key %1 pressed?', {
    output: 'Boolean', args0: [{ type: 'field_dropdown', name: 'KEY_OPTION', options: KEYS }] });
  def('sensing_mousedown', C.sensing, 'mouse down?', { output: 'Boolean' });
  def('sensing_mousex', C.sensing, 'mouse x', { output: 'Number' });
  def('sensing_mousey', C.sensing, 'mouse y', { output: 'Number' });
  def('sensing_timer', C.sensing, 'timer', { output: 'Number' });
  def('sensing_resettimer', C.sensing, 'reset timer', Object.assign({}, stmt));
  def('sensing_askandwait', C.sensing, 'ask %1 and wait', Object.assign({}, stmt, { args0: [anyIn('QUESTION')] }));
  def('sensing_answer', C.sensing, 'answer', { output: null });

  // ---------- Operators ----------
  const op2 = (type, sym) => def(type, C.operators, '%1 ' + sym + ' %2', { output: 'Number', args0: [num('NUM1'), num('NUM2')] });
  op2('operator_add', '+'); op2('operator_subtract', '−'); op2('operator_multiply', '×'); op2('operator_divide', '÷');
  def('operator_random', C.operators, 'pick random %1 to %2', { output: 'Number', args0: [num('FROM'), num('TO')] });
  const cmp = (type, sym) => def(type, C.operators, '%1 ' + sym + ' %2', { output: 'Boolean', args0: [anyIn('OPERAND1'), anyIn('OPERAND2')] });
  cmp('operator_gt', '>'); cmp('operator_lt', '<'); cmp('operator_equals', '=');
  def('operator_and', C.operators, '%1 and %2', { output: 'Boolean', args0: [boolIn('OPERAND1'), boolIn('OPERAND2')] });
  def('operator_or', C.operators, '%1 or %2', { output: 'Boolean', args0: [boolIn('OPERAND1'), boolIn('OPERAND2')] });
  def('operator_not', C.operators, 'not %1', { output: 'Boolean', args0: [boolIn('OPERAND')] });
  def('operator_join', C.operators, 'join %1 %2', { output: 'String', args0: [anyIn('STRING1'), anyIn('STRING2')] });
  def('operator_mod', C.operators, '%1 mod %2', { output: 'Number', args0: [num('NUM1'), num('NUM2')] });
  def('operator_round', C.operators, 'round %1', { output: 'Number', args0: [num('NUM')] });

  // ---------- Variables ----------
  def('data_setvariableto', C.variables, 'set %1 to %2', Object.assign({}, stmt, {
    args0: [{ type: 'field_variable', name: 'VARIABLE', variable: 'score' }, anyIn('VALUE')] }));
  def('data_changevariableby', C.variables, 'change %1 by %2', Object.assign({}, stmt, {
    args0: [{ type: 'field_variable', name: 'VARIABLE', variable: 'score' }, num('VALUE')] }));
  def('data_variable', C.variables, '%1', {
    output: null, args0: [{ type: 'field_variable', name: 'VARIABLE', variable: 'score' }] });
  def('data_showvariable', C.variables, 'show variable %1', Object.assign({}, stmt, {
    args0: [{ type: 'field_variable', name: 'VARIABLE', variable: 'score' }] }));
  def('data_hidevariable', C.variables, 'hide variable %1', Object.assign({}, stmt, {
    args0: [{ type: 'field_variable', name: 'VARIABLE', variable: 'score' }] }));

  Blockly.defineBlocksWithJsonArray(B);

  // ---------- Toolbox ----------
  const numShadow = (name, val) => ({ [name]: { shadow: { type: 'math_number', fields: { NUM: val } } } });
  const textShadow = (name, val) => ({ [name]: { shadow: { type: 'text', fields: { TEXT: val } } } });
  const blk = (type, inputs) => ({ kind: 'block', type, inputs });

  window.SP_TOOLBOX = {
    kind: 'categoryToolbox',
    contents: [
      { kind: 'category', name: 'Motion', colour: C.motion, contents: [
        blk('motion_movesteps', numShadow('STEPS', 10)),
        blk('motion_turnright', numShadow('DEGREES', 15)),
        blk('motion_turnleft', numShadow('DEGREES', 15)),
        blk('motion_goto'),
        blk('motion_gotoxy', Object.assign(numShadow('X', 0), numShadow('Y', 0))),
        blk('motion_glidesecstoxy', Object.assign(numShadow('SECS', 1), numShadow('X', 0), numShadow('Y', 0))),
        blk('motion_pointindirection', numShadow('DIRECTION', 90)),
        blk('motion_pointtowards'),
        blk('motion_changexby', numShadow('DX', 10)),
        blk('motion_setx', numShadow('X', 0)),
        blk('motion_changeyby', numShadow('DY', 10)),
        blk('motion_sety', numShadow('Y', 0)),
        blk('motion_ifonedgebounce'),
        blk('motion_xposition'), blk('motion_yposition'), blk('motion_direction'),
      ]},
      { kind: 'category', name: 'Looks', colour: C.looks, contents: [
        blk('looks_sayforsecs', Object.assign(textShadow('MESSAGE', 'Hello!'), numShadow('SECS', 2))),
        blk('looks_say', textShadow('MESSAGE', 'Hello!')),
        blk('looks_thinkforsecs', Object.assign(textShadow('MESSAGE', 'Hmm...'), numShadow('SECS', 2))),
        blk('looks_switchcostumeto'),
        blk('looks_nextcostume'),
        blk('looks_changesizeby', numShadow('CHANGE', 10)),
        blk('looks_setsizeto', numShadow('SIZE', 100)),
        blk('looks_show'), blk('looks_hide'), blk('looks_size'),
      ]},
      { kind: 'category', name: 'Sound', colour: C.sound, contents: [
        blk('sound_playuntildone'), blk('sound_play'), blk('sound_stopallsounds'),
      ]},
      { kind: 'category', name: 'Events', colour: C.events, contents: [
        blk('event_whenflagclicked'),
        blk('event_whenkeypressed'),
        blk('event_whenthisspriteclicked'),
        blk('event_whenbroadcastreceived'),
        blk('event_broadcast'),
      ]},
      { kind: 'category', name: 'Control', colour: C.control, contents: [
        blk('control_wait', numShadow('DURATION', 1)),
        blk('control_repeat', numShadow('TIMES', 10)),
        blk('control_forever'),
        blk('control_if'), blk('control_if_else'),
        blk('control_wait_until'),
        blk('control_repeat_until', numShadow('TIMES', 10)),
        blk('control_stop'),
      ]},
      { kind: 'category', name: 'Sensing', colour: C.sensing, contents: [
        blk('sensing_touchingobject'),
        blk('sensing_keypressed'),
        blk('sensing_mousedown'), blk('sensing_mousex'), blk('sensing_mousey'),
        blk('sensing_timer'), blk('sensing_resettimer'),
        blk('sensing_askandwait', textShadow('QUESTION', "What's your name?")),
        blk('sensing_answer'),
      ]},
      { kind: 'category', name: 'Operators', colour: C.operators, contents: [
        blk('operator_add', Object.assign(numShadow('NUM1', ''), numShadow('NUM2', ''))),
        blk('operator_subtract', Object.assign(numShadow('NUM1', ''), numShadow('NUM2', ''))),
        blk('operator_multiply', Object.assign(numShadow('NUM1', ''), numShadow('NUM2', ''))),
        blk('operator_divide', Object.assign(numShadow('NUM1', ''), numShadow('NUM2', ''))),
        blk('operator_random', Object.assign(numShadow('FROM', 1), numShadow('TO', 10))),
        blk('operator_gt', Object.assign(textShadow('OPERAND1', ''), textShadow('OPERAND2', '50'))),
        blk('operator_lt', Object.assign(textShadow('OPERAND1', ''), textShadow('OPERAND2', '50'))),
        blk('operator_equals', Object.assign(textShadow('OPERAND1', ''), textShadow('OPERAND2', '50'))),
        blk('operator_and'), blk('operator_or'), blk('operator_not'),
        blk('operator_join', Object.assign(textShadow('STRING1', 'apple '), textShadow('STRING2', 'banana'))),
        blk('operator_mod', Object.assign(numShadow('NUM1', ''), numShadow('NUM2', ''))),
        blk('operator_round', numShadow('NUM', '')),
      ]},
      { kind: 'category', name: 'Variables', colour: C.variables, custom: 'SP_VARS' },
    ],
  };
})();
