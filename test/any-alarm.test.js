'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { alarms, combinedAlarms } = require('../lib/topaz');

// Statusfeltene er tredelte: 0 ok, 1 varsel, 2 full alarm. Bare 2 er alarm.
const at = (smoke, co = 0, heat = 0) => ({ smoke, co, heat });

test('alarm bare ved full alarm, ikke ved varsel', () => {
  assert.equal(alarms(at(2)).smoke, true);
  assert.equal(alarms(at(1)).smoke, false);
  assert.equal(alarms(at(0)).smoke, false);
});

test('any samler de tre faretypene', () => {
  assert.equal(alarms({ smoke: 0, co: 2, heat: 0 }).any, true);
  assert.equal(alarms({ smoke: 0, co: 0, heat: 0 }).any, false);
});

test('en enhet i alarm gjør hele huset til alarm', () => {
  const state = combinedAlarms([at(0), at(2), at(0)]);
  assert.equal(state.smoke, true);
  assert.equal(state.any, true);
});

test('alle rolige gir rolig', () => {
  const state = combinedAlarms([at(0), at(0)]);
  assert.equal(state.smoke, false);
  assert.equal(state.any, false);
});

// Det farligste tilfellet: én ulende varsler og én vi ikke har hørt fra skal
// ikke bli «rolig» og stanse flowen som håndterer brannen.
test('ukjent ved siden av en alarm er fortsatt alarm', () => {
  const state = combinedAlarms([at(2), at(null)]);
  assert.equal(state.smoke, true);
});

// Og motsatt: uten alarm, men med et hull i dataene, vet vi ikke om det er
// rolig. Bare et sikkert «rolig» har lov til å utløse friskmeldingen.
test('ukjent uten alarm gir ukjent, ikke rolig', () => {
  const state = combinedAlarms([at(0), at(null)]);
  assert.equal(state.smoke, null);
});

// Ingen enheter er mangel på data, ikke bevis på at det ikke brenner. Uten
// dette ville en omstart eller en ny innlogging sett ut som at alarmen ga seg.
test('tom liste gir ukjent, ikke rolig', () => {
  const state = combinedAlarms([]);
  assert.equal(state.smoke, null);
  assert.equal(state.any, null);
});
