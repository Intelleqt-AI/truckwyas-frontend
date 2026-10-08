// Describe the load (typed / voice): copy, chips, Replace / Keep, language chip.
import assert from 'node:assert/strict';
import { vt, uiLangFrom, nextLangMode, langModeText, listeningLangLine, loadLangMode, heardBadge, voiceErrorText,
  shortDate, tonnes, randPerL, borderPostShort, vehicleHintName, tripShapeText, buildFillChips, didntCatchLine,
  sameText, samePlace, isConflict, replaceQuestion, FIELD_LABELS, isLow, spokenPlace } from '../src/lib/voiceQuote.ts';

// copy (spec §5, exact strings)
assert.equal(vt('en', 'listening'), 'Listening…');
assert.equal(vt('af', 'listening'), 'Luister…');
assert.equal(vt('af', 'lang_auto'), 'Engels of Afrikaans');
assert.equal(vt('af', 'reading'), 'Lees…');
assert.equal(vt('af', 'check_this'), 'Kyk gerus');
assert.equal(vt('af', 'too_long'), 'Gestop by 1 minuut');
assert.equal(vt('af', 'undo'), 'Ontdoen');
assert.equal(vt('af', 'replace_q', { n: 2 }), 'Vervang 2 velde?');
assert.equal(vt('af', 'keep'), 'Hou myne');
assert.equal(vt('af', 'mic_label'), 'Neem stembeskrywing op');
assert.equal(vt('en', 'placeholder'), 'Describe the load, e.g. 28 t steel coils Joburg to Durban');
assert.equal(vt('af', 'placeholder'), 'Beskryf die vrag, bv. 28 ton staalrolle Joburg na Durban');
assert.equal(vt('af', 'pick_truck', { hint: 'Superlink' }), 'Superlink? Kies ’n trok');
assert.equal(uiLangFrom('af'), 'af');
assert.equal(uiLangFrom('en'), 'en');
assert.equal(uiLangFrom(null), 'en');

// language chip: Auto → English → Afrikaans → Auto; default Auto without storage
assert.equal(nextLangMode('auto'), 'en');
assert.equal(nextLangMode('en'), 'af');
assert.equal(nextLangMode('af'), 'auto');
assert.equal(loadLangMode(), 'auto', 'no window/localStorage: Auto, no throw');
assert.equal(langModeText('auto', 'af'), 'Auto');
assert.equal(vt('af', 'said', { place: 'Kaapstad' }), 'gesê “Kaapstad”');
assert.equal(listeningLangLine('auto', 'en'), 'English or Afrikaans');
assert.equal(listeningLangLine('af', 'en'), 'Afrikaans');
assert.equal(listeningLangLine('en', 'af'), 'Engels');

// heard badge
assert.equal(heardBadge('en', 'Afrikaans', 'high'), 'Heard in Afrikaans');
assert.equal(heardBadge('af', 'Afrikaans', 'chosen'), 'Gehoor in Afrikaans');
assert.equal(heardBadge('en', 'Afrikaans', 'low'), 'Heard in English + Afrikaans');
assert.equal(heardBadge('af', 'English', 'low'), 'Engels + Afrikaans gehoor');
assert.equal(heardBadge('en', null, null), null);

// voice errors: server text in English, Afrikaans by status
assert.equal(voiceErrorText(422, "Didn't catch any speech", 'en'), "Didn't catch any speech — try again a bit closer to the mic.");
assert.equal(voiceErrorText(503, 'Voice input is not configured.', 'en'), 'Voice input is not configured.');
assert.equal(voiceErrorText(422, 'x', 'af'), 'Niks gehoor nie — probeer weer, bietjie nader aan die mikrofoon.');
assert.ok(voiceErrorText(413, 'too long', 'af').includes('te lank'));
assert.ok(voiceErrorText(null, null, 'af').length > 0);

// wording
assert.equal(shortDate('2026-10-09', 'en', 2026), '9 Oct');
assert.equal(shortDate('2026-10-09', 'af', 2026), '9 Okt');
assert.equal(shortDate('2027-03-01', 'af', 2026), '1 Mrt 2027');
assert.equal(tonnes(28000), '28 t');
assert.equal(tonnes(7500), '7,5 t');
assert.equal(randPerL(23.5), 'R 23,50');
assert.equal(borderPostShort('Oshoek / Ngwenya'), 'Oshoek');
assert.equal(borderPostShort('Beitbridge'), 'Beitbridge');
assert.equal(vehicleHintName('interlink'), 'Superlink');
assert.equal(tripShapeText('ONE_WAY', false, 'af'), 'eenrigting, leeg terug');
assert.equal(tripShapeText('ROUND_TRIP', undefined, 'en'), 'round trip, loaded both ways');
assert.equal(tripShapeText(undefined, undefined, 'en'), null);

// chips: one per field set, in order route, load, truck, client, dates, trip, cross-border
{
  const chips = buildFillChips({
    pickupDate: '2026-10-09', tripType: 'ONE_WAY', returnLoadBooked: false, cargo: 'staalrolle', weightKg: 28000,
    pickup: 'Johannesburg', delivery: 'Durban', borderPost: 'Beitbridge', international: true,
  }, { weight: 0.95, pickup_location: 0.8, delivery_location: 0.9, pickup_date: 0.6, cargo_description: 0.9, trip_type: 0.95, return_load_booked: 0.9 }, 'af');
  assert.deepEqual(chips.map(c => c.key), ['route', 'load', 'pickup_date', 'trip', 'border']);
  assert.deepEqual(chips.map(c => c.text), ['Johannesburg → Durban', '28 t staalrolle', 'Oplaai 9 Okt', 'Eenrigting, leeg terug', 'Oorgrens (Beitbridge)']);
  assert.deepEqual(chips.map(c => c.check), [false, false, true, false, false]);
  assert.equal(chips[2].aria, 'Oplaai 9 Okt, ingevul, kyk gerus');
  assert.equal(chips[1].target, 'weight');
  assert.equal(chips[3].target, 'return');
}
{
  const chips = buildFillChips({ weightKg: 28000 }, { weight: 0.5 }, 'en');
  assert.equal(chips[0].aria, '28 t, filled, check this');
  assert.equal(chips[0].check, true);
  assert.deepEqual(buildFillChips({}, {}, 'en'), []);
  const stops = buildFillChips({ stops: ['Upington'] }, {}, 'en');
  assert.equal(stops[0].text, 'Via Upington');
}
assert.equal(isLow({ weight: 0.69 }, 'weight'), true);
assert.equal(isLow({ weight: 0.7 }, 'weight'), false);
assert.equal(isLow({}, 'weight'), false);

// not understood
assert.equal(didntCatchLine(['number 28 — tons or kg?'], 'en'), "Didn't catch: number 28 — tons or kg?");
assert.equal(didntCatchLine(['a', 'b'], 'af'), 'Nie verstaan nie: a; b');
assert.equal(didntCatchLine([], 'en'), null);
assert.equal(didntCatchLine(undefined, 'en'), null);

// conflicts: only the user's own, differing values
assert.equal(isConflict('', '28', undefined), false, 'empty field fills straight away');
assert.equal(isConflict('20', '28', undefined), true, 'typed 20, said 28: ask');
assert.equal(isConflict('20', '28', '20'), false, 'an earlier Fill set it: replace without asking');
assert.equal(isConflict('Cape Town', 'cape town', undefined), false);
assert.equal(sameText('Cape Town, ', 'cape  town'), true);
assert.equal(samePlace({ lat: -33.9249, lon: 18.4241 }, { lat: -33.93, lon: 18.43 }), true, 'Kaapstad = Cape Town');
assert.equal(samePlace({ lat: -33.9249, lon: 18.4241 }, { lat: -29.8587, lon: 31.0218 }), false);
assert.equal(samePlace(null, { lat: 0, lon: 0 }), false);
assert.equal(replaceQuestion([{ label: 'Weight', from: '20 t', to: '28 t' }, { label: 'Delivery', from: 'Cape Town', to: 'Durban' }], 'en'),
  'Replace 2 fields? Weight 20 t → 28 t · Delivery Cape Town → Durban');
assert.equal(replaceQuestion([{ label: FIELD_LABELS.af.weight, from: '20 t', to: '28 t' }], 'af'), 'Vervang 1 veld? Gewig 20 t → 28 t');

console.log('voice quote: ok');
assert.equal(buildFillChips({ pickup: 'Bloemfontein', stops: ['Upington'] }, {}, 'en')[0].text, 'Bloemfontein via Upington');
assert.equal(buildFillChips({ delivery: 'Durban' }, {}, 'af')[0].text, 'Durban');
console.log('voice quote route chip: ok');

// the field gets the geocodable name; the chip says it as the user did
assert.equal(spokenPlace('Cape Town', 'staal van Joburg na Kaapstad môre'), 'Kaapstad');
assert.equal(spokenPlace('Cape Town', 'steel from Joburg to Cape Town'), 'Cape Town');
assert.equal(spokenPlace('Richards Bay', 'na richardsbaai'), 'Richardsbaai');
assert.equal(spokenPlace('Durban', 'na Durban'), 'Durban');
assert.equal(spokenPlace('Cape Town', 'x', 'Kaapstad'), 'Kaapstad', 'server spoken form wins');
console.log('voice quote spoken places: ok');
assert.equal(vehicleHintName('other', 'lowbed'), 'Lowbed');
assert.equal(vehicleHintName('other', null), 'Other');
assert.equal(vehicleHintName('interlink', 'superlink'), 'Superlink');
assert.equal(vt('en', 'pick_truck', { hint: vehicleHintName('other', 'Lowbed') }), 'Lowbed? Pick a truck');
console.log('voice quote other hint: ok');
