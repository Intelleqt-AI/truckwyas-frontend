import { CAPITAL_LAUNCHED } from '@/lib/features';
import CapitalPrelaunch from '@/components/capital/CapitalPrelaunch';
import FastPayLaunched from '@/components/capital/FastPayLaunched';

/**
 * Fast Pay has no funding partner yet (CAPITAL_LAUNCHED = false), so the page
 * renders the pre-launch view: no line, limit or availability is shown.
 * Launching is the one-line flag flip; the launched view then reads every
 * figure from the server (capital/status, capital/fast-pay/*).
 */
export default function Capital() {
  return CAPITAL_LAUNCHED ? <FastPayLaunched /> : <CapitalPrelaunch />;
}
