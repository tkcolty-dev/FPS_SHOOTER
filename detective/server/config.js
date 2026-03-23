// Parse VCAP_SERVICES for CF marketplace bindings
function getRedisConfig() {
  if (process.env.VCAP_SERVICES) {
    const vcap = JSON.parse(process.env.VCAP_SERVICES);
    const redis = (vcap['p-redis'] && vcap['p-redis'][0]) || (vcap['p.redis'] && vcap['p.redis'][0]);
    if (redis) {
      const c = redis.credentials;
      return { host: c.host, port: c.port, password: c.password };
    }
  }
  return null;
}

function getGenAIConfig() {
  if (process.env.VCAP_SERVICES) {
    const vcap = JSON.parse(process.env.VCAP_SERVICES);
    const genai = vcap.genai && vcap.genai[0];
    if (genai) {
      const creds = genai.credentials;
      return {
        apiBase: creds.api_base || creds.endpoint,
        apiKey: creds.api_key,
        model: creds.model_name || 'gpt-oss-120b'
      };
    }
  }
  return null;
}

module.exports = { getRedisConfig, getGenAIConfig };
