/* Spark Engine — block semantics self-test (open /?selftest=1, results in console + window.SparkSelfTest.results)
   Every case builds a tiny project with the XML builder, runs it, and checks Scratch's expected behaviour. */
(function () {
  const B = window.SparkExamples._builder;
  const { blk, script, xml, menu, bool, flag, forever, repeat, iff, wait, goto, show, hide, touching, lt, gt, eq, not, or, rep, xpos, ypos, add, rand, clone, cloneMe, delClone, costume, backdrop } = B;
  const Lib = window.SparkLib;
  const n = (t, o) => rep(t, o);
  const str = (t, v) => blk(t, { v });
  const setVar = (name, v, id = 'v1') => blk('data_setvariableto', { f: { VARIABLE: { name, id } }, v: { VALUE: v } });
  const chVar = (name, v, id = 'v1') => blk('data_changevariableby', { f: { VARIABLE: { name, id } }, v: { VALUE: v } });
  const getVar = (name, id = 'v1') => rep('data_variable', { f: { VARIABLE: { name, id } } });
  const list = (type, o, id = 'l1') => blk(type, { ...o, f: { ...(o.f || {}), LIST: { name: 'mylist', id, type: 'list' } } });
  const listRep = (type, o, id = 'l1') => rep(type, { ...o, f: { ...(o.f || {}), LIST: { name: 'mylist', id, type: 'list' } } });
  const sayRes = v => blk('data_setvariableto', { f: { VARIABLE: { name: 'result', id: 'res' } }, v: { VALUE: v } });
  const varsXML = `<variables><variable type="" id="res" islocal="false">result</variable><variable type="" id="v1" islocal="false">v</variable><variable type="list" id="l1" islocal="false">mylist</variable><variable type="broadcast_msg" id="b1" islocal="false">go</variable></variables>`;
  const wrap = (...scripts) => `<xml>${varsXML}${scripts.join('')}</xml>`;
  const flagScript = (...blocks) => script([flag(), ...blocks], 0, 0);
  const near = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;
  const bx = x => ({ xml: x }); // boolean reporter xml -> value spec

  function project(spriteXml, extraSprites = [], stageXml = wrap()) {
    return {
      name: 'selftest',
      stage: { name: 'Stage', costumes: [backdrop('Blank'), backdrop('Sky')], currentCostume: 0, sounds: [], xml: stageXml, variables: [] },
      sprites: [{ id: 's1', name: 'Sprite1', x: 0, y: 0, direction: 90, size: 100, visible: true, costumes: [costume('Square', '#ff0000', 'a'), costume('Ball', '#00ff00', 'b'), costume('Star', '#0000ff', 'c')], currentCostume: 0, sounds: [{ name: 'Pop', preset: 'Pop' }, { name: 'Lose', preset: 'Lose' }], xml: spriteXml, variables: [] }, ...extraSprites],
      monitors: []
    };
  }
  const other = (name, x, y) => ({ id: 'o_' + name, name, x, y, direction: 90, size: 100, visible: true, costumes: [costume('Square', '#0000ff')], currentCostume: 0, sounds: [], xml: '<xml></xml>', variables: [] });

  // each case: { name, sprite: xml, others?, stage?, ms, check(R, S) -> true | string }
  const CASES = [
    // ---------- motion ----------
    { name: 'move steps', sprite: wrap(flagScript(blk('motion_movesteps', { v: { STEPS: 10 } }))), check: (R, S) => near(S.x, 10) && near(S.y, 0) || `x=${S.x}` },
    { name: 'turn right/left', sprite: wrap(flagScript(blk('motion_turnright', { v: { DEGREES: 15 } }), blk('motion_turnleft', { v: { DEGREES: 5 } }))), check: (R, S) => S.direction === 100 || `dir=${S.direction}` },
    { name: 'direction wraps to -180..180', sprite: wrap(flagScript(blk('motion_pointindirection', { v: { DIRECTION: 270 } }))), check: (R, S) => S.direction === -90 || `dir=${S.direction}` },
    { name: 'point towards sprite', others: [other('T', 0, 100)], sprite: wrap(flagScript(blk('motion_pointtowards', { v: { TOWARDS: menu('motion_pointtowards_menu', 'TOWARDS', 'T') } }))), check: (R, S) => S.direction === 0 || `dir=${S.direction}` },
    { name: 'go to x y / change / set', sprite: wrap(flagScript(goto(10, 20), blk('motion_changexby', { v: { DX: 5 } }), blk('motion_sety', { v: { Y: -7 } }))), check: (R, S) => S.x === 15 && S.y === -7 || `${S.x},${S.y}` },
    { name: 'go to sprite', others: [other('T', 33, 44)], sprite: wrap(flagScript(blk('motion_goto', { v: { TO: menu('motion_goto_menu', 'TO', 'T') } }))), check: (R, S) => S.x === 33 && S.y === 44 || `${S.x},${S.y}` },
    { name: 'glide takes the time', sprite: wrap(flagScript(blk('motion_glidesecstoxy', { v: { SECS: 0.5, X: 100, Y: 0 } }), sayRes('done'))), ms: 250, check: (R, S) => S.x > 20 && S.x < 80 && R.v(null, 'result') !== 'done' || `x=${S.x}` },
    { name: 'glide finishes exactly', sprite: wrap(flagScript(blk('motion_glidesecstoxy', { v: { SECS: 0.2, X: 100, Y: 50 } }), sayRes('done'))), ms: 500, check: (R, S) => S.x === 100 && S.y === 50 && R.v(null, 'result') === 'done' || `${S.x},${S.y}` },
    { name: 'if on edge bounce', sprite: wrap(flagScript(goto(300, 0), blk('motion_ifonedgebounce'))), check: (R, S) => S.direction === -90 && S.x < 240 || `dir=${S.direction} x=${S.x}` },
    { name: 'fenced like Scratch (can not leave the stage)', sprite: wrap(flagScript(goto(1000, 1000))), check: (R, S) => S.x < 260 && S.y < 200 || `${S.x},${S.y}` },
    { name: 'rotation style', sprite: wrap(flagScript(blk('motion_setrotationstyle', { f: { STYLE: 'left-right' } }))), check: (R, S) => S.rotationStyle === 'left-right' },
    { name: 'x/y/direction reporters', sprite: wrap(flagScript(goto(3, 4), sayRes(rep('operator_join', { v: { STRING1: xpos(), STRING2: rep('operator_join', { v: { STRING1: ypos(), STRING2: rep('motion_direction') } }) } })))), check: R => R.v(null, 'result') === '3490' || R.v(null, 'result') },
    // ---------- looks ----------
    { name: 'say / think', sprite: wrap(flagScript(blk('looks_say', { v: { MESSAGE: 'hi' } }))), check: (R, S) => S.bubble && S.bubble.text === 'hi' && !S.bubble.think || 'no bubble' },
    { name: 'say for secs clears', sprite: wrap(flagScript(blk('looks_sayforsecs', { v: { MESSAGE: 'hi', SECS: 0.1 } }))), ms: 400, check: (R, S) => S.bubble === null || 'bubble stayed' },
    { name: 'say number formatting', sprite: wrap(flagScript(blk('looks_say', { v: { MESSAGE: rep('operator_divide', { v: { NUM1: 1, NUM2: 3 } }) } }))), check: (R, S) => S.bubble.text === '0.3333333333333333' || S.bubble.text },
    { name: 'show / hide', sprite: wrap(flagScript(hide())), check: (R, S) => S.visible === false },
    { name: 'switch costume by name / number / next', sprite: wrap(flagScript(blk('looks_switchcostumeto', { v: { COSTUME: menu('looks_costume', 'COSTUME', 'c') } }), blk('looks_nextcostume'), blk('looks_nextcostume'), blk('looks_switchcostumeto', { v: { COSTUME: 2 } }))), check: (R, S) => S.currentCostume === 1 || `costume=${S.currentCostume}` },
    { name: 'costume number wraps', sprite: wrap(flagScript(blk('looks_switchcostumeto', { v: { COSTUME: 5 } }))), check: (R, S) => S.currentCostume === 1 || `costume=${S.currentCostume}` },
    { name: 'costume number/name reporters', sprite: wrap(flagScript(blk('looks_nextcostume'), sayRes(rep('operator_join', { v: { STRING1: rep('looks_costumenumbername', { f: { NUMBER_NAME: 'number' } }), STRING2: rep('looks_costumenumbername', { f: { NUMBER_NAME: 'name' } }) } })))), check: R => R.v(null, 'result') === '2b' || R.v(null, 'result') },
    { name: 'switch backdrop + backdrop hat', stage: wrap(script([blk('event_whenbackdropswitchesto', { f: { BACKDROP: 'Sky' } }), sayRes('switched')], 0, 0)), sprite: wrap(flagScript(blk('looks_switchbackdropto', { v: { BACKDROP: menu('looks_backdrops', 'BACKDROP', 'Sky') } }))), ms: 150, check: R => R.stage.currentCostume === 1 && R.v(null, 'result') === 'switched' || `bd=${R.stage.currentCostume} r=${R.v(null, 'result')}` },
    { name: 'next backdrop wraps', sprite: wrap(flagScript(blk('looks_nextbackdrop'), blk('looks_nextbackdrop'))), check: R => R.stage.currentCostume === 0 },
    { name: 'effects set/change/clear', sprite: wrap(flagScript(blk('looks_seteffectto', { f: { EFFECT: 'GHOST' }, v: { VALUE: 50 } }), blk('looks_changeeffectby', { f: { EFFECT: 'COLOR' }, v: { CHANGE: 25 } }))), check: (R, S) => S.effects.GHOST === 50 && S.effects.COLOR === 25 },
    { name: 'size change/set', sprite: wrap(flagScript(blk('looks_changesizeby', { v: { CHANGE: 10 } }), blk('looks_changesizeby', { v: { CHANGE: 10 } }))), check: (R, S) => S.size === 120 },
    { name: 'layers front/back', others: [other('T', 0, 0)], sprite: wrap(flagScript(blk('looks_gotofrontback', { f: { FRONT_BACK: 'back' } }))), check: (R, S) => R.targets[0] === S || 'not at back' },
    // ---------- sound ----------
    { name: 'play sound until done waits', sprite: wrap(flagScript(blk('sound_playuntildone', { v: { SOUND_MENU: menu('sound_sounds_menu', 'SOUND_MENU', 'Lose') } }), sayRes('done'))), ms: 300, check: R => R.v(null, 'result') !== 'done' || 'did not wait' },
    { name: 'volume', sprite: wrap(flagScript(blk('sound_setvolumeto', { v: { VOLUME: 150 } }), blk('sound_changevolumeby', { v: { VOLUME: -70 } }))), check: (R, S) => S.volume === 30 || `vol=${S.volume}` },
    // ---------- events ----------
    { name: 'broadcast and receive', sprite: wrap(flagScript(blk('event_broadcast', { v: { BROADCAST_INPUT: menu('event_broadcast_menu', 'BROADCAST_OPTION', 'go', { id: 'b1', type: 'broadcast_msg' }) } })), script([blk('event_whenbroadcastreceived', { f: { BROADCAST_OPTION: { name: 'go', id: 'b1', type: 'broadcast_msg' } } }), sayRes('got it')], 0, 300)), ms: 120, check: R => R.v(null, 'result') === 'got it' || R.v(null, 'result') },
    { name: 'broadcast and wait', sprite: wrap(flagScript(blk('event_broadcastandwait', { v: { BROADCAST_INPUT: menu('event_broadcast_menu', 'BROADCAST_OPTION', 'go', { id: 'b1', type: 'broadcast_msg' }) } }), chVar('result', 1, 'res')), script([blk('event_whenbroadcastreceived', { f: { BROADCAST_OPTION: { name: 'go', id: 'b1', type: 'broadcast_msg' } } }), wait(0.15), sayRes(10)], 0, 300)), ms: 400, check: R => R.v(null, 'result') === 11 || `r=${R.v(null, 'result')}` },
    { name: 'when key pressed', sprite: wrap(script([blk('event_whenkeypressed', { f: { KEY_OPTION: 'space' } }), sayRes('space!')], 0, 0)), key: ' ', check: R => R.v(null, 'result') === 'space!' || R.v(null, 'result') },
    { name: 'when timer > ', sprite: wrap(script([blk('event_whengreaterthan', { f: { WHENGREATERTHANMENU: 'TIMER' }, v: { VALUE: 0.1 } }), sayRes('timer')], 0, 0)), ms: 300, check: R => R.v(null, 'result') === 'timer' || R.v(null, 'result') },
    // ---------- control ----------
    { name: 'wait', sprite: wrap(flagScript(wait(0.6), sayRes('done'))), ms: 100, check: R => R.v(null, 'result') !== 'done' || 'too early' },
    { name: 'repeat', sprite: wrap(flagScript(repeat(7, chVar('result', 1, 'res')))), ms: 300, check: R => R.v(null, 'result') === 7 || R.v(null, 'result') },
    { name: 'repeat yields each loop', sprite: wrap(flagScript(repeat(100, chVar('result', 1, 'res')))), ms: 60, check: R => { const v = R.v(null, 'result'); return v > 0 && v < 100 || `r=${v}`; } },
    { name: 'forever + stop this script', sprite: wrap(flagScript(forever(chVar('result', 1, 'res'), iff(gt(getVar('result', 'res'), 4), blk('control_stop', { f: { STOP_OPTION: 'this script' } }))))), ms: 300, check: R => R.v(null, 'result') === 5 || R.v(null, 'result') },
    { name: 'if / else', sprite: wrap(flagScript(blk('control_if_else', { v: { CONDITION: bool(lt(1, 2)) }, s: { SUBSTACK: [sayRes('yes')], SUBSTACK2: [sayRes('no')] } }), blk('control_if_else', { v: { CONDITION: bool(lt(3, 2)) }, s: { SUBSTACK: [chVar('result', 'x', 'res')], SUBSTACK2: [sayRes(rep('operator_join', { v: { STRING1: getVar('result', 'res'), STRING2: 'no' } }))] } }))), check: R => R.v(null, 'result') === 'yesno' || R.v(null, 'result') },
    { name: 'wait until / repeat until', sprite: wrap(flagScript(blk('control_repeat_until', { v: { CONDITION: bool(gt(getVar('result', 'res'), 2)) }, s: { SUBSTACK: [chVar('result', 1, 'res')] } }), blk('control_wait_until', { v: { CONDITION: bool(gt(rep('sensing_timer'), 0.05)) } }), chVar('result', 100, 'res'))), ms: 400, check: R => R.v(null, 'result') === 103 || R.v(null, 'result') },
    { name: 'stop all', sprite: wrap(flagScript(blk('control_stop', { f: { STOP_OPTION: 'all' } })), flagScript(forever(chVar('result', 1, 'res')))), ms: 200, check: R => R.v(null, 'result') <= 2 && !R.running || `r=${R.v(null, 'result')} running=${R.running}` },
    { name: 'stop other scripts in sprite', sprite: wrap(flagScript(wait(0.05), blk('control_stop', { f: { STOP_OPTION: 'other scripts in sprite' } })), flagScript(forever(chVar('result', 1, 'res')))), ms: 300, check: R => R.v(null, 'result') < 10 || `r=${R.v(null, 'result')}` },
    { name: 'clones start, count, delete', sprite: wrap(flagScript(repeat(3, cloneMe())), script([clone(), chVar('result', 1, 'res'), wait(0.5), delClone()], 0, 300)), ms: 100, check: R => R.v(null, 'result') === 3 && R.targets.filter(t => t.isClone).length === 3 || `r=${R.v(null, 'result')} clones=${R.targets.filter(t => t.isClone).length}` },
    { name: 'clones get deleted', sprite: wrap(flagScript(repeat(3, cloneMe())), script([clone(), wait(0.05), delClone()], 0, 300)), ms: 400, check: R => R.targets.filter(t => t.isClone).length === 0 || 'clones remain' },
    { name: 'clone keeps its own variables', sprite: wrap(flagScript(setVar('v', 1), cloneMe(), setVar('v', 2)), script([clone(), wait(0.1), sayRes(getVar('v'))], 0, 300)), ms: 300, check: R => R.v(null, 'result') === 2 || `r=${R.v(null, 'result')} (global var, clone reads shared)` },
    // ---------- sensing ----------
    { name: 'touching sprite / not touching', others: [other('T', 20, 0), other('F', 300, 0)], sprite: wrap(flagScript(sayRes(rep('operator_join', { v: { STRING1: bx(touching('T')), STRING2: bx(touching('F')) } })))), check: R => R.v(null, 'result') === 'truefalse' || R.v(null, 'result') },
    { name: 'touching edge', sprite: wrap(flagScript(goto(230, 0), sayRes(bx(touching('_edge_'))))), check: R => R.v(null, 'result') === true || String(R.v(null, 'result')) },
    { name: 'touching color', others: [other('T', 0, 0)], sprite: wrap(flagScript(blk('looks_gotofrontback', { f: { FRONT_BACK: 'front' } }), sayRes(rep('sensing_touchingcolor', { v: { COLOR: '#0000ff' } })))), check: R => R.v(null, 'result') === true || String(R.v(null, 'result')) },
    { name: 'distance to', others: [other('T', 30, 40)], sprite: wrap(flagScript(sayRes(rep('sensing_distanceto', { v: { DISTANCETOMENU: menu('sensing_distancetomenu', 'DISTANCETOMENU', 'T') } })))), check: R => R.v(null, 'result') === 50 || R.v(null, 'result') },
    { name: 'key pressed? (held)', sprite: wrap(flagScript(wait(0.05), sayRes(rep('sensing_keypressed', { v: { KEY_OPTION: menu('sensing_keyoptions', 'KEY_OPTION', 'a') } })))), hold: 'a', ms: 200, check: R => R.v(null, 'result') === true || String(R.v(null, 'result')) },
    { name: 'timer resets on flag', sprite: wrap(flagScript(sayRes(rep('sensing_timer')))), check: R => R.v(null, 'result') < 0.1 || R.v(null, 'result') },
    { name: 'reset timer', sprite: wrap(flagScript(wait(0.2), blk('sensing_resettimer'), sayRes(rep('sensing_timer')))), ms: 300, check: R => R.v(null, 'result') < 0.05 || R.v(null, 'result') },
    { name: 'x position of sprite', others: [other('T', 77, 0)], sprite: wrap(flagScript(sayRes(rep('sensing_of', { f: { PROPERTY: 'x position' }, v: { OBJECT: menu('sensing_of_object_menu', 'OBJECT', 'T') } })))), check: R => R.v(null, 'result') === 77 || R.v(null, 'result') },
    { name: 'backdrop name of Stage', sprite: wrap(flagScript(sayRes(rep('sensing_of', { f: { PROPERTY: 'backdrop name' }, v: { OBJECT: menu('sensing_of_object_menu', 'OBJECT', '_stage_') } })))), check: R => R.v(null, 'result') === 'Blank' || R.v(null, 'result') },
    { name: 'current year', sprite: wrap(flagScript(sayRes(rep('sensing_current', { f: { CURRENTMENU: 'YEAR' } })))), check: R => R.v(null, 'result') === new Date().getFullYear() || R.v(null, 'result') },
    { name: 'mouse x / y numbers', sprite: wrap(flagScript(sayRes(add(rep('sensing_mousex'), rep('sensing_mousey'))))), check: R => typeof R.v(null, 'result') === 'number' },
    // ---------- operators ----------
    { name: 'arithmetic', sprite: wrap(flagScript(sayRes(rep('operator_add', { v: { NUM1: rep('operator_multiply', { v: { NUM1: 3, NUM2: 4 } }), NUM2: rep('operator_subtract', { v: { NUM1: 10, NUM2: rep('operator_divide', { v: { NUM1: 9, NUM2: 3 } }) } }) } })))), check: R => R.v(null, 'result') === 19 || R.v(null, 'result') },
    { name: 'divide by zero', sprite: wrap(flagScript(sayRes(rep('operator_divide', { v: { NUM1: 5, NUM2: 0 } })))), check: R => R.v(null, 'result') === Infinity || String(R.v(null, 'result')) },
    { name: 'text in math is 0', sprite: wrap(flagScript(sayRes(rep('operator_add', { v: { NUM1: 'abc', NUM2: 5 } })))), check: R => R.v(null, 'result') === 5 || R.v(null, 'result') },
    { name: 'pick random integers', sprite: wrap(flagScript(repeat(20, iff(not(eq(rep('operator_mod', { v: { NUM1: rand(1, 10), NUM2: 1 } }), 0)), sayRes('float!'))))), ms: 500, check: R => R.v(null, 'result') !== 'float!' || 'got a float' },
    { name: 'pick random floats', sprite: wrap(flagScript(sayRes(rep('operator_random', { v: { FROM: 0.5, TO: 0.6 } })))), check: R => { const v = R.v(null, 'result'); return v >= 0.5 && v <= 0.6 || v; } },
    { name: 'compare numbers and strings', sprite: wrap(flagScript(sayRes(rep('operator_join', { v: { STRING1: rep('operator_join', { v: { STRING1: bx(lt(2, 10)), STRING2: bx(gt('abc', 'ABB')) } }), STRING2: rep('operator_join', { v: { STRING1: bx(eq('ABC', 'abc')), STRING2: bx(eq('1', '01')) } }) } })))), check: R => R.v(null, 'result') === 'truetruetruetrue' || R.v(null, 'result') },
    { name: 'and / or / not', sprite: wrap(flagScript(sayRes(rep('operator_join', { v: { STRING1: rep('operator_and', { v: { OPERAND1: bool(lt(1, 2)), OPERAND2: bool(lt(2, 1)) } }), STRING2: rep('operator_join', { v: { STRING1: bx(or(lt(1, 2), lt(2, 1))), STRING2: bx(not(lt(1, 2))) } }) } })))), check: R => R.v(null, 'result') === 'falsetruefalse' || R.v(null, 'result') },
    { name: 'empty boolean input is false', sprite: wrap(flagScript(blk('control_if_else', { v: {}, s: { SUBSTACK: [sayRes('yes')], SUBSTACK2: [sayRes('no')] } }))), check: R => R.v(null, 'result') === 'no' || R.v(null, 'result') },
    { name: 'join / letter of / length / contains', sprite: wrap(flagScript(sayRes(rep('operator_join', { v: { STRING1: rep('operator_letter_of', { v: { LETTER: 2, STRING: 'apple' } }), STRING2: rep('operator_join', { v: { STRING1: rep('operator_length', { v: { STRING: 'apple' } }), STRING2: rep('operator_contains', { v: { STRING1: 'Apple', STRING2: 'PL' } }) } }) } })))), check: R => R.v(null, 'result') === 'p5true' || R.v(null, 'result') },
    { name: 'letter of out of range is empty', sprite: wrap(flagScript(sayRes(rep('operator_join', { v: { STRING1: 'x', STRING2: rep('operator_letter_of', { v: { LETTER: 9, STRING: 'apple' } }) } })))), check: R => R.v(null, 'result') === 'x' || R.v(null, 'result') },
    { name: 'mod with negatives', sprite: wrap(flagScript(sayRes(rep('operator_join', { v: { STRING1: rep('operator_mod', { v: { NUM1: -7, NUM2: 3 } }), STRING2: rep('operator_mod', { v: { NUM1: 7, NUM2: -3 } }) } })))), check: R => R.v(null, 'result') === '2-2' || R.v(null, 'result') },
    { name: 'round', sprite: wrap(flagScript(sayRes(rep('operator_join', { v: { STRING1: rep('operator_round', { v: { NUM: 2.5 } }), STRING2: rep('operator_round', { v: { NUM: -2.5 } }) } })))), check: R => R.v(null, 'result') === '3-2' || R.v(null, 'result') },
    { name: 'math ops', sprite: wrap(flagScript(sayRes(rep('operator_join', { v: { STRING1: rep('operator_mathop', { f: { OPERATOR: 'sqrt' }, v: { NUM: 16 } }), STRING2: rep('operator_join', { v: { STRING1: rep('operator_mathop', { f: { OPERATOR: 'sin' }, v: { NUM: 90 } }), STRING2: rep('operator_join', { v: { STRING1: rep('operator_mathop', { f: { OPERATOR: 'floor' }, v: { NUM: -1.5 } }), STRING2: rep('operator_mathop', { f: { OPERATOR: '10 ^' }, v: { NUM: 2 } }) } }) } }) } })))), check: R => R.v(null, 'result') === '41-2100' || R.v(null, 'result') },
    // ---------- variables & lists ----------
    { name: 'set / change variable', sprite: wrap(flagScript(setVar('v', 5), chVar('v', 2), sayRes(getVar('v')))), check: R => R.v(null, 'result') === 7 || R.v(null, 'result') },
    { name: 'change text variable by number', sprite: wrap(flagScript(setVar('v', 'hello'), chVar('v', 2), sayRes(getVar('v')))), check: R => R.v(null, 'result') === 2 || R.v(null, 'result') },
    { name: 'show variable makes a monitor', sprite: wrap(flagScript(blk('data_showvariable', { f: { VARIABLE: { name: 'v', id: 'v1' } } }))), check: R => R.monitors.some(m => m.name === 'v' && m.visible) || 'no monitor' },
    { name: 'lists: add, insert, replace, item, length', sprite: wrap(flagScript(list('data_deletealloflist', {}), list('data_addtolist', { v: { ITEM: 'a' } }), list('data_addtolist', { v: { ITEM: 'c' } }), list('data_insertatlist', { v: { ITEM: 'b', INDEX: 2 } }), list('data_replaceitemoflist', { v: { INDEX: 3, ITEM: 'z' } }), sayRes(rep('operator_join', { v: { STRING1: listRep('data_listcontents', {}), STRING2: rep('operator_join', { v: { STRING1: listRep('data_itemoflist', { v: { INDEX: 2 } }), STRING2: listRep('data_lengthoflist', {}) } }) } })))), check: R => R.v(null, 'result') === 'abzb3' || R.v(null, 'result') },
    { name: 'lists: delete, item #, contains, last', sprite: wrap(flagScript(list('data_deletealloflist', {}), list('data_addtolist', { v: { ITEM: 'x' } }), list('data_addtolist', { v: { ITEM: 'y' } }), list('data_addtolist', { v: { ITEM: 'q' } }), list('data_deleteoflist', { v: { INDEX: 1 } }), sayRes(rep('operator_join', { v: { STRING1: listRep('data_itemnumoflist', { v: { ITEM: 'Q' } }), STRING2: rep('operator_join', { v: { STRING1: listRep('data_listcontainsitem', { v: { ITEM: 'y' } }), STRING2: listRep('data_itemoflist', { v: { INDEX: 'last' } }) } }) } })))), check: R => R.v(null, 'result') === '2trueq' || R.v(null, 'result') },
    { name: 'list contents joins words with spaces', sprite: wrap(flagScript(list('data_deletealloflist', {}), list('data_addtolist', { v: { ITEM: 'hi' } }), list('data_addtolist', { v: { ITEM: 'there' } }), sayRes(listRep('data_listcontents', {})))), check: R => R.v(null, 'result') === 'hi there' || R.v(null, 'result') },
    // ---------- my blocks ----------
    { name: 'custom block with inputs', sprite: '', check: R => R.v(null, 'result') === 42 || `r=${R.v(null, 'result')}` },
    { name: 'run without screen refresh (warp) finishes in one frame', sprite: wrap(`<block type="procedures_definition" x="0" y="500"><statement name="custom_block"><shadow type="procedures_prototype"><mutation proccode="loop" argumentids='[]' argumentnames='[]' argumentdefaults='[]' warp="true"></mutation></shadow></statement><next>${repeat(200, chVar('result', 1, 'res')).xml.replace('__NEXT__', '')}</next></block>` + flagScript({ xml: `<block type="procedures_call"><mutation proccode="loop" argumentids='[]' warp="true"></mutation>__NEXT__</block>` })), ms: 40, check: R => R.v(null, 'result') === 200 || `r=${R.v(null, 'result')}` }
  ];
  // fix up the custom-block call case (needs a mutation element) — rebuild it explicitly
  CASES.find(c => c.name === 'custom block with inputs').sprite = wrap(`<block type="procedures_definition" x="0" y="500"><statement name="custom_block"><shadow type="procedures_prototype"><mutation proccode="add %s and %s" argumentids='["a1","a2"]' argumentnames='["x","y"]' argumentdefaults='["",""]' warp="false"></mutation></shadow></statement><next>${sayRes(rep('operator_add', { v: { NUM1: rep('argument_reporter_string_number', { f: { VALUE: 'x' } }), NUM2: rep('argument_reporter_string_number', { f: { VALUE: 'y' } }) } })).xml.replace('__NEXT__', '')}</next></block>` +
    flagScript({ xml: `<block type="procedures_call"><mutation proccode="add %s and %s" argumentids='["a1","a2"]' warp="false"></mutation><value name="a1"><shadow type="text"><field name="TEXT">20</field></shadow></value><value name="a2"><shadow type="text"><field name="TEXT">22</field></shadow></value>__NEXT__</block>` }));

  async function run(filter) {
    const E = window.SparkEditor, R = E.R; const results = [];
    const down = k => window.dispatchEvent(new KeyboardEvent('keydown', { key: k })), up = k => window.dispatchEvent(new KeyboardEvent('keyup', { key: k }));
    for (const c of CASES) {
      if (filter && !c.name.includes(filter)) continue;
      let status;
      try {
        E.loadProject(project(c.sprite, c.others || [], c.stage || wrap()));
        if (c.hold) down(c.hold);
        R.greenFlag();
        if (c.key) { await new Promise(r => setTimeout(r, 50)); down(c.key); up(c.key); }
        await new Promise(r => setTimeout(r, c.ms || 120));
        if (c.hold) up(c.hold);
        const S = R.findTarget(null, 'Sprite1');
        const res = c.check(R, S);
        status = res === true ? 'ok' : 'FAIL: ' + res;
        R.stopAll();
      } catch (e) { status = 'ERROR: ' + e.message; }
      results.push({ name: c.name, status });
      console.log((status === 'ok' ? '✅ ' : '❌ ') + c.name + (status === 'ok' ? '' : ' — ' + status));
    }
    const failed = results.filter(r => r.status !== 'ok');
    console.log(`Self-test: ${results.length - failed.length}/${results.length} passed`);
    window.SparkSelfTest.results = results;
    return { passed: results.length - failed.length, total: results.length, failed };
  }
  window.SparkSelfTest = { run, CASES };
  if (location.search.includes('selftest')) setTimeout(() => run(), 500);
})();
