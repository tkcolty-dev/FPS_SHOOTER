const { getGenAIConfig } = require('./config');

async function generateClues(murdererName, allPlayerNames, maxRounds, playerCount) {
  const config = getGenAIConfig();
  if (config) {
    try {
      return await generateAIClues(config, murdererName, allPlayerNames, maxRounds);
    } catch (err) {
      console.error('[Clues] AI generation failed, using fallback:', err.message);
    }
  }
  return null; // Let game.js handle fallback
}

async function generateAIClues(config, murdererName, allPlayerNames, maxRounds) {
  const playerList = allPlayerNames.map((n, i) => `${i + 1}. ${n}`).join('\n');

  const prompt = `You are a mystery writer creating an immersive murder mystery investigation game.

The murderer is "${murdererName}". The other players are detectives.

All players:
${playerList}

Create a complete murder mystery case with ${maxRounds} rounds of investigation. Each round, EVERY player receives their own personal clue.

IMPORTANT RULES:
- Clues for detectives should GRADUALLY point toward "${murdererName}" being the killer
- Early rounds (1-3): vague, atmospheric clues. Set the scene, establish the crime
- Middle rounds (4-6): more specific clues with indirect hints (name letters, position, behavioral patterns)
- Late rounds (7-${maxRounds}): strong evidence that makes the killer identifiable if clues are combined
- The MURDERER also receives clues, but theirs should be misleading — pointing at other players or providing false leads they can share to deflect suspicion
- Each clue should be 2-4 sentences, written in a noir mystery style
- NEVER directly state the murderer's name in any clue

Clue types to use (vary them):
- witness_statement: Testimony from a witness
- forensic_report: Lab results, DNA, fingerprints
- personal_letter: Found correspondence
- newspaper_clipping: Related news story
- crime_scene_note: Physical evidence observation
- phone_record: Call or text logs
- photograph: Description of a photo found
- autopsy_note: Medical examiner findings

Return ONLY valid JSON in this exact format:
{
  "caseName": "The [Creative Case Title]",
  "caseIntro": "A 2-3 sentence dramatic introduction setting the scene of the murder.",
  "rounds": [
    {
      "${allPlayerNames[0]}": [{"type": "witness_statement", "title": "Witness Statement", "text": "clue text..."}],
      "${allPlayerNames[1]}": [{"type": "forensic_report", "title": "Forensic Report", "text": "clue text..."}]
    }
  ]
}

Generate ALL ${maxRounds} rounds with clues for ALL ${allPlayerNames.length} players.`;

  const url = config.apiBase.replace(/\/$/, '') + '/chat/completions';
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.85,
      max_tokens: 8000
    })
  });

  if (!resp.ok) throw new Error(`AI API ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const content = data.choices[0].message.content;

  // Extract JSON
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in AI response');
  return JSON.parse(jsonMatch[0]);
}

module.exports = { generateClues };
