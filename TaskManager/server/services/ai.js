// GenAI service via VCAP_SERVICES (OpenAI-compatible proxy)

function getAiConfig() {
  if (process.env.VCAP_SERVICES) {
    const vcap = JSON.parse(process.env.VCAP_SERVICES);
    const genai = vcap.genai && vcap.genai[0];
    if (genai) {
      const ep = genai.credentials.endpoint || genai.credentials;
      return {
        apiBase: ep.api_base,
        apiKey: ep.api_key,
        model: 'openai/gpt-oss-120b',
        provider: 'genai'
      };
    }
  }
  return {
    apiBase: process.env.AI_API_BASE || 'http://localhost:11434/v1',
    apiKey: process.env.AI_API_KEY || 'none',
    model: process.env.AI_MODEL || 'gpt-4o',
    provider: 'local'
  };
}

async function chatCompletion(messages, maxTokens = 1500) {
  const config = getAiConfig();
  const url = config.provider === 'genai'
    ? `${config.apiBase}/openai/v1/chat/completions`
    : `${config.apiBase}/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: maxTokens
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function generateInvitation(eventDetails) {
  const messages = [
    {
      role: 'system',
      content: 'You are a helpful assistant that creates elegant, professional event invitations. Generate a well-formatted invitation based on the event details provided. Include a warm greeting, event details (date, time, location), a brief description, and a closing. Keep it concise but inviting.'
    },
    {
      role: 'user',
      content: `Create an invitation for this event:\n${JSON.stringify(eventDetails, null, 2)}`
    }
  ];
  return chatCompletion(messages);
}

async function streamChat(systemPrompt, chatMessages, res) {
  const config = getAiConfig();
  const url = config.provider === 'genai'
    ? `${config.apiBase}/openai/v1/chat/completions`
    : `${config.apiBase}/chat/completions`;

  const allMessages = [{ role: 'system', content: systemPrompt }, ...chatMessages];

  const aiRes = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: allMessages,
      max_tokens: 1500,
      stream: true
    })
  });

  if (!aiRes.ok) {
    const err = await aiRes.text();
    throw new Error(`AI API error ${aiRes.status}: ${err}`);
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const contentType = aiRes.headers.get('content-type') || '';

  // If proxy returns JSON instead of SSE, handle it
  if (contentType.includes('application/json')) {
    const data = await aiRes.json();
    const text = data.choices?.[0]?.message?.content || '';
    if (text) {
      res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
    return text;
  }

  // SSE streaming
  const reader = aiRes.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        let jsonStr;
        if (line.startsWith('data:')) {
          const rest = line.slice(5).trim();
          if (rest === '[DONE]' || !rest) {
            if (rest === '[DONE]') res.write('data: [DONE]\n\n');
            continue;
          }
          jsonStr = rest;
        } else continue;

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            fullContent += content;
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        } catch {}
      }
    }

    // Process remaining buffer
    if (buffer) {
      for (const line of buffer.split('\n')) {
        let jsonStr;
        if (line.startsWith('data:')) {
          const rest = line.slice(5).trim();
          if (rest === '[DONE]' || !rest) continue;
          jsonStr = rest;
        } else continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            fullContent += content;
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        } catch {}
      }
    }
  } catch (err) {
    console.error('Stream error:', err);
  }

  res.write('data: [DONE]\n\n');
  res.end();
  return fullContent;
}

module.exports = { chatCompletion, generateInvitation, streamChat, getAiConfig };
