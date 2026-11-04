/** Preserve the CV author order and distinguish acceptance from publication. */
export const publications = [
  {
    id: 'icicm-2026',
    year: 2026,
    title: 'Beyond Capacity Checks: Read-Trace Consistency in Systolic-Array Simulator Evaluation',
    authors: ['Yixuan Zhuang', 'Shiting Wang', 'Ruiyao Qin', 'Keren Zhu'],
    conference: '11th International Conference on Integrated Circuits and Microsystems',
    acronym: 'ICICM 2026',
    location: 'Xi’an, China',
    status: 'Accepted conference paper',
    presentation: 'Oral presentation, 17 October 2026',
    presentationDate: '2026-10-17',
    award: 'Best Presentation Award (session)',
    links: [
      { title: 'Lab announcement', url: 'https://krz.engineer/news/#icicm-best-presentation-2026' },
      { title: 'Research group publication record', url: 'https://krz.engineer/publications/#paper-C68' },
    ],
    // No verified proceedings URL, paper PDF, or DOI has been supplied.
  },
] as const;
