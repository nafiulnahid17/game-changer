import test from 'node:test';
import assert from 'node:assert/strict';
import {findD1Id,populateD1,parseD1List} from '../scripts/deploy.mjs';
const uuid='aceeb7c2-1234-4f00-8a00-123456789abc';
test('finds exact named D1 UUID',()=>assert.equal(findD1Id(parseD1List(JSON.stringify([{name:'other',uuid},{name:'game-changer-db',uuid}]))),uuid));
test('refuses missing or invalid D1 resources',()=>{
  assert.throws(()=>findD1Id([]),/missing/);
  assert.throws(()=>findD1Id([{name:'game-changer-db',uuid:'placeholder'}]),/valid database UUID/);
});
test('only replaces DB binding after UUID validation',()=>{
  const conf={d1_databases:[{binding:'DB',database_name:'game-changer-db',database_id:'REPLACE_WITH_D1_DATABASE_UUID'}]};
  assert.equal(populateD1(conf,uuid).d1_databases[0].database_id,uuid);
  assert.throws(()=>populateD1(conf,'invalid'),/valid database UUID/);
});
