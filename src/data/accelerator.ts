/**
 * Data transcribed from the author's ICICM 2026 presentation and accepted paper.
 * Grid: slide 5; paper Table II and Figure 2(a).
 * Windows: slide 7; paper Sections IV-B.5 / V-E and Figure 3.
 * Keep counts, per-operand capacities, and cycle windows distinct.
 */
export const gridOutcomes = [
  { bufferKiWords: 1, failures: 144, total: 153, control: false },
  { bufferKiWords: 4, failures: 117, total: 153, control: false },
  { bufferKiWords: 16, failures: 72, total: 153, control: false },
  { bufferKiWords: 512, failures: 0, total: 153, control: true },
] as const;

export const windowComparison = [
  {
    key: 'compute',
    label: 'Compute field',
    wsCycles: 16471,
    osCycles: 20991,
    bestDataflow: 'WS',
    definition: 'Time of the final SRAM service.',
  },
  {
    key: 'cold',
    label: 'Cold interval',
    wsCycles: 82006,
    osCycles: 56830,
    bestDataflow: 'OS',
    definition: 'From the first input or weight DRAM read to the last output DRAM write.',
  },
] as const;

export const windowStudy = {
  changedShapes: 13,
  totalShapes: 17,
  admittedConfigurations: 51,
  bufferKiWords: 512,
  bandwidthWordsPerCycle: 4,
  arrayRows: 8,
  arrayColumns: 8,
  layer: 'MN conv0',
  tiesRetained: true,
  units: 'cycles',
  title: 'Dataflow rankings depend on the measurement window.',
  summary:
    'We compared 51 configurations that passed the study’s admission checks. Switching between the compute field and the cold interval changed the set of fastest dataflows for 13 of the 17 layer shapes, with ties retained. In MN conv0, the same WS and OS runs reverse order between the two windows. A cycle count’s measurement window can therefore change the dataflow a designer would choose.',
  meaning:
    'A shape is counted when its set of dataflows with the lowest cycle count differs between the two windows. Tied minima are retained.',
  source:
    'ICICM 2026 oral presentation, slide 7; paper Section V-E and Figure 3.',
} as const;
