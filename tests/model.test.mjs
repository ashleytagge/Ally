import test from 'node:test';
import assert from 'node:assert/strict';
import { demoProfile, providers } from '../src/data.js';
import { findProviders, initialFilters, networkLabel, distance, readState, validProfile } from '../src/model.js';
test('diagnosis filters and plan-first sorting are transparent and deterministic', () => {
  const matches = findProviders(demoProfile, initialFilters());
  assert.equal(matches.length, 4);
  assert.ok(matches.every(p => p.conditions.includes(demoProfile.condition)));
  assert.equal(matches[0].id, 'elena');
  assert.equal(networkLabel(matches[0], demoProfile), 'Sample plan match');
});
test('combined search, insurance, distance and availability filters', () => {
  const f = { ...initialFilters(), query: 'Rheumatology', network: true, distance: '5', availability: '7' };
  assert.deepEqual(findProviders(demoProfile, f).map(p => p.id), ['maya']);
  assert.equal(findProviders(demoProfile, { ...f, query: 'no such doctor' }).length, 0);
});
test('unknown insurance is never called compatible', () => {
  const p = { ...demoProfile, insurance: 'Other / not sure' };
  assert.equal(networkLabel(providers[0], p), 'Coverage unknown');
  assert.equal(findProviders(p, { ...initialFilters(), network: true }).length, 0);
});
test('saved options, alternative diagnoses and area-specific sample distances', () => {
  assert.deepEqual(findProviders(demoProfile, initialFilters(), ['maya']).map(p => p.id), ['maya']);
  assert.equal(findProviders(demoProfile, initialFilters(), []).length, 0);
  const celiac = findProviders({ ...demoProfile, condition: 'Celiac disease' }, initialFilters());
  assert.deepEqual(celiac.map(p => p.specialty).sort(), ['Gastroenterology', 'Primary care']);
  assert.equal(distance(providers[0], { ...demoProfile, location: 'phoenix' }), 3.6);
});
test('storage handles malformed data and invalid references', () => {
  assert.equal(readState({ getItem: () => '{oops' }).profile, null);
  assert.equal(validProfile({ ...demoProfile, location: 'invalid' }), false);
  const s = readState({ getItem: () => JSON.stringify({ profile: demoProfile, saved: ['maya', 'bad'], appointments: [{ id: 'bad' }], tasks: ['coverage', 'bad'] }) });
  assert.deepEqual(s.saved, ['maya']); assert.deepEqual(s.tasks, ['coverage']); assert.equal(s.appointments.length, 0);
});
