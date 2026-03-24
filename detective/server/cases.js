/* ============================================
   WHODUNIT - CASE TEMPLATES & PUZZLE ENGINE
   ============================================ */

const CASE_TEMPLATES = [
  {
    title: 'The Blackwood Manor Affair',
    subtitle: 'A wealthy art collector found dead in his study',
    setting: 'Blackwood Manor, Autumn 1962',
    crimeDescription: 'Arthur Blackwood, 68, was found dead in his locked study at Blackwood Manor on the evening of October 14th, 1962. The renowned art collector appeared to have been poisoned -- a half-empty glass of brandy sat on his desk. The door was locked from the inside, and the only window was latched shut. His will, recently amended, was found torn on the floor beside him.',
    victim: { name: 'Arthur Blackwood', description: 'Wealthy art collector and patriarch of the Blackwood family. Age 68. Found dead in his locked study.' },
    suspects: [
      { id: 'margaret', name: 'Lady Margaret Blackwood', occupation: 'Estate Owner', relationship: 'Victim\'s wife of 30 years', alibi: 'Claims she was hosting guests in the drawing room all evening', motive: 'Inheritance -- stood to gain the entire estate', isGuilty: false },
      { id: 'edward', name: 'Edward Blackwood', occupation: 'Art Dealer', relationship: 'Victim\'s eldest son', alibi: 'Says he was in the library reading until 9 PM', motive: 'Was recently cut from the will after a business dispute', isGuilty: true },
      { id: 'helena', name: 'Dr. Helena Cross', occupation: 'Family Physician', relationship: 'Blackwood family doctor for 15 years', alibi: 'Claims she arrived at the manor at 8:30 PM for a routine checkup', motive: 'Arthur discovered she had been falsifying medical bills', isGuilty: false },
      { id: 'harris', name: 'James Harris', occupation: 'Butler', relationship: 'Head of household staff for 20 years', alibi: 'States he was preparing evening drinks in the kitchen', motive: 'Had been threatened with dismissal', isGuilty: false },
      { id: 'vivian', name: 'Vivian LaRoux', occupation: 'Art Appraiser', relationship: 'Business associate and rumored romantic interest', alibi: 'Says she left the manor at 7 PM before dinner', motive: 'Arthur threatened to expose her involvement in art forgery', isGuilty: false }
    ],
    acts: [
      {
        title: 'The Crime Scene',
        intro: 'You arrive at Blackwood Manor to find the household in chaos. The police have sealed off the study. Begin your investigation by examining the initial evidence.',
        documents: [
          { id: 'doc-1-1', type: 'forensic_report', title: 'Autopsy Report -- Arthur Blackwood', content: 'Cause of death: acute cyanide poisoning. Time of death estimated between 8:00 PM and 9:00 PM. Traces of potassium cyanide found in stomach contents consistent with oral ingestion. The brandy glass on the desk tested positive for cyanide residue.\n\nNote: Cyanide acts rapidly. Death would have occurred within 5-15 minutes of ingestion. The victim showed signs of convulsion consistent with cyanide poisoning.', author: 'Dr. Morrison, County Coroner', date: 'October 15, 1962' },
          { id: 'doc-1-2', type: 'witness_statement', title: 'Statement of James Harris, Butler', content: 'I prepared Mr. Blackwood\'s evening brandy at approximately 7:45 PM as I do every night. I brought it to his study on a silver tray. He was working at his desk and seemed agitated. He told me he expected a visitor at 8 PM and asked not to be disturbed.\n\nI returned to the kitchen to prepare the evening meal. At approximately 9:15 PM, I went to collect the glass and found the study door locked. After receiving no response to my knocking, I fetched the spare key. That is when I discovered Mr. Blackwood.\n\nI should note that the brandy was poured from a sealed bottle. No one else was in the kitchen when I prepared it.', author: 'James Harris', date: 'October 14, 1962' },
          { id: 'doc-1-3', type: 'crime_scene_note', title: 'Crime Scene Inventory', content: 'Study, ground floor, east wing:\n- Body found slumped in desk chair\n- Half-empty brandy glass on desk (tested positive for cyanide)\n- Sealed brandy bottle on side table (tested NEGATIVE for cyanide)\n- Torn document on floor (identified as recent will amendment)\n- Desk drawer open -- personal correspondence visible\n- Window latched from inside\n- Door locked from inside with key in lock\n- Small glass vial found in wastepaper basket (traces of cyanide)\n- Fireplace recently used -- charred paper fragments present', author: 'Det. Inspector Walsh', date: 'October 14, 1962' },
          { id: 'doc-1-4', type: 'witness_statement', title: 'Statement of Lady Margaret Blackwood', content: 'My husband had been on edge for weeks. He told me he was amending his will but would not tell me the specifics. We had guests for dinner -- Dr. Cross arrived around 8:30 to check on Arthur\'s heart condition.\n\nI was in the drawing room the entire evening with our neighbor Mrs. Patterson, who can confirm this. I heard nothing unusual from the study. It was Harris who raised the alarm.\n\nEdward arrived earlier that afternoon. He and his father had a terrible row around 6 PM. I could hear shouting from the study. Edward left the study looking furious and went to the library.', author: 'Lady Margaret Blackwood', date: 'October 14, 1962' },
          { id: 'doc-1-5', type: 'newspaper_clipping', title: 'Evening Herald -- Blackwood Collection Under Scrutiny', content: 'LONDON -- Questions continue to surround the authenticity of several pieces in the famed Blackwood Collection. Art appraiser Vivian LaRoux, who authenticated three paintings purchased last year for a combined 50,000 pounds, has declined to comment on allegations that the works may be sophisticated forgeries.\n\nArthur Blackwood was reportedly furious upon learning of the potential fraud and had threatened legal action against all parties involved, including his own son Edward, who brokered the purchases through his dealership.', author: 'Evening Herald', date: 'October 10, 1962' }
        ],
        puzzles: [
          { id: 'puzzle-1-1', type: 'contradiction', title: 'The Impossible Poisoning', description: 'The brandy bottle tested negative for cyanide, but the glass tested positive. The butler says he poured from a sealed bottle and no one else was in the kitchen. How did the cyanide get into the glass?\n\nLook at the crime scene inventory carefully. What item explains how the poison was administered?', hints: ['Look at what was found in the wastepaper basket.', 'A small glass vial with cyanide traces was found in the study itself.', 'The poison was added to the glass AFTER it was brought to the study -- by someone who visited Arthur.'], answer: 'vial', alternateAnswers: ['glass vial', 'the vial', 'vial in wastepaper basket', 'vial in the bin', 'small glass vial'], maxAttempts: 6, difficulty: 'easy', puzzleData: { question: 'What item found at the crime scene explains how the cyanide got into the glass after the butler served it?' }, revealOnSolve: 'The small glass vial in the wastepaper basket contained cyanide residue. Someone who visited Arthur in his study between 7:45 PM and 9:00 PM added poison directly to his glass.' },
          { id: 'puzzle-1-2', type: 'timeline', title: 'Window of Opportunity', description: 'Based on the statements and forensic evidence, determine who had the opportunity to visit Arthur in his study during the critical window.\n\nThe butler served brandy at 7:45 PM. Arthur expected a visitor at 8 PM. Death occurred between 8-9 PM. Dr. Cross arrived at 8:30 PM. Margaret was in the drawing room.', hints: ['Arthur told Harris he expected a visitor at 8 PM. Who would he have been expecting?', 'Edward had a fight with Arthur at 6 PM. Margaret says Edward went to the library. But did he stay there?', 'The visitor at 8 PM arrived BEFORE Dr. Cross at 8:30. Who had a reason to return to the study?'], answer: 'edward', alternateAnswers: ['edward blackwood', 'the son', 'his son'], maxAttempts: 6, difficulty: 'easy', puzzleData: { question: 'Who was most likely the visitor Arthur expected at 8 PM?' }, revealOnSolve: 'Edward Blackwood, who had fought with his father at 6 PM, likely returned to the study at 8 PM -- perhaps to continue the argument. He had both motive and opportunity.' },
          { id: 'puzzle-1-3', type: 'cross_reference', title: 'The Torn Will', description: 'Arthur\'s torn will was found on the floor. The newspaper article mentions the art forgery scandal involving both Edward and Vivian LaRoux.\n\nWhat was Arthur likely changing in his will, and why was it torn?', hints: ['The newspaper says Arthur was furious about the forgery involving Edward.', 'Margaret says Arthur was amending his will but would not say the details. Edward and Arthur fought about something.', 'Arthur was cutting Edward out of the will because of the art fraud. The will was torn by someone who did not want that change.'], answer: 'cutting edward out', alternateAnswers: ['removing edward', 'disinherit edward', 'cut edward out', 'disinheriting edward', 'edward removed from will', 'edward cut from will'], maxAttempts: 6, difficulty: 'medium', puzzleData: { question: 'What change was Arthur making to his will?' }, revealOnSolve: 'Arthur was cutting Edward out of his will over the art forgery scandal. The torn document was likely destroyed by Edward himself during their confrontation.' }
        ]
      },
      {
        title: 'The Investigation Deepens',
        intro: 'New evidence has surfaced. Financial records, a hidden letter, and witness testimony reveal darker secrets within the Blackwood household.',
        documents: [
          { id: 'doc-2-1', type: 'financial_record', title: 'Blackwood Estate Financial Summary', content: 'Prepared by Hargreaves & Son, Solicitors\n\nTotal estate value: approximately 2.3 million pounds\nPrimary beneficiary (original will): Edward Blackwood -- 60%\nSecondary beneficiary: Lady Margaret Blackwood -- 30%\nCharity bequest: 10%\n\nAMENDED WILL (dated October 12, 1962 -- unsigned):\nPrimary beneficiary: Lady Margaret Blackwood -- 70%\nSecondary beneficiary: National Gallery Trust -- 25%\nEdward Blackwood: REMOVED entirely\nNote: "My son has brought shame upon this family through his involvement in criminal fraud. He shall receive nothing."', author: 'Hargreaves & Son, Solicitors', date: 'October 12, 1962' },
          { id: 'doc-2-2', type: 'letter', title: 'Unsent Letter Found in Arthur\'s Desk', content: 'Dear Inspector Walsh,\n\nI write to you with a heavy heart. I have reason to believe that my son Edward, along with the art appraiser Vivian LaRoux, has been systematically defrauding me through the purchase of forged artworks. The total losses may exceed 50,000 pounds.\n\nI intend to press charges. I have secured evidence which I keep in the safe behind the painting in my study. The combination is known only to myself.\n\nI fear that Edward may become desperate when he learns of my intentions. He has always had a violent temper, and I am not a young man.\n\nYours faithfully,\nArthur Blackwood\n\nP.S. - The safe combination is the year of my wedding: 1932.', author: 'Arthur Blackwood', date: 'October 13, 1962' },
          { id: 'doc-2-3', type: 'witness_statement', title: 'Statement of Mrs. Patterson, Neighbor', content: 'I was having dinner with Lady Margaret at Blackwood Manor. I arrived at 7 PM. Margaret and I were in the drawing room the entire evening. She never left my sight.\n\nAt approximately 7:55 PM, I saw Edward walk past the drawing room door toward the east wing -- toward the study. He did not acknowledge us. Margaret called out to him but he did not respond.\n\nLater, around 8:20 PM, I heard what sounded like raised voices from the direction of the study, though I could not make out words. Margaret seemed troubled but said "They are always fighting."', author: 'Mrs. Dorothy Patterson', date: 'October 15, 1962' },
          { id: 'doc-2-4', type: 'phone_record', title: 'Telephone Records -- Blackwood Manor', content: 'October 14, 1962:\n- 2:15 PM -- Incoming call from Edward Blackwood (London exchange) to manor -- duration 4 minutes\n- 5:45 PM -- Outgoing call from manor to Hargreaves & Son Solicitors -- duration 8 minutes\n- 6:30 PM -- Outgoing call from manor to Dr. Helena Cross -- duration 3 minutes\n- 7:10 PM -- Outgoing call from manor to Vivian LaRoux -- duration 2 minutes (no answer)\n- 7:30 PM -- Incoming call from unknown number -- duration 1 minute', author: 'GPO Records Department', date: 'October 15, 1962' },
          { id: 'doc-2-5', type: 'diary_entry', title: 'Edward Blackwood\'s Diary -- October 14', content: 'Father has gone too far this time. He called me a criminal to my face. I am his SON. Everything I did was to increase the value of his precious collection.\n\nHe says he is going to the police. He says he is changing the will. I told him he would regret it. I did not mean... I only meant that I would fight it in court.\n\nI must speak with him again tonight. Perhaps I can make him see reason. If he goes to the police, Vivian and I are both ruined.\n\nI have the compound from the laboratory -- the one Dr. Cross prescribed for the rats in the cellar. Perhaps if Father were to fall ill, just ill enough to delay his trip to the solicitor...\n\nNo. I must not think like that. I will talk to him. That is all.', author: 'Edward Blackwood', date: 'October 14, 1962' }
        ],
        puzzles: [
          { id: 'puzzle-2-1', type: 'cipher', title: 'The Safe Combination', description: 'Arthur mentions in his unsent letter that evidence is locked in a safe behind a painting in his study. The combination is hidden in the letter itself.\n\nWhat is the safe combination?', hints: ['Read Arthur\'s letter very carefully. He gives the combination directly.', 'He says the combination is related to a personal date.', 'Arthur writes: "The safe combination is the year of my wedding: 1932."'], answer: '1932', alternateAnswers: ['the year 1932', 'year of his wedding'], maxAttempts: 6, difficulty: 'easy', puzzleData: { cipherText: 'The combination is hidden within Arthur\'s unsent letter to Inspector Walsh. Read it carefully.', question: 'What is the safe combination?' }, revealOnSolve: 'The safe combination is 1932 -- the year of Arthur\'s wedding. Inside the safe, investigators found documentation proving the art forgery scheme, directly implicating Edward and Vivian LaRoux.' },
          { id: 'puzzle-2-2', type: 'cross_reference', title: 'The Rat Poison Connection', description: 'Edward\'s diary mentions "the compound from the laboratory -- the one Dr. Cross prescribed for the rats in the cellar." Cross-reference this with the autopsy report.\n\nWhat is the connection between the rat poison and the murder weapon?', hints: ['The autopsy report identifies the poison as potassium cyanide.', 'Rat poison often contains cyanide compounds. Dr. Cross apparently prescribed it.', 'Edward had access to cyanide through the rat poison Dr. Cross arranged. This is how he obtained the murder weapon.'], answer: 'cyanide', alternateAnswers: ['rat poison contains cyanide', 'the rat poison is cyanide', 'potassium cyanide', 'rat poison', 'cyanide from rat poison'], maxAttempts: 6, difficulty: 'medium', puzzleData: { question: 'What poison was used as rat poison that matches the murder weapon?' }, revealOnSolve: 'The rat poison prescribed by Dr. Cross contained potassium cyanide -- the same substance that killed Arthur. Edward had direct access to it in the manor\'s cellar.' },
          { id: 'puzzle-2-3', type: 'contradiction', title: 'Edward\'s Missing Hour', description: 'Edward claims he was in the library reading until 9 PM. But Mrs. Patterson saw him walking toward the study at 7:55 PM, and heard raised voices from the study at 8:20 PM.\n\nWhat is the contradiction in Edward\'s alibi?', hints: ['Compare Edward\'s statement with Mrs. Patterson\'s testimony.', 'Edward says he was in the library. Mrs. Patterson saw him heading to the study.', 'Edward lied about being in the library. He went to the study at 7:55 PM -- during the critical window when the poison was administered.'], answer: 'he was not in the library', alternateAnswers: ['he went to the study', 'mrs patterson saw him', 'he lied about the library', 'patterson saw him going to study', 'he was at the study not library', 'his alibi is false'], maxAttempts: 6, difficulty: 'medium', puzzleData: { question: 'What is the specific contradiction in Edward\'s alibi?' }, revealOnSolve: 'Edward claimed to be in the library, but Mrs. Patterson clearly saw him heading toward the study at 7:55 PM -- just 10 minutes after the brandy was served. His alibi is a complete fabrication.' }
        ]
      },
      {
        title: 'The Final Pieces',
        intro: 'The evidence is converging. A key forensic discovery and a final witness statement will reveal the truth about that night at Blackwood Manor.',
        documents: [
          { id: 'doc-3-1', type: 'forensic_report', title: 'Fingerprint Analysis -- Glass Vial', content: 'The small glass vial recovered from the wastepaper basket in the study has been analyzed.\n\nResults: Two sets of fingerprints identified.\n- Set A: Matched to Arthur Blackwood (victim) -- likely from handling when the vial was placed in the basket\n- Set B: Matched to Edward Blackwood -- clear thumb and index finger prints consistent with holding the vial to pour contents\n\nThe vial contained residual traces of potassium cyanide solution. The concentration and form are consistent with the rat poison compound stored in the manor\'s cellar.', author: 'Forensic Laboratory, Scotland Yard', date: 'October 16, 1962' },
          { id: 'doc-3-2', type: 'witness_statement', title: 'Revised Statement of Dr. Helena Cross', content: 'I must amend my previous statement. When I arrived at 8:30 PM, I did not go directly to see Arthur. I first stopped in the kitchen to speak with Harris about Arthur\'s medication schedule.\n\nWhile in the hallway outside the study at approximately 8:35 PM, I heard the sound of a key turning in the lock. The study door opened briefly and Edward emerged. He appeared startled to see me. His hands were shaking and he was very pale.\n\nHe said, "Father is resting. Don\'t disturb him." Then he walked quickly toward the library.\n\nI did not think much of it at the time. But now I understand the significance. I should have spoken sooner, but I feared for my own position given the billing irregularities Arthur had discovered.', author: 'Dr. Helena Cross', date: 'October 16, 1962' },
          { id: 'doc-3-3', type: 'photograph', title: 'Photograph -- Charred Paper from Fireplace', content: 'Forensic recovery of partially burned document from the study fireplace:\n\nThe recovered fragments read:\n"...hereby revoke all previous... Edward Blackwood shall receive no... criminal conduct unbecoming of... effective immediately upon my signa..."\n\nThis appears to be a draft of the amended will that Arthur had been preparing. Someone burned it in the fireplace -- likely the same person who tore up the version found on the floor.', author: 'Evidence Recovery Unit', date: 'October 16, 1962' },
          { id: 'doc-3-4', type: 'letter', title: 'Letter from Vivian LaRoux to Edward (found in library)', content: 'Edward,\n\nThis is getting out of hand. Your father knows everything. He called me yesterday threatening to go to the police. I told you we should have stopped after the first painting but you insisted.\n\nI am leaving the country. I suggest you find a way to resolve this with your father before it is too late. Perhaps if you reason with him, he will not pursue charges against his own son.\n\nDo NOT do anything foolish. I know your temper.\n\n- V.\n\nP.S. I left the manor at 7 PM. I want nothing more to do with this.', author: 'Vivian LaRoux', date: 'October 14, 1962' }
        ],
        puzzles: [
          { id: 'puzzle-3-1', type: 'timeline', title: 'Reconstruct the Murder', description: 'Using all the evidence gathered across all three acts, reconstruct exactly what happened on the evening of October 14th.\n\nAt what time did Edward enter the study to poison his father?', hints: ['Mrs. Patterson saw Edward heading toward the study at 7:55 PM.', 'The butler served the brandy at 7:45. Arthur expected a visitor at 8 PM. Edward was seen at 7:55.', 'Edward entered the study around 7:55-8:00 PM, argued with his father, and at some point poured cyanide from the vial into the brandy glass.'], answer: '8', alternateAnswers: ['8 pm', '7:55', '7:55 pm', '8:00', '8:00 pm', 'around 8', 'eight', 'eight pm', '8pm', '755'], maxAttempts: 6, difficulty: 'hard', puzzleData: { question: 'At approximately what hour (PM) did Edward enter the study?' }, revealOnSolve: 'Edward entered the study at approximately 7:55-8:00 PM. Mrs. Patterson saw him, Dr. Cross later saw him leave at 8:35 PM. In that 35-40 minute window, he argued with his father, poisoned the brandy, and locked the door from inside using the spare key before exiting.' },
          { id: 'puzzle-3-2', type: 'cross_reference', title: 'The Locked Room Mystery', description: 'The door was locked from the INSIDE with the key in the lock. How did the murderer leave a locked room?\n\nDr. Cross saw Edward exit the study at 8:35 PM. But Harris found the door locked at 9:15 PM. Think about the keys.', hints: ['Harris mentions he fetched a SPARE key. There must be more than one key.', 'Harris had the spare key. The main key was in the lock inside. But Edward could have locked the door from outside if he had access to another key.', 'Edward locked the door from OUTSIDE using a duplicate or spare key, then placed the original inside through the keyhole gap or under the door. Or more simply: Arthur was still alive when Edward left but had already consumed the poison. Arthur locked the door himself before dying.'], answer: 'arthur locked it himself', alternateAnswers: ['arthur locked the door', 'victim locked it', 'arthur locked it before dying', 'blackwood locked the door himself', 'the victim locked the door', 'arthur locked door', 'he locked it himself'], maxAttempts: 6, difficulty: 'hard', puzzleData: { question: 'How was the door locked from the inside if the murderer left the room?' }, revealOnSolve: 'Arthur was still alive when Edward left at 8:35 PM. The cyanide takes 5-15 minutes to kill. Arthur, feeling ill, likely locked his study door for privacy before the poison took full effect. He died alone in his locked study, not knowing his own son had poisoned him.' }
        ]
      }
    ],
    finalAccusation: {
      culpritId: 'edward',
      motive: 'inheritance',
      explanation: 'Edward Blackwood poisoned his father Arthur with potassium cyanide obtained from rat poison in the manor\'s cellar. He visited the study at approximately 8 PM, argued with his father about being removed from the will, and slipped cyanide from a small vial into the brandy glass. He left at 8:35 PM (witnessed by Dr. Cross). Arthur, not yet feeling the effects, locked his own study door before the poison took hold. Edward\'s fingerprints on the vial, his fabricated alibi, his diary confession of considering poison, and the testimony of Mrs. Patterson and Dr. Cross all point conclusively to his guilt. His motive: preventing Arthur from changing his will and going to the police about the art forgery scheme.'
    }
  }
];

// ---- Generation ----

async function generateCase(playerCount) {
  // Pick a random template
  const template = CASE_TEMPLATES[Math.floor(Math.random() * CASE_TEMPLATES.length)];
  // Deep clone
  return JSON.parse(JSON.stringify(template));
}

// ---- Client-safe version (strip answers) ----

function getClientCase(caseData) {
  const client = JSON.parse(JSON.stringify(caseData));
  // Remove answers from puzzles
  if (client.acts) {
    client.acts.forEach(act => {
      if (act.puzzles) {
        act.puzzles.forEach(p => {
          delete p.answer;
          delete p.alternateAnswers;
          delete p.revealOnSolve;
        });
      }
    });
  }
  // Remove isGuilty and motive from suspects
  if (client.suspects) {
    client.suspects.forEach(s => {
      delete s.isGuilty;
      delete s.motive;
    });
  }
  // Remove finalAccusation
  delete client.finalAccusation;
  return client;
}

// ---- Answer Validation ----

function validateAnswer(puzzle, answer) {
  if (!puzzle || !answer) return false;
  const norm = answer.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
  const correct = puzzle.answer.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
  if (norm === correct) return true;
  if (puzzle.alternateAnswers) {
    return puzzle.alternateAnswers.some(alt => {
      const normAlt = alt.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
      return norm === normAlt || norm.includes(normAlt) || normAlt.includes(norm);
    });
  }
  return false;
}

// ---- Stats ----

function getCaseStats(game) {
  let totalAttempts = 0;
  let totalHints = 0;
  let puzzlesSolved = 0;

  for (const [id, state] of Object.entries(game.puzzleState || {})) {
    totalAttempts += state.attempts || 0;
    totalHints += state.hintsUsed || 0;
    if (state.solvedBy) puzzlesSolved++;
  }

  return {
    puzzlesSolved,
    totalAttempts,
    totalHints,
    timeTaken: (game.endTime || Date.now()) - game.startTime,
    stars: game.stars
  };
}

module.exports = { generateCase, getClientCase, validateAnswer, getCaseStats };
