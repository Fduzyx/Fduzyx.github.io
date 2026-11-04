/** Selected honors, with the academic context before the award level. */
export interface Honor {
  year: number;
  title: string;
  context: string;
  url?: string;
}

export const honors: readonly Honor[] = [
  {
    year: 2026,
    title: 'ICICM 2026',
    context: 'Best Presentation Award (session) · Xi’an, China',
    url: 'https://krz.engineer/news/#icicm-best-presentation-2026',
  },
  {
    year: 2026,
    title: 'National College Student IC Innovation & Entrepreneurship Competition',
    context: 'East China Regional Second Prize · LoongArch track',
  },
  {
    year: 2025,
    title: 'Fudan University',
    context: 'Freshman Scholarship',
  },
  {
    year: 2025,
    title: '17th National Undergraduate Mathematics Competition',
    context: 'Third Prize · Shanghai, Non-Math A',
  },
  {
    year: 2024,
    title: '41st Chinese Physics Olympiad',
    context: 'First Prize · Jiangsu Division',
  },
] as const;
