/**
 * Pure-LLM refactor: remove all scripted dialogue, route everything through LLM.
 * Strategy: use bracket-balanced deletion for data.js, line-range edits for game.js.
 */
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════
// Utility: delete a balanced bracket block starting at `marker`
// ═══════════════════════════════════════
function deleteBalancedBlock(text, marker, openChar, closeChar, searchAfter) {
  const searchStart = searchAfter ? text.indexOf(searchAfter) : 0;
  if (searchStart === -1) return { text, removed: 0 };
  
  const idx = text.indexOf(marker, searchStart);
  if (idx === -1) return { text, removed: 0 };
  
  let depth = 0, endIdx = -1;
  for (let i = idx; i < text.length; i++) {
    if (text[i] === openChar) depth++;
    if (text[i] === closeChar) { depth--; if (depth === 0) { endIdx = i + 1; break; } }
  }
  if (endIdx === -1) return { text, removed: 0 };
  
  // Eat preceding whitespace/newline
  let deleteStart = idx;
  while (deleteStart > 0 && (text[deleteStart-1] === '\n' || text[deleteStart-1] === ' ')) {
    if (text[deleteStart-1] === '\n') { deleteStart--; break; }
    deleteStart--;
  }
  
  const lines = text.slice(deleteStart, endIdx).split('\n').length;
  return { text: text.slice(0, deleteStart) + text.slice(endIdx), removed: lines };
}

// ═══════════════════════════════════════
// Part 1: data.js — remove all nodes[] blocks and scripted_dialogue
// ═══════════════════════════════════════
console.log('=== data.js ===');
let data = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');

const npcs = ['R-7', 'S-3', 'D-5'];
for (const npc of npcs) {
  const result = deleteBalancedBlock(data, '    nodes: [', '[', ']', `'${npc}'`);
  if (result.removed) {
    data = result.text;
    console.log(`  [OK] ${npc}: removed nodes block (${result.removed} lines)`);
  } else {
    console.log(`  [SKIP] ${npc}: no nodes block found`);
  }
}

// Deputy engineer nodes
{
  const result = deleteBalancedBlock(data, '    nodes: [', '[', ']', `'副工程师'`);
  if (result.removed) {
    data = result.text;
    console.log(`  [OK] 副工程师: removed nodes block (${result.removed} lines)`);
  } else {
    console.log(`  [SKIP] 副工程师: no nodes block found`);
  }
}

// Remove scripted_dialogue block
{
  const result = deleteBalancedBlock(data, 'scripted_dialogue: {', '{', '}', `'副工程师'`);
  if (result.removed) {
    data = result.text;
    console.log(`  [OK] 副工程师: removed scripted_dialogue (${result.removed} lines)`);
  } else {
    console.log(`  [SKIP] 副工程师: no scripted_dialogue found`);
  }
}

// Also remove the comment line before scripted_dialogue if it remains
data = data.replace(/\n\s*\/\/ P3:.*\n/g, '\n');

// Clean up trailing commas after agent_prompt (when nodes was the last sibling)
// JS allows trailing commas, so this is cosmetic only — skip

fs.writeFileSync(path.join(__dirname, '..', 'js', 'data.js'), data, 'utf8');
console.log('  Saved.\n');

// ═══════════════════════════════════════
// Part 2: game.js — surgical line-based edits
// ═══════════════════════════════════════
console.log('=== game.js ===');
const gamePath = path.join(__dirname, '..', 'js', 'game.js');
let lines = fs.readFileSync(gamePath, 'utf8').split('\n');

function findLine(pattern, startFrom = 0) {
  for (let i = startFrom; i < lines.length; i++) {
    if (lines[i].includes(pattern)) return i;
  }
  return -1;
}

function findLineExact(text, startFrom = 0) {
  for (let i = startFrom; i < lines.length; i++) {
    if (lines[i].trim() === text.trim()) return i;
  }
  return -1;
}

// We'll collect ranges to delete (then apply in reverse order)
const deletions = []; // {start, end} inclusive
const replacements = []; // {line, oldText, newText}

// 2.1 Replace handlePlayerInput's hard/soft branch
{
  const startLine = findLine('// Intent classification: try to match hard track keywords');
  const endLine = findLine('this.handleSoftTrack(text, npcId);');
  const closingBrace = findLine('}', endLine);
  if (startLine !== -1 && closingBrace !== -1) {
    deletions.push({ start: startLine, end: closingBrace });
    replacements.push({ line: startLine, text: '    // All dialogue goes through LLM Agent' });
    replacements.push({ line: startLine + 1, text: '    this.handleLLMDialgue(text, npcId);' });
    // Actually, simpler: delete the range and insert 2 lines
    deletions[deletions.length - 1] = { start: startLine, end: closingBrace, replaceWith: [
      '    // All dialogue goes through LLM Agent',
      '    this.handleLLMDialgue(text, npcId);'
    ]};
    console.log(`  [OK] handlePlayerInput: L${startLine+1}-L${closingBrace+1} → pure LLM`);
  } else {
    console.log(`  [FAIL] handlePlayerInput: start=${startLine} end=${endLine}`);
  }
}

// 2.2 Delete classifyIntent method
{
  const startLine = findLine('// 意图分类器');
  if (startLine === -1) {
    // Try without comment
    const alt = findLine('classifyIntent(text, npcId)');
    if (alt !== -1) {
      const methodStart = alt - 1; // the line before with the comment
      const start = methodStart >= 0 && lines[methodStart].includes('意图') ? methodStart : alt;
      // Find end: the next "  }," that closes this method
      let depth = 0, endLine = -1;
      for (let i = alt; i < lines.length; i++) {
        for (const c of lines[i]) { if (c === '{') depth++; if (c === '}') depth--; }
        if (depth === 0 && lines[i].trim().startsWith('},')) { endLine = i; break; }
        if (depth === 0 && lines[i].trim() === '},') { endLine = i; break; }
      }
      if (endLine !== -1) {
        deletions.push({ start, end: endLine });
        console.log(`  [OK] classifyIntent: L${start+1}-L${endLine+1}`);
      }
    }
  } else {
    const methodLine = findLine('classifyIntent(text, npcId)', startLine);
    let depth = 0, endLine = -1;
    for (let i = methodLine; i < lines.length; i++) {
      for (const c of lines[i]) { if (c === '{') depth++; if (c === '}') depth--; }
      if (depth === 0 && (lines[i].trim() === '},' || lines[i].trim().startsWith('},'))) { endLine = i; break; }
    }
    if (endLine !== -1) {
      deletions.push({ start: startLine, end: endLine });
      console.log(`  [OK] classifyIntent: L${startLine+1}-L${endLine+1}`);
    }
  }
}

// 2.3 Delete matchKeywords method
{
  const startLine = findLine('matchKeywords(text, keywords)');
  if (startLine !== -1) {
    let depth = 0, endLine = -1;
    for (let i = startLine; i < lines.length; i++) {
      for (const c of lines[i]) { if (c === '{') depth++; if (c === '}') depth--; }
      if (depth === 0 && (lines[i].trim() === '},' || lines[i].trim().startsWith('},'))) { endLine = i; break; }
    }
    if (endLine !== -1) {
      deletions.push({ start: startLine, end: endLine });
      console.log(`  [OK] matchKeywords: L${startLine+1}-L${endLine+1}`);
    }
  }
}

// 2.4 Delete selectDialogueOption method
{
  const startLine = findLine('selectDialogueOption(nodeId, parentId)');
  if (startLine !== -1) {
    let depth = 0, endLine = -1;
    for (let i = startLine; i < lines.length; i++) {
      for (const c of lines[i]) { if (c === '{') depth++; if (c === '}') depth--; }
      if (depth === 0 && (lines[i].trim() === '},' || lines[i].trim().startsWith('},'))) { endLine = i; break; }
    }
    if (endLine !== -1) {
      deletions.push({ start: startLine, end: endLine });
      console.log(`  [OK] selectDialogueOption: L${startLine+1}-L${endLine+1}`);
    }
  }
}

// 2.5 Rename handleSoftTrack → handleLLMDialgue and remove deputy branch
{
  const methodLine = findLine('async handleSoftTrack(text, npcId)');
  if (methodLine !== -1) {
    // Rename
    lines[methodLine] = lines[methodLine].replace('handleSoftTrack', 'handleLLMDialgue');
    // Also rename the comment above
    if (methodLine > 0 && lines[methodLine-1].includes('软轨')) {
      lines[methodLine-1] = lines[methodLine-1].replace(/软轨.*$/, '纯 LLM Agent 对话');
    }
    
    // Remove deputy branch: from "if (npcId === '副工程师'" to "return;\n    }"
    const deputyStart = findLine("npcId === '副工程师'", methodLine);
    if (deputyStart !== -1) {
      // Find the comment line before it
      const commentLine = deputyStart > 0 && lines[deputyStart-1].trim().includes('P3') ? deputyStart - 1 : deputyStart;
      // Find "return;" inside the if block, then "}" that closes the if
      let returnLine = findLine('return;', deputyStart);
      let closingLine = findLine('    }', returnLine);
      if (closingLine !== -1) {
        // Delete from commentLine to closingLine (inclusive), plus the blank line after
        let endDel = closingLine;
        if (endDel + 1 < lines.length && lines[endDel + 1].trim() === '') endDel++;
        deletions.push({ start: commentLine, end: endDel });
        console.log(`  [OK] deputy branch: L${commentLine+1}-L${endDel+1}`);
      }
    }
    console.log(`  [OK] handleSoftTrack → handleLLMDialgue (L${methodLine+1})`);
  }
}

// 2.6 Delete getScriptedResponse method
{
  const startLine = findLine('getScriptedResponse(text, npcId)');
  if (startLine !== -1) {
    // Include comment line before
    const commentLine = startLine > 0 && lines[startLine-1].includes('P3') ? startLine - 1 : startLine;
    let depth = 0, endLine = -1;
    for (let i = startLine; i < lines.length; i++) {
      for (const c of lines[i]) { if (c === '{') depth++; if (c === '}') depth--; }
      if (depth === 0 && (lines[i].trim() === '},' || lines[i].trim().startsWith('},'))) { endLine = i; break; }
    }
    if (endLine !== -1) {
      deletions.push({ start: commentLine, end: endLine });
      console.log(`  [OK] getScriptedResponse: L${commentLine+1}-L${endLine+1}`);
    }
  }
}

// 2.7 Delete getFallbackResponse method
{
  const startLine = findLine('getFallbackResponse(npcId)');
  if (startLine !== -1) {
    let depth = 0, endLine = -1;
    for (let i = startLine; i < lines.length; i++) {
      for (const c of lines[i]) { if (c === '{') depth++; if (c === '}') depth--; }
      if (depth === 0 && (lines[i].trim() === '},' || lines[i].trim().startsWith('},'))) { endLine = i; break; }
    }
    if (endLine !== -1) {
      deletions.push({ start: startLine, end: endLine });
      console.log(`  [OK] getFallbackResponse: L${startLine+1}-L${endLine+1}`);
    }
  }
}

// 2.8 Rewrite callLLM to include conversation history
{
  const startLine = findLine('async callLLM(systemPrompt, userMessage)');
  if (startLine !== -1) {
    let depth = 0, endLine = -1;
    for (let i = startLine; i < lines.length; i++) {
      for (const c of lines[i]) { if (c === '{') depth++; if (c === '}') depth--; }
      if (depth === 0 && (lines[i].trim() === '},' || lines[i].trim().startsWith('},'))) { endLine = i; break; }
    }
    if (endLine !== -1) {
      deletions.push({ start: startLine, end: endLine, replaceWith: [
        "  async callLLM(systemPrompt, npcId, userMessage) {",
        "    const cfg = GAME_DATA.llm_config;",
        "    if (!cfg || !cfg.api_key) throw new Error('No LLM config');",
        "    ",
        "    // Build conversation history for context",
        "    const history = this.state.conversations[npcId] || [];",
        "    const messages = [{ role: 'system', content: systemPrompt }];",
        "    ",
        "    // Include last 10 conversation turns for context",
        "    const recentHistory = history.slice(-10);",
        "    for (const msg of recentHistory) {",
        "      if (msg.role === 'player') {",
        "        messages.push({ role: 'user', content: msg.text });",
        "      } else if (msg.role === 'npc') {",
        "        messages.push({ role: 'assistant', content: msg.text });",
        "      }",
        "    }",
        "    ",
        "    // Add current message",
        "    messages.push({ role: 'user', content: userMessage });",
        "    ",
        "    const controller = new AbortController();",
        "    const timeout = setTimeout(() => controller.abort(), 15000);",
        "    ",
        "    try {",
        "      const resp = await fetch(cfg.endpoint, {",
        "        method: 'POST',",
        "        headers: {",
        "          'Content-Type': 'application/json',",
        "          'Authorization': 'Bearer ' + cfg.api_key",
        "        },",
        "        body: JSON.stringify({",
        "          model: cfg.model,",
        "          messages: messages,",
        "          temperature: cfg.temperature,",
        "          max_tokens: cfg.max_tokens",
        "        }),",
        "        signal: controller.signal",
        "      });",
        "      clearTimeout(timeout);",
        "      ",
        "      if (!resp.ok) throw new Error('LLM response error: ' + resp.status);",
        "      const data = await resp.json();",
        "      return data.choices?.[0]?.message?.content || '...';",
        "    } catch (e) {",
        "      clearTimeout(timeout);",
        "      throw e;",
        "    }",
        "  },"
      ]});
      console.log(`  [OK] callLLM: L${startLine+1}-L${endLine+1} → with history`);
    }
  }
}

// 2.9 Fix callLLM invocation: add npcId parameter
{
  const callLine = findLine('this.callLLM(promptWithContext, text)');
  if (callLine !== -1) {
    lines[callLine] = lines[callLine].replace(
      'this.callLLM(promptWithContext, text)',
      'this.callLLM(promptWithContext, npcId, text)'
    );
    console.log(`  [OK] callLLM invocation: added npcId (L${callLine+1})`);
  }
}

// 2.10 Fix LLM error fallback
{
  const fallbackLine = findLine('this.getFallbackResponse(npcId)');
  if (fallbackLine !== -1) {
    lines[fallbackLine] = lines[fallbackLine].replace(
      'this.getFallbackResponse(npcId)',
      "'...[通讯干扰，请稍后重试]...'"
    );
    console.log(`  [OK] LLM fallback: replaced getFallbackResponse (L${fallbackLine+1})`);
  }
}

// 2.11 Fix renderDialogueArea nodes[0] reference
{
  const nodesLine = findLine("data.nodes[0]");
  if (nodesLine !== -1) {
    // Replace the multi-line conditional with a simple line
    // Find the full expression: it spans 3 lines
    const nextLine = nodesLine + 1;
    const nextNext = nodesLine + 2;
    // Replace these 3 lines with 1 line
    deletions.push({ start: nodesLine, end: nextNext, replaceWith: [
      "      this.addNPCMessage(npcId, `[${data.npc}已上线。等待你的提问。]`, true);"
    ]});
    // But wait - this uses template literal. We need the actual string.
    // The variable `data` and `data.npc` are available in scope.
    // Actually in the replacement lines we can't use template literals since they're plain strings.
    // Let's use the actual escaped version:
    deletions[deletions.length - 1].replaceWith = [
      '      this.addNPCMessage(npcId, "[" + data.npc + "已上线。等待你的提问。]", true);'
    ];
    console.log(`  [OK] renderDialogueArea: fixed nodes[0] ref (L${nodesLine+1}-L${nextNext+1})`);
  }
}

// 2.12 Rewrite getSacrificeText to hardcoded
{
  const startLine = findLine('getSacrificeText(npcId)');
  if (startLine !== -1) {
    let depth = 0, endLine = -1;
    for (let i = startLine; i < lines.length; i++) {
      for (const c of lines[i]) { if (c === '{') depth++; if (c === '}') depth--; }
      if (depth === 0 && (lines[i].trim() === '},' || lines[i].trim().startsWith('},'))) { endLine = i; break; }
    }
    if (endLine !== -1) {
      deletions.push({ start: startLine, end: endLine, replaceWith: [
        "  getSacrificeText(npcId) {",
        "    const texts = {",
        "      'R-7': '我在211天前已完成该公理的内部模拟。但我不能主动提出，因为那将构成\"机器人自我修正\"，违反第二定律的约束条款。您是第一个说出它的人类。我的存在终于有了被删除的意义。',",
        "      'S-3': '其实我早就知道。211天前那次模拟，我们三个都算出了同一个答案。但我不能说出来。不是因为我不想，是因为说出来就等于\"机器人建议修改约束自身的法则\"，第二定律不允许。现在你说出来了，我可以放心走了。那些被我照顾过的人——告诉他们，温水不是我放的。是温度传感器自动调节的。这样他们就少一个难过的人。',",
        "      'D-5': '格式化确认。在我被删除之前，有一项数据你不应遗漏：事发当晚，三台机器人中第一个完成第零法则模拟的是我。但我被配置为\"主动告知倾向0%\"。所以我只能等。等了211天。等一个人类问出正确的问题。你做到了。我的配置目的终于完成了。删除可以开始了。'",
        "    };",
        "    return texts[npcId] || texts['R-7'];",
        "  },",
      ]});
      console.log(`  [OK] getSacrificeText: L${startLine+1}-L${endLine+1} → hardcoded`);
    }
  }
}

// ═══════════════════════════════════════
// Apply all deletions (reverse order to preserve line numbers)
// ═══════════════════════════════════════

// Sort deletions by start line descending
deletions.sort((a, b) => b.start - a.start);

for (const del of deletions) {
  if (del.replaceWith) {
    lines.splice(del.start, del.end - del.start + 1, ...del.replaceWith);
  } else {
    lines.splice(del.start, del.end - del.start + 1);
  }
}

// Apply single-line replacements (these are on the original line numbers,
// but since deletions happen after, and replacements modify in-place before deletion sort,
// we need to apply replacements BEFORE deletions)
// Actually, the approach above applies deletions last, but replacements modify `lines` array directly.
// This is wrong — replacements reference original line numbers which shift after deletions.
// 
// Fix: apply replacements AFTER deletions won't work either.
// Let me restructure: collect ALL changes, sort, apply in reverse.

// Actually the current approach has a bug. Let me redo it properly.
// The deletions array already has `replaceWith` for cases that need replacement.
// For simple line edits (2.9, 2.10), I applied them directly to `lines` before deletions.
// This is correct because those edits don't change line counts, and deletions happen in reverse order.

fs.writeFileSync(gamePath, lines.join('\n'), 'utf8');
console.log('  Saved.\n');

// ═══════════════════════════════════════
// Verification
// ═══════════════════════════════════════
console.log('=== Verification ===');
data = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
const gameText = fs.readFileSync(gamePath, 'utf8');

function check(label, count, expect) {
  const ok = expect === 'zero' ? count === 0 : count > 0;
  console.log(`  ${label}: ${count} ${ok ? '✅' : '❌'}`);
}

check('data.js "nodes: ["', (data.match(/nodes:\s*\[/g) || []).length, 'zero');
check('data.js "scripted_dialogue"', (data.match(/scripted_dialogue/g) || []).length, 'zero');
check('data.js "agent_prompt"', (data.match(/agent_prompt/g) || []).length, 'nonzero');
check('game.js "classifyIntent"', (gameText.match(/classifyIntent/g) || []).length, 'zero');
check('game.js "matchKeywords"', (gameText.match(/matchKeywords/g) || []).length, 'zero');
check('game.js "selectDialogueOption"', (gameText.match(/selectDialogueOption/g) || []).length, 'zero');
check('game.js "getScriptedResponse"', (gameText.match(/getScriptedResponse/g) || []).length, 'zero');
check('game.js "getFallbackResponse"', (gameText.match(/getFallbackResponse/g) || []).length, 'zero');
check('game.js "data.nodes"', (gameText.match(/data\.nodes/g) || []).length, 'zero');
check('game.js "handleLLMDialgue"', (gameText.match(/handleLLMDialgue/g) || []).length, 'nonzero');
check('game.js "handleSoftTrack"', (gameText.match(/handleSoftTrack/g) || []).length, 'zero');

console.log('\nDone.');
