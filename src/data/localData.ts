// This file is used for local development in AI Studio to save Firestore reads.
// Production users will still fetch from live Firebase bundles.

import { Subject, Topic } from '../types';

export const LOCAL_SUBJECTS: Subject[] = [
  { id: 'polity', slug: 'polity', title: 'Polity', description: 'Constitutional framework, Governance, and Rights.', status: 'live', order: 1, pdfVisible: true, pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', pdfAccessType: 'free' },
  { id: 'modern-history', slug: 'modern-history', title: 'Modern History', description: 'Freedom struggle and constitutional developments.', status: 'live', order: 2, pdfVisible: true, pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', pdfAccessType: 'premium' },
  { id: 'geography', slug: 'geography', title: 'Geography', description: 'Physical, Economic, and Human Geography.', status: 'live', order: 3, pdfVisible: true, pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', pdfAccessType: 'premium' },
  { id: 'economy', slug: 'economy', title: 'Economy', description: 'Macroeconomics, Banking, and Budgets.', status: 'live', order: 4 },
  { id: 'environment', slug: 'environment', title: 'Environment', description: 'Biodiversity, Climate Change, and Conventions.', status: 'live', order: 5 },
  { id: 'science-tech', slug: 'science-tech', title: 'Science & Tech', description: 'Biotech, Space, AI, and Cybersecurity.', status: 'live', order: 6 },
  { id: 'art-culture', slug: 'art-culture', title: 'Art & Culture', description: 'Architecture, Dances, and Heritage.', status: 'live', order: 7 },
  { id: 'ancient-history', slug: 'ancient-history', title: 'Ancient History', description: 'IVC, Vedic Age, and Early Empires.', status: 'live', order: 8 },
  { id: 'medieval-history', slug: 'medieval-history', title: 'Medieval History', description: 'Sultanate, Mughals, and Bhakti Movement.', status: 'live', order: 9 },
  { id: 'miscellaneous', slug: 'miscellaneous', title: 'Miscellaneous', description: 'Reports, Schemes, and Mapping.', status: 'live', order: 10 }
];

export const LOCAL_TOPICS: Topic[] = [
  { 
    id: 'article-21-sample', 
    subjectSlug: 'polity', 
    chapter: 'Fundamental Rights', 
    title: 'Article 21 – Right to Life', 
    slug: 'article-21-right-to-life', 
    status: 'free', 
    order: 1, 
    teaser: 'Detailed analysis of Right to Life and Personal Liberty.', 
    examRelevance: 'High',
    estimatedTime: '15 mins',
    lastUpdated: 1714521600000,
    pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    infographicUrl: 'https://placehold.co/1200x800/6366f1/white?text=Article+21+Infographic'
  },
  { 
    id: 'preamble-sample', 
    subjectSlug: 'polity', 
    chapter: 'Basics of Constitution', 
    title: 'The Preamble', 
    slug: 'preamble', 
    status: 'free', 
    order: 2, 
    teaser: 'Overview of the Preamble of the Indian Constitution.', 
    examRelevance: 'High',
    estimatedTime: '10 mins',
    lastUpdated: 1714521600000,
    pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
  }
];
