const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = process.env.BASELINE ? require('node:child_process').execFileSync('git', ['show', '594b64c:src/pages/Overview.tsx'], {cwd:root, encoding:'utf8'}) : fs.readFileSync(path.join(root, 'src/pages/Overview.tsx'), 'utf8');
const ast = ts.createSourceFile('Overview.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const load = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'loadOverview');
const js = ts.transpileModule(load.getText(ast), {compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
async function counts(statuses, active) {
  const context = {fetchData:async url => url.includes('/vehicles/') ? statuses.map(status=>({status})) : url.includes('/fleet/overview/') ? {active_vehicles:active} : [], Date};
  vm.createContext(context); vm.runInContext(js, context);
  return context.loadOverview();
}
test('all AVAILABLE vehicles are active and available', async()=>{const r=await counts(Array(6).fill('AVAILABLE'));assert.equal(r.activeVehicles,6);assert.equal(r.availableVehicles,6);});
test('mixed statuses count availability directly', async()=>{const r=await counts(['AVAILABLE','IN_USE','ACTIVE','MAINTENANCE']);assert.equal(r.activeVehicles,3);assert.equal(r.availableVehicles,1);});
test('explicit backend zero is preserved', async()=>{const r=await counts(['AVAILABLE'],0);assert.equal(r.activeVehicles,0);assert.equal(r.availableVehicles,1);});
test('empty loaded fleet and all in use are zero available', async()=>{for(const rows of [[],['IN_USE','IN_USE']]){const r=await counts(rows);assert.equal(r.availableVehicles,0);}});
test('visible labels use returned availability, not complement',()=>{assert.match(source,/label: "Active vehicles"/);assert.match(source,/const availableVehicles = data\?\.availableVehicles \?\? 0/);assert.match(source,/\$\{availableVehicles\} vehicle\$\{availableVehicles !== 1/);assert.doesNotMatch(source,/totalVehicles - activeVehicles/);assert.match(source,/\{data\s*\? `\$\{availableVehicles\}/);});
