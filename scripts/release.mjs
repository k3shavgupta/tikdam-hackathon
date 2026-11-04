// Deploy the tracked Worker and build to an existing Tikdam environment.
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, mkdirSync, rmSync} from 'node:fs';
import path from 'node:path';

const target = process.argv[2];
if (!['production', 'staging'].includes(target)) throw Error('Choose production or staging.');
const providerOption = process.argv[3];
if (providerOption && providerOption !== '--ai-provider=meta')
  throw Error('The only supported provider override is --ai-provider=meta.');
const git = (...args) => execFileSync('git',args,{encoding:'utf8'}).trim();
const sha = git('rev-parse','HEAD');
if (git('status','--porcelain') || git('branch','--show-current') !== 'main') throw Error('Release from a clean main checkout.');
if (target === 'production' && git('ls-remote','origin','refs/heads/main').split(/\s/)[0] !== sha) throw Error('Push the reviewed commit to main first.');
const wrangler = path.resolve('node_modules/.bin/wrangler');
const env = {...process.env, WRANGLER_LOAD_DOT_ENV:'false'};
const args = ['--env', target === 'staging' ? '' : target];
const query = (...command) => JSON.parse(execFileSync(wrangler,[...command,...args,'--json'],{encoding:'utf8',env}));
const active = query('deployments','list').sort((a,b)=>b.created_on.localeCompare(a.created_on))[0]?.versions;
if (active?.length !== 1 || active[0].percentage !== 100) throw Error('Review the current traffic split before release.');
const bindings = query('versions','view',active[0].version_id).resources.bindings;
if (bindings.some(b=>!['assets','secret_text','d1','plain_text'].includes(b.type))) throw Error('Review new binding types before deploying.');
const db = bindings.filter(b=>b.type==='d1');
if (db.length!==1 || db[0].name!=='DB' || !db[0].database_id) throw Error('Expected a single existing DB binding.');
const template = JSON.parse(readFileSync('wrangler.jsonc','utf8'));
const config = {...template,...(target==='production'?template.env.production:{})};
delete config.env;
delete config.$schema;
// Keep existing account managed variables and secrets, including the live AI
// enable switch. An explicit provider repair changes only AI_PROVIDER.
delete config.vars;
if (providerOption) config.vars = {AI_PROVIDER: 'meta'};
config.main = path.resolve(config.main);
config.assets.directory = path.resolve(config.assets.directory);
config.d1_databases[0].database_id = db[0].database_id;
config.d1_databases[0].migrations_dir = path.resolve('migrations');
mkdirSync('.local-state',{recursive:true,mode:0o700});
const filename = path.resolve('.local-state/release-'+target+'.json');
writeFileSync(filename,JSON.stringify(config),{mode:0o600});
try {
  execFileSync(wrangler,['deploy','--config',filename,'--env','','--keep-vars','--tag',sha.slice(0,12),'--message','GitHub main '+sha],{stdio:'inherit',env});
} finally {
  rmSync(filename,{force:true});
}
