import test from 'node:test';
import assert from 'node:assert/strict';
import {buildExtendedLiveCases} from '../fixtures/evaluation/extended.mjs';
import {validateFile} from '../../server/meta.mjs';
const cases=await buildExtendedLiveCases();
test('extended selection is separate from exact1000 manifest and has thirteen unique cases',()=>{assert.equal(cases.length,13);assert.equal(new Set(cases.map(x=>x.id)).size,13);});
for(const fixture of cases)test(fixture.id+' is a valid bounded synthetic input with explicit ground truth',async()=>{const file=await validateFile(fixture.file);assert.ok(file.data.length>50);assert.ok(fixture.expected.fields||fixture.expected.nullFields);assert.equal(fixture.expected.fictional,true);});
