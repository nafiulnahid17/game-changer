import {readFileSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const configFile = resolve(root, 'wrangler.jsonc');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function findD1Id(result, name='game-changer-db') {
  const rows = Array.isArray(result) ? result : (result?.result || result?.databases || []);
  if (!Array.isArray(rows)) throw new Error('Unexpected D1 list result.');
  const matches = rows.filter(db => db?.name === name);
  if (!matches.length) throw new Error('D1 database '+name+' is missing. Create it in Cloudflare D1 before deploying.');
  if (matches.length > 1) throw new Error('Duplicate D1 database names; explicitly set D1_DATABASE_ID.');
  const id = matches[0].uuid || matches[0].database_id || matches[0].id;
  if (!UUID.test(String(id || ''))) throw new Error('D1 listing did not contain a valid database UUID.');
  return id;
}
export function populateD1(config, uuid) {
  if (!UUID.test(String(uuid || ''))) throw new Error('D1_DATABASE_ID must be a valid database UUID.');
  const db = config.d1_databases?.find(item => item.binding === 'DB');
  if (!db?.database_name) throw new Error('Missing D1 binding DB and database_name.');
  db.database_id = uuid;
  return config;
}
export function parseD1List(text) {
  const raw = String(text).trim();
  try { return JSON.parse(raw); } catch {
    const at = raw.indexOf('[');
    if (at >= 0) { try { return JSON.parse(raw.slice(at)); } catch {} }
    throw new Error('Could not parse Wrangler D1 list JSON: '+raw.slice(0,400));
  }
}
function wrangler(args, capture=false) {
  const binary = resolve(root,'node_modules','.bin',process.platform==='win32'?'wrangler.cmd':'wrangler');
  const run = spawnSync(binary,args,{cwd:root,encoding:'utf8',stdio:capture?['ignore','pipe','pipe']:'inherit',env:{...process.env,CI:'true'}});
  if (run.error) throw new Error('Wrangler could not run. Install dependencies first: '+run.error.message);
  if (run.status !== 0) throw new Error('wrangler '+args.join(' ')+' failed'+(capture?': '+(run.stderr||run.stdout||'').slice(-1200):''));
  return run.stdout || '';
}
export function main() {
  const config=JSON.parse(readFileSync(configFile,'utf8'));
  const db=config.d1_databases?.find(x=>x.binding==='DB');
  if (!db?.database_name) throw new Error('Invalid D1 binding in wrangler.jsonc.');
  let id=process.env.D1_DATABASE_ID?.trim();
  if (!id && UUID.test(String(db.database_id||''))) id=db.database_id;
  if (!id) {
    console.log('Resolving '+db.database_name+' UUID from Cloudflare account...');
    id=findD1Id(parseD1List(wrangler(['d1','list','--json'],true)),db.database_name);
  }
  populateD1(config,id);
  writeFileSync(configFile,JSON.stringify(config,null,2)+'\n');
  console.log('D1 binding resolved. Applying remote migrations...');
  wrangler(['d1','migrations','apply',db.database_name,'--remote']);
  console.log('Deploying Worker with valid DB binding...');
  wrangler(['deploy']);
}
if (process.argv[1] && fileURLToPath(import.meta.url)===resolve(process.argv[1])) {
  try {main();} catch(err) {console.error('Deployment stopped: '+err.message);process.exitCode=1;}
}
