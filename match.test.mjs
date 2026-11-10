import test from 'node:test';
import assert from 'node:assert/strict';
import { skills, match, safeUrl } from './src/shared/utils/match.mjs';
test('skill aliases and boundaries avoid Java/JavaScript false positives', () => {
  assert.deepEqual(skills('JavaScript, React.js, C++, .NET, PostgreSQL'), ['JavaScript', 'React', 'SQL', 'C++', '.NET']);
  assert.deepEqual(skills('expert in spreadsheets and reaction kinetics'), []);
});
test('matching reports missing skills and cannot give an unknown job a perfect score', () => {
  assert.deepEqual(match(['Python'], 'Python and SQL'), { required: ['Python', 'SQL'], matched: ['Python'], missing: ['SQL'], score: 50 });
  assert.equal(match(['Python'], 'Unrecognized requirements').score, null);
});
test('application links reject executable schemes', () => {
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('https://example.com/job'), 'https://example.com/job');
});
