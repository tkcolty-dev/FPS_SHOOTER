// Content moderation - blocks inappropriate words in task titles, chat, display names, etc.
// Uses pattern matching to catch variations (letter substitutions, spacing tricks)

const BAD_WORDS = [
  'fuck', 'shit', 'ass', 'bitch', 'damn', 'dick', 'cock', 'pussy',
  'cunt', 'whore', 'slut', 'bastard', 'piss', 'crap', 'douche',
  'fag', 'faggot', 'nigger', 'nigga', 'retard', 'retarded',
  'stfu', 'gtfo', 'milf', 'dilf', 'porn', 'hentai', 'xxx',
  'motherfucker', 'bullshit', 'asshole', 'dumbass', 'jackass',
  'dipshit', 'shithead', 'fuckface', 'dickhead', 'bitchass',
  'wtf', 'lmfao', 'thot', 'skank', 'twat', 'wanker', 'bollock',
  'arse', 'arsehole', 'prick', 'tit', 'boob', 'penis', 'vagina',
  'erection', 'orgasm', 'blowjob', 'handjob', 'anal', 'nude',
  'naked', 'stripper', 'prostitute', 'hooker', 'pimp',
  'kill yourself', 'kys', 'die', 'suicide', 'rape', 'molest',
];

// Common letter substitutions people use to bypass filters
const SUBSTITUTIONS = {
  'a': '[a@4]',
  'e': '[e3]',
  'i': '[i1!|]',
  'o': '[o0]',
  's': '[s$5]',
  'l': '[l1|]',
  'u': '[uv]',
  't': '[t7]',
};

// Build regex patterns that catch common evasion tricks
function buildPattern(word) {
  let pattern = '';
  for (const char of word) {
    const sub = SUBSTITUTIONS[char.toLowerCase()];
    if (sub) {
      pattern += sub + '[\\s._-]*';
    } else {
      pattern += char + '[\\s._-]*';
    }
  }
  // Remove trailing separator matcher
  pattern = pattern.replace(/\[\\s\._-\]\*$/, '');
  return new RegExp(pattern, 'i');
}

const BAD_PATTERNS = BAD_WORDS.map(w => buildPattern(w));

// Whitelist common words that might partially match (e.g. "assess", "class", "bass")
const WHITELIST = [
  'assess', 'assessment', 'assist', 'assistant', 'class', 'classes',
  'classic', 'classified', 'bass', 'compass', 'bypass', 'mass',
  'massage', 'embassy', 'passage', 'passenger', 'password',
  'brass', 'grass', 'glass', 'lasso', 'cassette', 'casserole',
  'passport', 'trespass', 'diecast', 'diesel', 'diet', 'audience',
  'studied', 'remedied', 'applied', 'modified', 'carried',
  'therapist', 'analyst', 'title', 'titled', 'subtle', 'shuttle',
  'button', 'butter', 'butterfly', 'cocktail', 'peacock', 'hancock',
  'scrapbook', 'scrape', 'scraping', 'scrapped',
  'assume', 'assumption', 'assure', 'assurance', 'associate',
  'assembly', 'assemble', 'assert', 'assertion', 'asset', 'assign',
  'penalize', 'penalty', 'pencil', 'pending', 'penetrate',
  'diehard', 'died', 'dielectric', 'dies',
  'booboo', 'bookmark', 'boost', 'booth', 'bootstrap',
  'analytics', 'analysis', 'analyze', 'analog',
  'therapist', 'therapeutic',
  'grape', 'drape', 'scrape',
  'pineapple', 'grapefruit',
  'document', 'documented',
  'accomplish', 'accumulated',
  'hitlist', 'whiteout', 'wholesome', 'wholesale',
];

function isWhitelisted(text, matchStart, matchEnd) {
  const lower = text.toLowerCase();
  for (const word of WHITELIST) {
    const idx = lower.indexOf(word);
    if (idx !== -1 && idx <= matchStart && idx + word.length >= matchEnd) {
      return true;
    }
  }
  return false;
}

/**
 * Check if text contains inappropriate content
 * @param {string} text - The text to check
 * @returns {{ clean: boolean, matched: string|null }}
 */
function checkContent(text) {
  if (!text || typeof text !== 'string') return { clean: true, matched: null };

  const normalized = text.toLowerCase().trim();

  for (let i = 0; i < BAD_PATTERNS.length; i++) {
    const match = BAD_PATTERNS[i].exec(normalized);
    if (match) {
      // Check if this match is part of a whitelisted word
      if (!isWhitelisted(normalized, match.index, match.index + match[0].length)) {
        return { clean: false, matched: BAD_WORDS[i] };
      }
    }
  }

  return { clean: true, matched: null };
}

/**
 * Censor bad words in text (replace with asterisks) - used for AI output
 * @param {string} text - Text to censor
 * @returns {string} Censored text
 */
function censorText(text) {
  if (!text || typeof text !== 'string') return text;

  let result = text;
  for (let i = 0; i < BAD_PATTERNS.length; i++) {
    result = result.replace(new RegExp(BAD_PATTERNS[i].source, 'gi'), (match) => {
      const lower = text.toLowerCase();
      const idx = lower.indexOf(match.toLowerCase());
      if (idx !== -1 && isWhitelisted(lower, idx, idx + match.length)) {
        return match; // Don't censor whitelisted words
      }
      return '****';
    });
  }
  return result;
}

module.exports = { checkContent, censorText };
