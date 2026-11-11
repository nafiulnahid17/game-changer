// Independent Cloudflare Access JWT verification: never trust unverified headers.
const keyCache = new Map();
const decoder = new TextDecoder();
function decodePart(s) {
  const base = s.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = atob(base.padEnd(Math.ceil(base.length / 4) * 4, '='));
  return Uint8Array.from(bytes, c => c.charCodeAt(0));
}
function jsonPart(s) { return JSON.parse(decoder.decode(decodePart(s))); }
function denied() { return new Response(JSON.stringify({error: 'Unauthorized. Cloudflare Access sign-in required.'}), {status: 401, headers: {'content-type':'application/json', 'cache-control':'no-store'}}); }
export async function verifyAccess(request, env) {
  const domain = (env.ACCESS_TEAM_DOMAIN || '').replace(/\/$/, '');
  if (!domain.startsWith('https://') || !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/i.test(domain) || !env.ACCESS_AUD) throw new Error('Cloudflare Access configuration is missing or invalid');
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const header = jsonPart(parts[0]);
    const payload = jsonPart(parts[1]);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return null;
    const now = Math.floor(Date.now()/1000);
    if (payload.iss !== domain || !Array.isArray(payload.aud) || !payload.aud.includes(env.ACCESS_AUD) ||
        typeof payload.sub !== 'string' || !payload.sub || !Number.isFinite(payload.exp) || payload.exp <= now ||
        (payload.nbf !== undefined && (!Number.isFinite(payload.nbf) || payload.nbf > now + 60)) ||
        (payload.iat !== undefined && payload.iat > now + 60)) return null;
    let cache = keyCache.get(domain);
    if (!cache || cache.expires < Date.now()) {
      const resp = await fetch(`${domain}/cdn-cgi/access/certs`, {signal: AbortSignal.timeout(6000)});
      if (!resp.ok) return null;
      const {keys} = await resp.json();
      if (!Array.isArray(keys)) return null;
      cache = {keys, expires: Date.now() + 5*60*1000};
      keyCache.set(domain, cache);
    }
    const jwk = cache.keys.find(k => k.kid === header.kid && k.kty === 'RSA');
    if (!jwk) { keyCache.delete(domain); return null; }
    const key = await crypto.subtle.importKey('jwk', jwk, {name:'RSASSA-PKCS1-v1_5', hash:'SHA-256'}, false, ['verify']);
    const signature = decodePart(parts[2]);
    const input = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, input)) return null;
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : null;
    if (env.ACCESS_ALLOWED_EMAILS) {
      const permitted = env.ACCESS_ALLOWED_EMAILS.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
      if (!email || !permitted.includes(email)) return null;
    }
    return {id: payload.sub, email};
  } catch { return null; }
}
export const unauthenticated = denied;
