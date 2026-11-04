/** Public identity, academic copy, and the owner's dated Codex profile snapshot. */
const aboutParagraphs = [
  'I study Microelectronics Science and Engineering in Fudan University’s Shannon Program. My work focuses on hardware evaluation: how simulators account for memory traffic, how their measurements shape architecture comparisons, and how model predictions compare with RTL.',
  'In the FDUROP Xiyuan Program, I led a three-student study advised by Prof. Keren Zhu (CODA Lab). We examined read-trace consistency in SCALE-Sim and the effect of measurement windows on dataflow rankings. I presented the work at ICICM 2026, where my oral presentation received the Best Presentation Award (session).',
  'I am interested in design automation for AI hardware, especially using system-level models to compare architectural choices and test them against RTL and physical implementations.',
] as const;

export const profile = {
  name: 'Yixuan Zhuang',
  email: 'yixuan@yixuanzhuang.com',
  github: 'https://github.com/Fduzyx',
  location: 'Shanghai, China',
  title: 'Undergraduate Student · Fudan University',
  description:
    'Studying memory systems and accelerator design, from architectural models to implementation.',
  about: aboutParagraphs.join(' '),
  aboutParagraphs,
  // Public profile snapshot supplied by the owner; update the figures and date together.
  aiPractice: {
    description: 'I use Codex extensively to build, test, and refine software.',
    url: 'https://chatgpt.com/u/yixuanzhuang',
    snapshotDate: '2026-11',
    snapshotLabel: 'November 2026',
    stats: [
      { value: '12.31B', label: 'total tokens', expansion: ' (12.31 billion)' },
      { value: '60', label: 'Codex skills explored', expansion: '' },
    ],
  },
  education: {
    institution: 'Fudan University',
    college: 'College of Integrated Circuits and Micro-Nano Electronics',
    program: 'Shannon Program',
    degree: 'B.Eng. candidate · Microelectronics Science and Engineering',
    period: 'Sep 2025 – expected 2029',
  },
  interests: ['Computer Architecture', 'AI Accelerators', 'AI for EDA', 'VLSI / IC Design'],
  cv: '/Yixuan_Zhuang_CV.pdf',
} as const;
