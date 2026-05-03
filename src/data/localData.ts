// This file is used for local development in AI Studio to save Firestore reads.
// Production users will still fetch from live Firebase bundles.

export const LOCAL_SUBJECTS = [
  { id: 'polity', slug: 'polity', title: 'Polity', description: 'Constitutional framework, Governance, and Rights.', status: 'live', order: 1, pdfVisible: true, pdfUrl: 'https://drive.google.com/file/d/1IV_F-sX-skN05ghwhUK09oYSgmKR0qyN/view?usp=drivesdk' },
  { id: 'modern-history', slug: 'modern-history', title: 'Modern History', description: 'Freedom struggle and constitutional developments.', status: 'live', order: 2, pdfVisible: true, pdfUrl: 'https://drive.google.com/file/d/1rOceMHQajFUVAARX5QrDY8TON7fpt_qV/view?usp=drivesdk' },
  { id: 'geography', slug: 'geography', title: 'Geography', description: 'Physical, Economic, and Human Geography.', status: 'live', order: 3, pdfVisible: true, pdfUrl: 'https://drive.google.com/file/d/1SORcNQIDPqh6cdkzsGSOX4V0e1lTZefB/view?usp=drivesdk' },
  { id: 'economy', slug: 'economy', title: 'Economy', description: 'Macroeconomics, Banking, and Budgets.', status: 'live', order: 4, pdfVisible: true, pdfUrl: 'https://drive.google.com/file/d/1C-CglepNvA5KWOvHWHHTgkfEuwsi0A02/view?usp=drivesdk' },
  { id: 'environment', slug: 'environment', title: 'Environment', description: 'Biodiversity, Climate Change, and Conventions.', status: 'live', order: 5 },
  { id: 'science-tech', slug: 'science-tech', title: 'Science & Tech', description: 'Biotech, Space, AI, and Cybersecurity.', status: 'live', order: 6 },
  { id: 'art-culture', slug: 'art-culture', title: 'Art & Culture', description: 'Architecture, Dances, and Heritage.', status: 'live', order: 7 },
  { id: 'ancient-history', slug: 'ancient-history', title: 'Ancient History', description: 'IVC, Vedic Age, and Early Empires.', status: 'live', order: 8, pdfVisible: true, pdfUrl: 'https://drive.google.com/file/d/15BdmcbmzWgCMOKHBfu3Ym1IR77LATs13/view?usp=drivesdk' },
  { id: 'medieval-history', slug: 'medieval-history', title: 'Medieval History', description: 'Sultanate, Mughals, and Bhakti Movement.', status: 'live', order: 9 },
  { id: 'miscellaneous', slug: 'miscellaneous', title: 'Miscellaneous', description: 'Reports, Schemes, and Mapping.', status: 'live', order: 10 }
];

export const LOCAL_TOPICS = [
  { id: 'article-21-sample', subjectSlug: 'polity', chapter: 'Fundamental Rights', title: 'Article 21 – Right to Life', slug: 'article-21-right-to-life', status: 'free', order: 1, teaser: 'Detailed analysis of Right to Life and Personal Liberty.' },
  { id: 'preamble-sample', subjectSlug: 'polity', chapter: 'Basics of Constitution', title: 'The Preamble', slug: 'preamble', status: 'free', order: 2, teaser: 'Overview of the Preamble of the Indian Constitution.' },
  { id: 'revolt-sample', subjectSlug: 'modern-history', chapter: 'Revolt of 1857', title: 'Revolt of 1857', slug: 'revolt-1857', status: 'free', order: 1, teaser: 'Causes and consequences of the first war of independence.' }
];
