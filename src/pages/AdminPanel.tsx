import { LayoutDashboard, Plus, Settings, FileText, BookOpen, Edit2, Trash2, Zap, ExternalLink, Save, X, AlertCircle, Info, Sparkles, Users, LogOut, ChevronRight, Eye, Copy, Menu, Layout, Target, Filter, CheckCircle2, ShieldCheck, Bell, Send, AlertTriangle, Upload, RefreshCw, Image } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { Badge, Button, Card, Modal } from '../components/UI';
import { collection, doc, setDoc, writeBatch, deleteDoc, addDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../firebase';
import { toast } from 'sonner';
import { useSubjects, useTopics, useSettings, useNotifications } from '../hooks/useData';
import { useAuth } from '../contexts/AuthContext';
import { Subject, Topic, AppSettings, AppNotification, Coupon } from '../types';
import { cn } from '../lib/utils';
import { bundleService } from '../services/bundleService';

export const INITIAL_SUBJECTS = [
  { id: 'polity', slug: 'polity', title: 'Polity', description: 'Constitutional framework, Governance, and Rights.', status: 'live', order: 1 },
  { id: 'modern-history', slug: 'modern-history', title: 'Modern History', description: 'Freedom struggle and constitutional developments.', status: 'live', order: 2 },
  { id: 'geography', slug: 'geography', title: 'Geography', description: 'Physical, Economic, and Human Geography.', status: 'live', order: 3 },
  { id: 'economy', slug: 'economy', title: 'Economy', description: 'Macroeconomics, Banking, and Budgets.', status: 'live', order: 4 },
  { id: 'environment', slug: 'environment', title: 'Environment', description: 'Biodiversity, Climate Change, and Conventions.', status: 'live', order: 5 },
  { id: 'science-tech', slug: 'science-tech', title: 'Science & Tech', description: 'Biotech, Space, AI, and Cybersecurity.', status: 'live', order: 6 },
  { id: 'art-culture', slug: 'art-culture', title: 'Art & Culture', description: 'Architecture, Dances, and Heritage.', status: 'live', order: 7 },
  { id: 'ancient-history', slug: 'ancient-history', title: 'Ancient History', description: 'IVC, Vedic Age, and Early Empires.', status: 'live', order: 8 },
  { id: 'medieval-history', slug: 'medieval-history', title: 'Medieval History', description: 'Sultanate, Mughals, and Bhakti Movement.', status: 'live', order: 9 },
  { id: 'miscellaneous', slug: 'miscellaneous', title: 'Miscellaneous', description: 'Reports, Schemes, and Mapping.', status: 'live', order: 10 },
];

export const TOPIC_PLACEHOLDERS: any[] = [
  // Polity
  { subjectSlug: 'polity', chapter: 'Fundamental Rights', title: 'Article 21 – Right to Life', slug: 'article-21-right-to-life', status: 'free', order: 1 },
  { subjectSlug: 'polity', chapter: 'Basics of Constitution', title: 'The Preamble', slug: 'preamble', status: 'free', order: 2 },
  { subjectSlug: 'polity', chapter: 'Fundamental Rights', title: 'Fundamental Rights Overview', slug: 'fundamental-rights', status: 'coming_soon', order: 3 },
  { subjectSlug: 'polity', chapter: 'Directive Principles', title: 'DPSP', slug: 'dpsp', status: 'coming_soon', order: 4 },
  { subjectSlug: 'polity', chapter: 'Union Government', title: 'Parliament', slug: 'parliament', status: 'coming_soon', order: 5 },
  { subjectSlug: 'polity', chapter: 'Judiciary', title: 'Supreme Court', slug: 'supreme-court', status: 'coming_soon', order: 6 },
  { subjectSlug: 'polity', chapter: 'Constitutional Bodies', title: 'Election Commission', slug: 'election-commission', status: 'coming_soon', order: 7 },
  { subjectSlug: 'polity', chapter: 'Constitutional Bodies', title: 'UPSC', slug: 'upsc-body', status: 'coming_soon', order: 8 },
  { subjectSlug: 'polity', chapter: 'Constitutional Bodies', title: 'Finance Commission', slug: 'finance-commission', status: 'coming_soon', order: 9 },
  { subjectSlug: 'polity', chapter: 'Constitutional Bodies', title: 'CAG', slug: 'cag', status: 'coming_soon', order: 10 },
  { subjectSlug: 'polity', chapter: 'Local Government', title: 'Panchayati Raj', slug: 'panchayati-raj', status: 'coming_soon', order: 11 },
  { subjectSlug: 'polity', chapter: 'Local Government', title: 'Municipalities', slug: 'municipalities', status: 'coming_soon', order: 12 },
  { subjectSlug: 'polity', chapter: 'Historical Background', title: 'Historical Background', slug: 'historical-background', status: 'coming_soon', order: 13 },
  { subjectSlug: 'polity', chapter: 'Basics of Constitution', title: 'Making of the Constitution', slug: 'making-of-constitution', status: 'coming_soon', order: 14 },
  { subjectSlug: 'polity', chapter: 'Basics of Constitution', title: 'Salient Features', slug: 'salient-features', status: 'coming_soon', order: 15 },
  { subjectSlug: 'polity', chapter: 'Union & Territory', title: 'Union & Territory', slug: 'union-territory', status: 'coming_soon', order: 16 },
  { subjectSlug: 'polity', chapter: 'Citizenship', title: 'Citizenship', slug: 'citizenship', status: 'coming_soon', order: 17 },
  { subjectSlug: 'polity', chapter: 'Fundamental Duties', title: 'Fundamental Duties', slug: 'fundamental-duties', status: 'coming_soon', order: 18 },
  { subjectSlug: 'polity', chapter: 'Amendment', title: 'Amendment of Constitution', slug: 'amendment-constitution', status: 'coming_soon', order: 19 },
  { subjectSlug: 'polity', chapter: 'Basics of Constitution', title: 'Basic Structure', slug: 'basic-structure', status: 'coming_soon', order: 20 },
  { subjectSlug: 'polity', chapter: 'Emergency Provisions', title: 'Emergency Provisions', slug: 'emergency-provisions', status: 'coming_soon', order: 21 },
  { subjectSlug: 'polity', chapter: 'Union Executive', title: 'President & Vice-President', slug: 'president-vp', status: 'coming_soon', order: 22 },
  { subjectSlug: 'polity', chapter: 'Union Executive', title: 'PM & Council of Ministers', slug: 'pm-council', status: 'coming_soon', order: 23 },
  { subjectSlug: 'polity', chapter: 'Union Government', title: 'Parliamentary Committees', slug: 'parliamentary-committees', status: 'coming_soon', order: 24 },
  { subjectSlug: 'polity', chapter: 'Judiciary', title: 'High Courts & Subordinate Courts', slug: 'high-courts', status: 'coming_soon', order: 25 },
  { subjectSlug: 'polity', chapter: 'State Executive', title: 'Governor', slug: 'governor', status: 'coming_soon', order: 26 },
  { subjectSlug: 'polity', chapter: 'State Government', title: 'State Legislature', slug: 'state-legislature', status: 'coming_soon', order: 27 },
  { subjectSlug: 'polity', chapter: 'Special Provisions', title: 'Special Provisions for States', slug: 'special-provisions-states', status: 'coming_soon', order: 28 },
  { subjectSlug: 'polity', chapter: 'Elections', title: 'Anti-Defection Law', slug: 'anti-defection', status: 'coming_soon', order: 29 },
  { subjectSlug: 'polity', chapter: 'Elections', title: 'Electoral Reforms', slug: 'electoral-reforms', status: 'coming_soon', order: 30 },
  
  // Modern History
  { subjectSlug: 'modern-history', chapter: 'Revolt of 1857', title: 'Revolt of 1857', slug: 'revolt-1857', status: 'coming_soon', order: 1 },
  { subjectSlug: 'modern-history', chapter: 'Gandhian Era', title: 'Gandhian Movements', slug: 'gandhian-movements', status: 'coming_soon', order: 2 },
  { subjectSlug: 'modern-history', chapter: 'Political Organizations', title: 'INC Sessions', slug: 'inc-sessions', status: 'coming_soon', order: 3 },
  { subjectSlug: 'modern-history', chapter: 'Constitutional History', title: 'Constitutional Developments', slug: 'const-developments', status: 'coming_soon', order: 4 },
  { subjectSlug: 'modern-history', chapter: 'Social Reforms', title: 'Socio-Religious Reforms', slug: 'social-reforms', status: 'coming_soon', order: 5 },
  { subjectSlug: 'modern-history', chapter: 'British Policies', title: 'Economic Impact of British Rule', slug: 'economic-impact', status: 'coming_soon', order: 6 },
  { subjectSlug: 'modern-history', chapter: 'British Policies', title: 'Land Revenue Systems', slug: 'land-revenue', status: 'coming_soon', order: 7 },
  { subjectSlug: 'modern-history', chapter: 'Freedom Struggle', title: 'Revolutionary Movements', slug: 'revolutionary-movements', status: 'coming_soon', order: 8 },
  { subjectSlug: 'modern-history', chapter: 'Freedom Struggle', title: 'Subhash Chandra Bose & INA', slug: 'ina', status: 'coming_soon', order: 9 },
  { subjectSlug: 'modern-history', chapter: 'Post Independence', title: 'Integration of Princely States', slug: 'integration', status: 'coming_soon', order: 10 },
  { subjectSlug: 'modern-history', chapter: 'Early Phase', title: 'Advent of Europeans', slug: 'advent-europeans', status: 'coming_soon', order: 11 },
  { subjectSlug: 'modern-history', chapter: 'British Policies', title: 'British Conquest of India', slug: 'british-conquest', status: 'coming_soon', order: 12 },
  { subjectSlug: 'modern-history', chapter: 'Early Phase', title: 'Early Uprisings', slug: 'early-uprisings', status: 'coming_soon', order: 13 },
  { subjectSlug: 'modern-history', chapter: 'Nationalism', title: 'Rise of Nationalism & INC', slug: 'rise-nationalism', status: 'coming_soon', order: 14 },
  { subjectSlug: 'modern-history', chapter: 'Nationalism', title: 'Moderate & Extremist Phases', slug: 'moderate-extremist', status: 'coming_soon', order: 15 },
  { subjectSlug: 'modern-history', chapter: 'Freedom Struggle', title: 'Partition of Bengal & Swadeshi', slug: 'partition-swadeshi', status: 'coming_soon', order: 16 },
  { subjectSlug: 'modern-history', chapter: 'Freedom Struggle', title: 'Revolutionary Terrorism', slug: 'revolutionary-terrorism', status: 'coming_soon', order: 17 },
  { subjectSlug: 'modern-history', chapter: 'Freedom Struggle', title: 'Home Rule League', slug: 'home-rule-league', status: 'coming_soon', order: 18 },
  { subjectSlug: 'modern-history', chapter: 'Freedom Struggle', title: 'Round Table Conferences', slug: 'rtc', status: 'coming_soon', order: 19 },
  { subjectSlug: 'modern-history', chapter: 'British Policies', title: 'Development of Education & Press', slug: 'education-press', status: 'coming_soon', order: 20 },

  // Geography
  { subjectSlug: 'geography', chapter: 'Indian Climate', title: 'Monsoon Mechanism', slug: 'monsoon', status: 'coming_soon', order: 1 },
  { subjectSlug: 'geography', chapter: 'Indian Soils', title: 'Soil Types of India', slug: 'soils', status: 'coming_soon', order: 2 },
  { subjectSlug: 'geography', chapter: 'Drainage System', title: 'Rivers of India', slug: 'rivers', status: 'coming_soon', order: 3 },
  { subjectSlug: 'geography', chapter: 'Indian Climate', title: 'Climate of India', slug: 'climate', status: 'coming_soon', order: 4 },
  { subjectSlug: 'geography', chapter: 'Physical Geography', title: 'Himalayas', slug: 'himalayas', status: 'coming_soon', order: 5 },
  { subjectSlug: 'geography', chapter: 'Physical Geography', title: 'Peninsular Plateau', slug: 'peninsular-plateau', status: 'coming_soon', order: 6 },
  { subjectSlug: 'geography', chapter: 'Economic Geography', title: 'Agriculture in India', slug: 'agriculture', status: 'coming_soon', order: 7 },
  { subjectSlug: 'geography', chapter: 'Economic Geography', title: 'Mineral Resources', slug: 'minerals', status: 'coming_soon', order: 8 },
  { subjectSlug: 'geography', chapter: 'World Geography', title: 'Ocean Currents', slug: 'ocean-currents', status: 'coming_soon', order: 9 },
  { subjectSlug: 'geography', chapter: 'World Geography', title: 'Major Climatic Regions', slug: 'climatic-regions', status: 'coming_soon', order: 10 },
  { subjectSlug: 'geography', chapter: 'General Geography', title: 'Universe & Solar System', slug: 'universe-solar-system', status: 'coming_soon', order: 11 },
  { subjectSlug: 'geography', chapter: 'Physical Geography', title: 'Interior of Earth & Plate Tectonics', slug: 'earth-interior', status: 'coming_soon', order: 12 },
  { subjectSlug: 'geography', chapter: 'Physical Geography', title: 'Earthquakes & Volcanoes', slug: 'earthquakes-volcanoes', status: 'coming_soon', order: 13 },
  { subjectSlug: 'geography', chapter: 'Physical Geography', title: 'Rocks & Landforms', slug: 'rocks-landforms', status: 'coming_soon', order: 14 },
  { subjectSlug: 'geography', chapter: 'Climatology', title: 'Atmosphere & Winds', slug: 'atmosphere-winds', status: 'coming_soon', order: 15 },
  { subjectSlug: 'geography', chapter: 'Climatology', title: 'Cyclones & Jet Streams', slug: 'cyclones-jet-streams', status: 'coming_soon', order: 16 },
  { subjectSlug: 'geography', chapter: 'Oceanography', title: 'Ocean Relief & Currents', slug: 'ocean-relief', status: 'coming_soon', order: 17 },
  { subjectSlug: 'geography', chapter: 'Oceanography', title: 'Salinity & Tides', slug: 'salinity-tides', status: 'coming_soon', order: 18 },
  { subjectSlug: 'geography', chapter: 'World Geography', title: 'World Climatic Regions', slug: 'world-climates', status: 'coming_soon', order: 19 },
  { subjectSlug: 'geography', chapter: 'Mapping', title: 'Important Straits & Canals', slug: 'straits-canals', status: 'coming_soon', order: 20 },

  // Economy
  { subjectSlug: 'economy', chapter: 'Monetary Policy', title: 'Inflation', slug: 'inflation', status: 'coming_soon', order: 1 },
  { subjectSlug: 'economy', chapter: 'Fiscal Policy', title: 'Fiscal Deficit', slug: 'fiscal-deficit', status: 'coming_soon', order: 2 },
  { subjectSlug: 'economy', chapter: 'Monetary Policy', title: 'Monetary Policy', slug: 'monetary-policy', status: 'coming_soon', order: 3 },
  { subjectSlug: 'economy', chapter: 'Banking', title: 'Banking Basics', slug: 'banking', status: 'coming_soon', order: 4 },
  { subjectSlug: 'economy', chapter: 'External Sector', title: 'Balance of Payments', slug: 'bop', status: 'coming_soon', order: 5 },
  { subjectSlug: 'economy', chapter: 'External Sector', title: 'Exchange Rates', slug: 'exchange-rates', status: 'coming_soon', order: 6 },
  { subjectSlug: 'economy', chapter: 'Financial Markets', title: 'Capital Market', slug: 'capital-market', status: 'coming_soon', order: 7 },
  { subjectSlug: 'economy', chapter: 'Financial Markets', title: 'Money Market', slug: 'money-market', status: 'coming_soon', order: 8 },
  { subjectSlug: 'economy', chapter: 'Planning', title: 'NITI Aayog', slug: 'niti-aayog', status: 'coming_soon', order: 9 },
  { subjectSlug: 'economy', chapter: 'Taxation', title: 'GST', slug: 'gst', status: 'coming_soon', order: 10 },
  { subjectSlug: 'economy', chapter: 'National Income', title: 'National Income (GDP, GNP)', slug: 'national-income', status: 'coming_soon', order: 11 },
  { subjectSlug: 'economy', chapter: 'Basics', title: 'Inflation & Business Cycles', slug: 'inflation-cycles', status: 'coming_soon', order: 12 },
  { subjectSlug: 'economy', chapter: 'Industry', title: 'Industrial Policy & MSMEs', slug: 'industrial-policy', status: 'coming_soon', order: 13 },
  { subjectSlug: 'economy', chapter: 'Infrastructure', title: 'Infrastructure (Logistics, Energy)', slug: 'infrastructure', status: 'coming_soon', order: 14 },
  { subjectSlug: 'economy', chapter: 'Social Sector', title: 'Poverty & Inequality', slug: 'poverty-inequality', status: 'coming_soon', order: 15 },
  { subjectSlug: 'economy', chapter: 'Social Sector', title: 'Unemployment & Skill Development', slug: 'unemployment', status: 'coming_soon', order: 16 },
  { subjectSlug: 'economy', chapter: 'Banking', title: 'Financial Inclusion & Digital Payments', slug: 'financial-inclusion', status: 'coming_soon', order: 17 },
  { subjectSlug: 'economy', chapter: 'Fiscal Policy', title: 'Subsidies & DBT', slug: 'subsidies-dbt', status: 'coming_soon', order: 18 },
  { subjectSlug: 'economy', chapter: 'External Sector', title: 'Foreign Investment (FDI, FPI)', slug: 'foreign-investment', status: 'coming_soon', order: 19 },
  { subjectSlug: 'economy', chapter: 'Budget', title: 'Economic Survey & Budget Highlights', slug: 'survey-budget', status: 'coming_soon', order: 20 },

  // Environment
  { subjectSlug: 'environment', chapter: 'Biodiversity', title: 'Biodiversity Hotspots', slug: 'biodiversity', status: 'coming_soon', order: 1 },
  { subjectSlug: 'environment', chapter: 'Conservation', title: 'Protected Areas', slug: 'protected-areas', status: 'coming_soon', order: 2 },
  { subjectSlug: 'environment', chapter: 'Climate Change', title: 'Climate Change Basics', slug: 'climate-change', status: 'coming_soon', order: 3 },
  { subjectSlug: 'environment', chapter: 'International Conventions', title: 'Environmental Conventions', slug: 'conventions', status: 'coming_soon', order: 4 },
  { subjectSlug: 'environment', chapter: 'Biodiversity', title: 'National Parks', slug: 'national-parks', status: 'coming_soon', order: 5 },
  { subjectSlug: 'environment', chapter: 'Biodiversity', title: 'Wildlife Sanctuaries', slug: 'wildlife-sanctuaries', status: 'coming_soon', order: 6 },
  { subjectSlug: 'environment', chapter: 'Biodiversity', title: 'Biosphere Reserves', slug: 'biosphere-reserves', status: 'coming_soon', order: 7 },
  { subjectSlug: 'environment', chapter: 'Climate Change', title: 'UNFCCC', slug: 'unfccc', status: 'coming_soon', order: 8 },
  { subjectSlug: 'environment', chapter: 'Climate Change', title: 'Kyoto Protocol', slug: 'kyoto-protocol', status: 'coming_soon', order: 9 },
  { subjectSlug: 'environment', chapter: 'Climate Change', title: 'Paris Agreement', slug: 'paris-agreement', status: 'coming_soon', order: 10 },
  { subjectSlug: 'environment', chapter: 'Ecology', title: 'Ecology & Ecosystem Functions', slug: 'ecology-ecosystem', status: 'coming_soon', order: 11 },
  { subjectSlug: 'environment', chapter: 'Biodiversity', title: 'Biodiversity Hotspots Detailed', slug: 'biodiversity-hotspots', status: 'coming_soon', order: 12 },
  { subjectSlug: 'environment', chapter: 'Pollution', title: 'Environmental Pollution', slug: 'pollution', status: 'coming_soon', order: 13 },
  { subjectSlug: 'environment', chapter: 'Climate Change', title: 'Ozone Depletion & Acid Rain', slug: 'ozone-acid-rain', status: 'coming_soon', order: 14 },
  { subjectSlug: 'environment', chapter: 'International Conventions', title: 'CBD & Nagoya Protocol', slug: 'cbd-nagoya', status: 'coming_soon', order: 15 },
  { subjectSlug: 'environment', chapter: 'Conservation', title: 'Ramsar Convention & Wetlands', slug: 'ramsar-wetlands', status: 'coming_soon', order: 16 },
  { subjectSlug: 'environment', chapter: 'Conservation', title: 'CITES & Wildlife Trade', slug: 'cites', status: 'coming_soon', order: 17 },
  { subjectSlug: 'environment', chapter: 'Laws', title: 'Environmental Laws in India (EPA, WPA)', slug: 'env-laws', status: 'coming_soon', order: 18 },
  { subjectSlug: 'environment', chapter: 'Sustainable Development', title: 'Sustainable Development Goals (SDGs)', slug: 'sdgs', status: 'coming_soon', order: 19 },
  { subjectSlug: 'environment', chapter: 'Conservation', title: 'Forest Survey of India (ISFR)', slug: 'isfr', status: 'coming_soon', order: 20 },

  // Science & Tech
  { subjectSlug: 'science-tech', chapter: 'Biotechnology', title: 'Biotechnology Basics', slug: 'biotech', status: 'coming_soon', order: 1 },
  { subjectSlug: 'science-tech', chapter: 'Space Tech', title: 'Space Missions', slug: 'space', status: 'coming_soon', order: 2 },
  { subjectSlug: 'science-tech', chapter: 'Emerging Tech', title: 'AI Basics', slug: 'ai', status: 'coming_soon', order: 3 },
  { subjectSlug: 'science-tech', chapter: 'Cybersecurity', title: 'Cybersecurity Basics', slug: 'cybersecurity', status: 'coming_soon', order: 4 },
  { subjectSlug: 'science-tech', chapter: 'Space Technology', title: 'ISRO Missions', slug: 'isro-missions', status: 'coming_soon', order: 5 },
  { subjectSlug: 'science-tech', chapter: 'Space Technology', title: 'Launch Vehicles', slug: 'launch-vehicles', status: 'coming_soon', order: 6 },
  { subjectSlug: 'science-tech', chapter: 'Biotechnology', title: 'CRISPR-Cas9', slug: 'crispr', status: 'coming_soon', order: 7 },
  { subjectSlug: 'science-tech', chapter: 'Biotechnology', title: 'Stem Cells', slug: 'stem-cells', status: 'coming_soon', order: 8 },
  { subjectSlug: 'science-tech', chapter: 'Defense', title: 'Missile Systems', slug: 'missiles', status: 'coming_soon', order: 9 },
  { subjectSlug: 'science-tech', chapter: 'Health', title: 'Vaccines', slug: 'vaccines', status: 'coming_soon', order: 10 },
  { subjectSlug: 'science-tech', chapter: 'Biotechnology', title: 'Genetic Engineering', slug: 'genetic-engineering', status: 'coming_soon', order: 11 },
  { subjectSlug: 'science-tech', chapter: 'Emerging Tech', title: 'Blockchain', slug: 'blockchain', status: 'coming_soon', order: 12 },
  { subjectSlug: 'science-tech', chapter: 'Emerging Tech', title: '5G, 6G & Li-Fi', slug: '5g-6g', status: 'coming_soon', order: 13 },
  { subjectSlug: 'science-tech', chapter: 'Emerging Tech', title: 'Quantum Computing', slug: 'quantum-computing', status: 'coming_soon', order: 14 },
  { subjectSlug: 'science-tech', chapter: 'Emerging Tech', title: 'Nanotechnology', slug: 'nanotechnology', status: 'coming_soon', order: 15 },
  { subjectSlug: 'science-tech', chapter: 'Nuclear Tech', title: 'Nuclear Energy Program', slug: 'nuclear-energy', status: 'coming_soon', order: 16 },
  { subjectSlug: 'science-tech', chapter: 'IPR', title: 'Intellectual Property Rights (IPR)', slug: 'ipr', status: 'coming_soon', order: 17 },
  { subjectSlug: 'science-tech', chapter: 'Emerging Tech', title: 'Robotics & Automation', slug: 'robotics', status: 'coming_soon', order: 18 },
  { subjectSlug: 'science-tech', chapter: 'Health', title: 'Viruses & Pandemics', slug: 'pandemics', status: 'coming_soon', order: 19 },
  { subjectSlug: 'science-tech', chapter: 'Cybersecurity', title: 'Data Protection', slug: 'data-protection', status: 'coming_soon', order: 20 },

  // Art & Culture
  { subjectSlug: 'art-culture', chapter: 'Architecture', title: 'Temple Architecture', slug: 'temple-arch', status: 'coming_soon', order: 1 },
  { subjectSlug: 'art-culture', chapter: 'Dance', title: 'Classical Dances', slug: 'dances', status: 'coming_soon', order: 2 },
  { subjectSlug: 'art-culture', chapter: 'Heritage', title: 'UNESCO Heritage', slug: 'unesco', status: 'coming_soon', order: 3 },
  { subjectSlug: 'art-culture', chapter: 'Folk Arts', title: 'Folk Arts', slug: 'folk-arts', status: 'coming_soon', order: 4 },
  { subjectSlug: 'art-culture', chapter: 'Architecture', title: 'Indo-Islamic Architecture', slug: 'indo-islamic', status: 'coming_soon', order: 5 },
  { subjectSlug: 'art-culture', chapter: 'Paintings', title: 'Mural Paintings', slug: 'mural-paintings', status: 'coming_soon', order: 6 },
  { subjectSlug: 'art-culture', chapter: 'Paintings', title: 'Miniature Paintings', slug: 'miniature-paintings', status: 'coming_soon', order: 7 },
  { subjectSlug: 'art-culture', chapter: 'Music', title: 'Hindustani Music', slug: 'hindustani-music', status: 'coming_soon', order: 8 },
  { subjectSlug: 'art-culture', chapter: 'Music', title: 'Carnatic Music', slug: 'carnatic-music', status: 'coming_soon', order: 9 },
  { subjectSlug: 'art-culture', chapter: 'Literature', title: 'Vedic Literature', slug: 'vedic-literature', status: 'coming_soon', order: 10 },
  { subjectSlug: 'art-culture', chapter: 'Sculpture', title: 'Indian Sculpture & Bronzes', slug: 'sculptures', status: 'coming_soon', order: 11 },
  { subjectSlug: 'art-culture', chapter: 'Paintings', title: 'Folk Paintings', slug: 'folk-paintings', status: 'coming_soon', order: 12 },
  { subjectSlug: 'art-culture', chapter: 'Dance', title: 'Folk Dances & Theatre', slug: 'folk-dance-theatre', status: 'coming_soon', order: 13 },
  { subjectSlug: 'art-culture', chapter: 'Philosophy', title: 'Schools of Indian Philosophy', slug: 'philosophy-schools', status: 'coming_soon', order: 14 },
  { subjectSlug: 'art-culture', chapter: 'Religions', title: 'Buddhism & Jainism (Artistic Aspects)', slug: 'buddhism-jainism-art', status: 'coming_soon', order: 15 },
  { subjectSlug: 'art-culture', chapter: 'Heritage', title: 'Intangible Cultural Heritage', slug: 'intangible-heritage', status: 'coming_soon', order: 16 },
  { subjectSlug: 'art-culture', chapter: 'Heritage', title: 'Fairs & Festivals of India', slug: 'fairs-festivals', status: 'coming_soon', order: 17 },
  { subjectSlug: 'art-culture', chapter: 'Heritage', title: 'Calendar Systems in India', slug: 'calendars', status: 'coming_soon', order: 18 },
  { subjectSlug: 'art-culture', chapter: 'Science', title: 'Ancient Indian Science', slug: 'ancient-science', status: 'coming_soon', order: 19 },
  { subjectSlug: 'art-culture', chapter: 'Literature', title: 'Ancient Indian Literature', slug: 'ancient-literature', status: 'coming_soon', order: 20 },

  // Ancient History
  { subjectSlug: 'ancient-history', chapter: 'Pre-History', title: 'Indus Valley Civilization', slug: 'ivc', status: 'coming_soon', order: 1 },
  { subjectSlug: 'ancient-history', chapter: 'Vedic Age', title: 'Vedic Age', slug: 'vedic', status: 'coming_soon', order: 2 },
  { subjectSlug: 'ancient-history', chapter: 'Buddhism & Jainism', title: 'Buddhism', slug: 'buddhism', status: 'coming_soon', order: 3 },
  { subjectSlug: 'ancient-history', chapter: 'Mauryan Empire', title: 'Mauryan Empire', slug: 'mauryan', status: 'coming_soon', order: 4 },
  { subjectSlug: 'ancient-history', chapter: 'Pre-Historic', title: 'Stone Age', slug: 'stone-age', status: 'coming_soon', order: 5 },
  { subjectSlug: 'ancient-history', chapter: 'Mahajanapadas', title: 'Magadha Empire', slug: 'magadha', status: 'coming_soon', order: 6 },
  { subjectSlug: 'ancient-history', chapter: 'Religions', title: 'Jainism', slug: 'jainism', status: 'coming_soon', order: 7 },
  { subjectSlug: 'ancient-history', chapter: 'Mauryan Empire', title: 'Ashoka', slug: 'ashoka', status: 'coming_soon', order: 8 },
  { subjectSlug: 'ancient-history', chapter: 'Post-Mauryan', title: 'Kushanas', slug: 'kushanas', status: 'coming_soon', order: 9 },
  { subjectSlug: 'ancient-history', chapter: 'Gupta Empire', title: 'Gupta Administration', slug: 'gupta', status: 'coming_soon', order: 10 },
  { subjectSlug: 'ancient-history', chapter: 'Science', title: 'Ancient Indian Science & Literature', slug: 'ancient-sci-lit', status: 'coming_soon', order: 11 },
  { subjectSlug: 'ancient-history', chapter: 'Pre-Historic', title: 'Stone Age Detailed', slug: 'stone-age-ancient', status: 'coming_soon', order: 12 },
  { subjectSlug: 'ancient-history', chapter: 'Mahajanapadas', title: 'Mahajanapadas Overview', slug: 'mahajanapadas', status: 'coming_soon', order: 13 },
  { subjectSlug: 'ancient-history', chapter: 'South India', title: 'Sangam Age', slug: 'sangam-age', status: 'coming_soon', order: 14 },
  { subjectSlug: 'ancient-history', chapter: 'Post-Gupta', title: 'Harshavardhana', slug: 'harsha', status: 'coming_soon', order: 15 },
  { subjectSlug: 'ancient-history', chapter: 'South India', title: 'Chalukyas, Pallavas & Pandyas', slug: 'south-indian-dynasties', status: 'coming_soon', order: 16 },

  // Medieval History
  { subjectSlug: 'medieval-history', chapter: 'Delhi Sultanate', title: 'Delhi Sultanate', slug: 'sultanate', status: 'coming_soon', order: 1 },
  { subjectSlug: 'medieval-history', chapter: 'Bhakti Movement', title: 'Bhakti Movement', slug: 'bhakti', status: 'coming_soon', order: 2 },
  { subjectSlug: 'medieval-history', chapter: 'Mughal Empire', title: 'Mughal Administration', slug: 'mughals', status: 'coming_soon', order: 3 },
  { subjectSlug: 'medieval-history', chapter: 'Vijayanagara', title: 'Vijayanagara Empire', slug: 'vijayanagara', status: 'coming_soon', order: 4 },
  { subjectSlug: 'medieval-history', chapter: 'Early Medieval', title: 'Cholas', slug: 'cholas', status: 'coming_soon', order: 5 },
  { subjectSlug: 'medieval-history', chapter: 'Early Medieval', title: 'Rajputs', slug: 'rajputs', status: 'coming_soon', order: 6 },
  { subjectSlug: 'medieval-history', chapter: 'Delhi Sultanate', title: 'Slave Dynasty', slug: 'slave-dynasty', status: 'coming_soon', order: 7 },
  { subjectSlug: 'medieval-history', chapter: 'Mughal Empire', title: 'Akbar', slug: 'akbar', status: 'coming_soon', order: 8 },
  { subjectSlug: 'medieval-history', chapter: 'Mughal Empire', title: 'Aurangzeb', slug: 'aurangzeb', status: 'coming_soon', order: 9 },
  { subjectSlug: 'medieval-history', chapter: 'Marathas', title: 'Shivaji', slug: 'shivaji', status: 'coming_soon', order: 10 },
  { subjectSlug: 'medieval-history', chapter: 'Early Medieval', title: 'Early Medieval India Overview', slug: 'early-medieval', status: 'coming_soon', order: 11 },
  { subjectSlug: 'medieval-history', chapter: 'South India', title: 'Chola Empire Detailed', slug: 'chola-empire', status: 'coming_soon', order: 12 },
  { subjectSlug: 'medieval-history', chapter: 'Marathas', title: 'Maratha Empire', slug: 'marathas', status: 'coming_soon', order: 13 },
  { subjectSlug: 'medieval-history', chapter: 'Early Phase', title: 'Arrival of Europeans (Early Phase)', slug: 'early-europeans', status: 'coming_soon', order: 14 },
  { subjectSlug: 'medieval-history', chapter: 'Mughal Empire', title: 'Later Mughals & Decline', slug: 'later-mughals', status: 'coming_soon', order: 15 },

  // Miscellaneous
  { subjectSlug: 'miscellaneous', chapter: 'Reports & Indices', title: 'Important Reports', slug: 'reports', status: 'coming_soon', order: 1 },
  { subjectSlug: 'miscellaneous', chapter: 'Government Schemes', title: 'Government Schemes Quick Review', slug: 'schemes', status: 'coming_soon', order: 2 },
  { subjectSlug: 'miscellaneous', chapter: 'Organizations', title: 'International Organizations', slug: 'intl-orgs', status: 'coming_soon', order: 3 },
  { subjectSlug: 'miscellaneous', chapter: 'Indices', title: 'Global Indices', slug: 'indices', status: 'coming_soon', order: 4 },
  { subjectSlug: 'miscellaneous', chapter: 'Mapping', title: 'India Mapping', slug: 'india-mapping', status: 'coming_soon', order: 5 },
  { subjectSlug: 'miscellaneous', chapter: 'Mapping', title: 'World Mapping', slug: 'world-mapping', status: 'coming_soon', order: 6 },
  { subjectSlug: 'miscellaneous', chapter: 'Defense', title: 'Military Exercises', slug: 'military-exercises', status: 'coming_soon', order: 7 },
  { subjectSlug: 'miscellaneous', chapter: 'Awards', title: 'National Awards', slug: 'national-awards', status: 'coming_soon', order: 8 },
  { subjectSlug: 'miscellaneous', chapter: 'Sports', title: 'Sports Events', slug: 'sports', status: 'coming_soon', order: 9 },
  { subjectSlug: 'miscellaneous', chapter: 'Committees', title: 'Important Committees', slug: 'committees', status: 'coming_soon', order: 10 },
  { subjectSlug: 'miscellaneous', chapter: 'Heritage', title: 'GI Tags', slug: 'gi-tags', status: 'coming_soon', order: 11 },
  { subjectSlug: 'miscellaneous', chapter: 'Reports', title: 'Reports by International Bodies', slug: 'intl-reports', status: 'coming_soon', order: 12 },
  { subjectSlug: 'miscellaneous', chapter: 'Defense', title: 'Military Exercises Recent', slug: 'exercises', status: 'coming_soon', order: 13 },
  { subjectSlug: 'miscellaneous', chapter: 'Mapping', title: 'Places in News (Mapping)', slug: 'places-in-news', status: 'coming_soon', order: 14 },
  { subjectSlug: 'miscellaneous', chapter: 'Sports', title: 'Sports Major Events', slug: 'sports-events', status: 'coming_soon', order: 15 },
];

export function AdminPanel() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { logout } = useAuth();
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmState({ isOpen: true, title, message, onConfirm });
  };

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-slate-50/50">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-violet-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-violet-600 text-white flex items-center justify-center font-black text-sm">PC</div>
          <span className="font-black text-slate-900 tracking-tight">PreCall Admin</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      {/* Admin Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200 bg-white p-6 transition-transform duration-300 md:sticky md:translate-x-0 overflow-y-auto",
        isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
      )}>
        <div className="mb-10 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-violet-600 text-white flex items-center justify-center font-black text-lg shadow-lg shadow-violet-200">PC</div>
          <div>
            <span className="block text-xl font-black text-slate-900 leading-none tracking-tight">PreCall</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Control Center</span>
          </div>
        </div>
        
        <nav className="space-y-1.5">
          <AdminNavLink to="/admin" icon={LayoutDashboard} active={location.pathname === '/admin'} onClick={() => setIsMobileMenuOpen(false)}>Overview</AdminNavLink>
          
          <div className="pt-6 pb-2 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Content</div>
          <AdminNavLink to="/admin/topics" icon={FileText} active={location.pathname === '/admin/topics'} onClick={() => setIsMobileMenuOpen(false)}>Manage Topics</AdminNavLink>
          <AdminNavLink to="/admin/subjects" icon={BookOpen} active={location.pathname === '/admin/subjects'} onClick={() => setIsMobileMenuOpen(false)}>Manage Subjects</AdminNavLink>
          
          <div className="pt-6 pb-2 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Communication</div>
          <AdminNavLink to="/admin/notifications" icon={Bell} active={location.pathname === '/admin/notifications'} onClick={() => setIsMobileMenuOpen(false)}>Broadcast Updates</AdminNavLink>
          
          <div className="pt-6 pb-2 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Team</div>
          <AdminNavLink to="/admin/access" icon={ShieldCheck} active={location.pathname === '/admin/access'} onClick={() => setIsMobileMenuOpen(false)}>Admin Access</AdminNavLink>
          
          <div className="pt-6 pb-2 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Business</div>
          {/* Removed dynamic coupons link as per user request (PRECALL10 is now hardcoded) */}
          <AdminNavLink to="/admin/settings" icon={Settings} active={location.pathname === '/admin/settings'} onClick={() => setIsMobileMenuOpen(false)}>App Settings</AdminNavLink>
        </nav>

        <div className="mt-auto pt-10 space-y-3">
          <Link to="/" className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-violet-600 bg-violet-50 hover:bg-violet-100 transition-all group">
            <Eye className="h-5 w-5" />
            View Public App
          </Link>
          <Link to="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-all group">
            <Sparkles className="h-5 w-5" />
            View Premium View
          </Link>
          <button 
            onClick={() => {
              showConfirm(
                'Sign Out',
                'Are you sure you want to sign out of the admin panel?',
                logout
              );
            }} 
            className="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all group text-left"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Overlay for mobile menu */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-sm md:hidden" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full pt-20 md:pt-10">
        <Routes>
          <Route path="/" element={<AdminOverview showConfirm={showConfirm} />} />
          <Route path="/subjects" element={<AdminSubjects showConfirm={showConfirm} />} />
          <Route path="/topics" element={<AdminTopics showConfirm={showConfirm} />} />
          <Route path="/notifications" element={<AdminNotifications showConfirm={showConfirm} />} />
          <Route path="/settings" element={<AdminSettings showConfirm={showConfirm} />} />
          <Route path="/access" element={<AdminAccess showConfirm={showConfirm} />} />
          {/* Removed dynamic coupons route */}
        </Routes>
      </main>

      <Modal
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        title={confirmState.title}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}>
              Cancel
            </Button>
            <Button 
              variant="secondary" 
              onClick={() => {
                confirmState.onConfirm();
                setConfirmState(prev => ({ ...prev, isOpen: false }));
              }}
            >
              Confirm
            </Button>
          </>
        }
      >
        {confirmState.message}
      </Modal>
    </div>
  );
}

function AdminNavLink({ to, icon: Icon, children, active, onClick }: any) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 group",
        active 
          ? "bg-violet-600 text-white shadow-lg shadow-violet-200" 
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      <div className="flex items-center gap-3">
        <Icon className={cn("h-5 w-5 transition-colors", active ? "text-white" : "text-slate-400 group-hover:text-slate-600")} />
        {children}
      </div>
      {active && <ChevronRight className="h-4 w-4 text-white" />}
    </Link>
  );
}

function AdminNotifications({ showConfirm }: { showConfirm: any }) {
  const { isAdmin } = useAuth();
  const { notifications } = useNotifications(undefined, isAdmin);
  const [isSending, setIsSending] = useState(false);
  const [newNotification, setNewNotification] = useState<Partial<AppNotification>>({
    title: '',
    message: '',
    type: 'update'
  });

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotification.title || !newNotification.message) return;

    setIsSending(true);
    try {
      const notificationData = {
        ...newNotification,
        userId: 'all',
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'notifications'), notificationData);
      toast.success('Notification sent to all users!');
      setNewNotification({ title: '', message: '', type: 'update' });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'notifications');
      toast.error('Failed to send notification');
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    showConfirm(
      'Delete Notification',
      'Are you sure? This will remove the notification for all users.',
      async () => {
        try {
          await deleteDoc(doc(db, 'notifications', id));
          toast.success('Notification deleted');
        } catch (e) {
          handleFirestoreError(e, OperationType.DELETE, `notifications/${id}`);
          toast.error('Failed to delete notification');
        }
      }
    );
  };

  return (
    <div className="space-y-10">
      <Card className="p-10 border-4 border-violet-400 shadow-[10px_10px_0px_0px_rgba(167,139,250,1)]">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 border-2 border-violet-400 bg-violet-600 text-white shadow-[4px_4px_0px_0px_rgba(167,139,250,1)]">
            <Send className="h-6 w-6" />
          </div>
          <h2 className="text-3xl font-black text-violet-950 tracking-tighter uppercase italic">Broadcast Update</h2>
        </div>

        <form onSubmit={handleSend} className="space-y-8">
          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-3">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Notification Title</label>
              <input 
                type="text" 
                className="w-full h-16 border-4 border-violet-400 bg-white px-6 font-black text-slate-900 focus:ring-0 focus:border-violet-400 focus:shadow-[4px_4px_0px_0px_rgba(167,139,250,1)] transition-all placeholder:text-slate-300" 
                value={newNotification.title} 
                onChange={e => setNewNotification({...newNotification, title: e.target.value})} 
                placeholder="e.g. New Polity Topic Live!" 
                required 
              />
            </div>
            <div className="space-y-3">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Message Type</label>
              <select 
                className="w-full h-16 border-4 border-violet-400 bg-white px-6 font-black text-slate-900 focus:ring-0 focus:border-violet-400 focus:shadow-[4px_4px_0px_0px_rgba(167,139,250,1)] transition-all" 
                value={newNotification.type} 
                onChange={e => setNewNotification({...newNotification, type: e.target.value as any})}
              >
                <option value="update">Update (Blue)</option>
                <option value="alert">Alert (Amber)</option>
                <option value="welcome">Welcome (Violet)</option>
              </select>
            </div>
          </div>
          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400">Message Content</label>
            <textarea 
              className="w-full border-4 border-violet-400 bg-white p-6 font-bold text-slate-900 focus:ring-0 focus:border-violet-400 focus:shadow-[4px_4px_0px_0px_rgba(167,139,250,1)] transition-all placeholder:text-slate-300" 
              rows={4} 
              value={newNotification.message} 
              onChange={e => setNewNotification({...newNotification, message: e.target.value})} 
              placeholder="Tell your users what's new..." 
              required 
            />
          </div>
          <Button type="submit" loading={isSending} className="w-full h-20 text-2xl shadow-[8px_8px_0px_0px_rgba(167,139,250,1)] border-4 border-violet-400 bg-violet-600 text-white hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(139,92,246,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all uppercase italic tracking-tighter">
            <Send className="h-8 w-8 mr-4" />
            Send to All Users
          </Button>
        </form>
      </Card>

      <div className="space-y-8">
        <h3 className="text-3xl font-black text-violet-950 px-2 uppercase tracking-tighter italic">Recent Broadcasts</h3>
        <div className="grid gap-6">
          {notifications.map((n) => (
            <Card key={n.id} className="p-8 border-4 border-violet-400 bg-white shadow-[6px_6px_0px_0px_rgba(167,139,250,1)] flex items-center justify-between gap-8 group">
              <div className="flex items-center gap-8">
                <div className={cn(
                  "h-16 w-16 border-2 border-violet-400 flex items-center justify-center shrink-0 shadow-[4px_4px_0px_0px_rgba(167,139,250,1)]",
                  n.type === 'update' ? "bg-blue-100 text-blue-600" :
                  n.type === 'alert' ? "bg-amber-100 text-amber-600" :
                  "bg-violet-100 text-violet-600"
                )}>
                  {n.type === 'update' ? <Info className="h-8 w-8" /> :
                   n.type === 'alert' ? <AlertTriangle className="h-8 w-8" /> :
                   <Sparkles className="h-8 w-8" />}
                </div>
                <div>
                  <h4 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">{n.title}</h4>
                  <p className="text-slate-500 font-bold line-clamp-1">{n.message}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => handleDelete(n.id)} 
                className="p-4 border-2 border-transparent text-slate-300 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-all"
              >
                <Trash2 className="h-6 w-6" />
              </button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminOverview({ showConfirm }: { showConfirm: any }) {
  const { user } = useAuth();
  const { topics } = useTopics();
  const { subjects } = useSubjects();
  const { settings } = useSettings();

  const seedData = async () => {
    showConfirm(
      'Safe Seed Core Data',
      'This will safely add missing subjects and topic placeholders. It will NOT overwrite any existing topics you have already created or modified. Proceed?',
      async () => {
        try {
          // Fetch existing to avoid overwriting
          const existingSubjectsSnap = await getDocs(collection(db, 'subjects'));
          const existingTopicsSnap = await getDocs(collection(db, 'topics'));
          
          const existingSubjectIds = new Set(existingSubjectsSnap.docs.map(d => d.id));
          const existingTopicIds = new Set(existingTopicsSnap.docs.map(d => d.id));

          const batch = writeBatch(db);

          // Settings (we can safely overwrite global settings or use merge)
          const settingsRef = doc(db, 'settings', 'global');
          batch.set(settingsRef, {
            appName: 'PreCall',
            heroTagline: 'High-yield UPSC Prelims revision especially for You.',
            sponsorName: 'Mentor Partner',
            sponsorText: 'Sponsored by UPSC Mentor',
            pricingText: 'Full access at ₹999 (Limited Offer)',
            premiumCtaLine: 'Unlock 100+ High-Yield Topics',
            footerText: 'Built for UPSC Aspirants by Founders who care.',
            price: '999',
            originalPrice: '2,499',
            pdfPrice: '199'
          }, { merge: true });

          let addedSubjects = 0;
          INITIAL_SUBJECTS.forEach((s) => {
            if (!existingSubjectIds.has(s.id)) {
              const ref = doc(db, 'subjects', s.id);
              batch.set(ref, s);
              addedSubjects++;
            }
          });

          // Welcome Notification (only add if we are seeding subjects for the first time)
          if (addedSubjects > 0) {
            const welcomeRef = doc(collection(db, 'notifications'));
            batch.set(welcomeRef, {
              id: welcomeRef.id,
              userId: 'all',
              title: 'Welcome to PreCall!',
              message: 'Master UPSC Prelims with our high-yield revision topics. Start with Polity and Modern History today!',
              type: 'welcome',
              createdAt: new Date().toISOString()
            });
          }

          let addedTopics = 0;
          TOPIC_PLACEHOLDERS.forEach((t) => {
            const id = t.slug;
            if (!existingTopicIds.has(id)) {
              const ref = doc(db, 'topics', id);
              
              // Special handling for Article 21 to provide a full example
              if (id === 'article-21-right-to-life') {
                batch.set(ref, {
                  id,
                  slug: 'article-21-right-to-life',
                  subjectSlug: 'polity',
                  chapter: 'Fundamental Rights',
                  title: 'Article 21 – Right to Life and Personal Liberty',
                  teaser: 'The "Heart of Fundamental Rights". A single sentence that has been expanded by the Supreme Court to cover everything from Privacy to Sleep.',
                  status: 'free',
                  order: 1,
                  examRelevance: 'Critical - Highest frequency in both Prelims & Mains',
                  estimatedTime: '10 mins',
                  lastUpdated: new Date().toLocaleDateString(),
                  whyThisMatters: 'Article 21 is the most evolved article in the Constitution. UPSC loves testing the "Judicial Activism" aspect and the specific rights that have been included under its umbrella over the years.',
                coreConcept: `**The Bare Text:**
“No person shall be deprived of his life or personal liberty except according to **procedure established by law**.”

**The Evolution:**
1. **A.K. Gopalan Case (1950):** Narrow interpretation. Only protected against arbitrary *executive* action, not *legislative* action.
2. **Maneka Gandhi Case (1978):** Revolutionary shift. Introduced the concept of **"Due Process of Law"**. Now, the law itself must be "just, fair, and reasonable".`,
                upscGoldPoint: `**Who is covered?**
- **Citizens:** YES
- **Foreigners:** YES (except enemy aliens)
- **Legal Persons (Corporations):** NO (Article 21 is for natural human beings only).

**Key Doctrine:**
The "Golden Triangle" of the Constitution consists of **Articles 14, 19, and 21**. They are not mutually exclusive but form a single protective layer.`,
                deepUnderstanding: `**Procedure Established by Law vs. Due Process of Law**
- **Procedure Established by Law (British Origin):** If a law is validly passed, the court won't check if the law is "fair".
- **Due Process of Law (American Origin):** The court checks if the law is "fair, just, and non-arbitrary".
- **Current Indian Status:** Though the text says "Procedure Established by Law", the Supreme Court (since Maneka Gandhi) interprets it as "Due Process".`,
                linkedFacts: `**Rights declared as part of Article 21 by SC:**
- **Right to Privacy** (K.S. Puttaswamy Case, 2017)
- **Right to Livelihood** (Olga Tellis Case)
- **Right to Shelter**
- **Right to Clean Environment** (M.C. Mehta Cases)
- **Right to Free Legal Aid**
- **Right to Speedy Trial**
- **Right to Sleep** (Ramlila Maidan Case)
- **Right to Marriage of Choice** (Hadiya Case/Shakti Vahini Case)`,
                trapZone: `**Trap 1:** "Article 21 can be suspended during Emergency." → **WRONG.** After the 44th Amendment (1978), Articles 20 and 21 **cannot** be suspended even during a National Emergency.
**Trap 2:** "Right to Property is part of Article 21." → **WRONG.** It was a FR (Art 31) but is now only a Constitutional Right (Art 300A).
**Trap 3:** "Article 21 protects against private individuals." → **WRONG.** Fundamental Rights are generally enforceable against the **State**, not private citizens (with some exceptions like Art 17).`,
                memoryTrick: 'Think of Article 21 as an **"Expanding Umbrella"**. Every time a new human need arises (Privacy, Environment, Internet), the Supreme Court puts it under this umbrella.',
                prelimsSnapshot: `**Quick Check for Prelims:**
- **Scope:** All persons (Citizens + Foreigners).
- **Emergency Status:** Non-suspendable (Art 359).
- **Nature:** Negative obligation on the State.
- **Key Case:** Maneka Gandhi (1978) - shifted from "Procedure" to "Due Process".`,
                mcqs: `**Q1. Which of the following is NOT protected under Article 21?**
A. Right to a speedy trial
B. Right to travel abroad
C. Right to strike
D. Right to privacy

**Answer:** C. Right to strike (It is a legal/statutory right, not a Fundamental Right under Art 21).

**Q2. The "Due Process of Law" is a characteristic of which Article?**
A. Article 14
B. Article 19
C. Article 21
D. Article 22

**Answer:** C. Article 21 (as interpreted by SC in Maneka Gandhi case).`,
                oneLineRevision: 'Article 21 is the bedrock of individual dignity, protecting life and liberty against arbitrary state action through the "just, fair, and reasonable" test.',
                linkedTopics: 'Article 14 (Equality), Article 19 (Freedoms), Emergency Provisions, Judicial Review'
              });
            } else if (id === 'preamble') {
              batch.set(ref, {
                id,
                slug: 'preamble',
                subjectSlug: 'polity',
                chapter: 'Basics of Constitution',
                title: 'The Preamble',
                teaser: 'The "Identity Card" of the Constitution. Understand the sequence of Sovereign, Socialist, Secular, Democratic, Republic.',
                status: 'free',
                order: 2,
                examRelevance: 'High - Direct questions on keywords and legal status',
                estimatedTime: '6 mins',
                lastUpdated: new Date().toLocaleDateString(),
                whyThisMatters: 'UPSC often asks about the exact sequence of words and whether the Preamble is a part of the Constitution or amendable.',
                coreConcept: `**The Text:**
"We, the People of India, having solemnly resolved to constitute India into a **Sovereign Socialist Secular Democratic Republic**..."

**Key Dates:**
- **Adopted:** 26th November 1949.
- **Amended:** Only once (42nd Amendment, 1976) - added 'Socialist', 'Secular', and 'Integrity'.`,
                upscGoldPoint: `**Legal Status:**
1. **Berubari Union (1960):** Preamble is NOT a part of the Constitution.
2. **Kesavananda Bharati (1973):** Preamble IS a part of the Constitution.
3. **LIC of India (1995):** Preamble is an integral part of the Constitution.`,
                deepUnderstanding: `**The Objectives:**
- **Justice:** Social, Economic, Political.
- **Liberty:** Thought, Expression, Belief, Faith, Worship.
- **Equality:** Status and Opportunity.
- **Fraternity:** Assuring dignity and unity/integrity.`,
                linkedFacts: `**Source of Authority:** The People of India.
**Nature of State:** Sovereign, Socialist, Secular, Democratic, Republic.
**Date of Adoption:** 26th Nov 1949 (Not 26th Jan 1950).`,
                trapZone: `**Trap 1:** "Preamble is enforceable in a court of law." → **WRONG.** It is non-justiciable.
**Trap 2:** "The word 'Secular' was there since 1950." → **WRONG.** Added by 42nd Amendment in 1976.
**Trap 3:** "Preamble is a source of power to the legislature." → **WRONG.** It is neither a source of power nor a prohibition upon powers.`,
                memoryTrick: 'Sequence: **S-S-S-D-R** (Sovereign, Socialist, Secular, Democratic, Republic)',
                prelimsSnapshot: `**UPSC Checklist:**
- Part of Constitution? Yes.
- Amendable? Yes (but not the Basic Structure).
- Enforceable? No.
- Source of Power? No.`,
                mcqs: `**Q. The mind of the makers of the Constitution of India is reflected in which of the following?**
A. The Preamble
B. The Fundamental Rights
C. The Directive Principles of State Policy
D. The Fundamental Duties

**Answer:** A. The Preamble (UPSC 2017)`,
                oneLineRevision: 'The Preamble summarizes the philosophy and objectives of the Constitution, acting as its guiding light and identity card.',
                linkedTopics: 'Basic Structure Doctrine, 42nd Amendment, Objective Resolution'
              });
            } else {
              batch.set(ref, {
                ...t,
                id,
                teaser: `High-yield revision topic for ${t.title}.`,
                examRelevance: 'High Relevance',
                estimatedTime: '5 mins',
                lastUpdated: new Date().toLocaleDateString(),
                whyThisMatters: 'Coming soon...',
                coreConcept: 'Content being prepared for the 2026 launch.',
              });
            }
            addedTopics++;
          }
        });

        await batch.commit();
        await bundleService.rebuildAllBundles();
        
        // Force server cache refresh
        fetch('/api/admin/refresh-cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user?.uid })
        }).catch(err => console.warn('Cache refresh failed:', err));

        toast.success(`Seeded ${addedSubjects} subjects and ${addedTopics} topics! Bundles rebuilt.`);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, 'batch');
        toast.error('Failed to seed data');
      }
    }
  );
};

  const seedPreamble = async () => {
    showConfirm(
      'Add Preamble Content',
      'This will add the full Preamble high-yield content to the existing placeholder. Proceed?',
      async () => {
        try {
          const topicId = 'preamble';
          const topicRef = doc(db, 'topics', topicId);
          await setDoc(topicRef, {
            id: topicId,
            slug: 'preamble',
            subjectSlug: 'polity',
            chapter: 'Basics of Constitution',
            title: 'The Preamble',
            teaser: 'The "Identity Card" of the Constitution. Understand the sequence of Sovereign, Socialist, Secular, Democratic, Republic.',
            status: 'free',
            order: 2,
            examRelevance: 'High - Direct questions on keywords and legal status',
            estimatedTime: '6 mins',
            lastUpdated: new Date().toLocaleDateString(),
            whyThisMatters: 'UPSC often asks about the exact sequence of words and whether the Preamble is a part of the Constitution or amendable.',
            coreConcept: `**The Text:**
"We, the People of India, having solemnly resolved to constitute India into a **Sovereign Socialist Secular Democratic Republic**..."

**Key Dates:**
- **Adopted:** 26th November 1949.
- **Amended:** Only once (42nd Amendment, 1976) - added 'Socialist', 'Secular', and 'Integrity'.`,
            upscGoldPoint: `**Legal Status:**
1. **Berubari Union (1960):** Preamble is NOT a part of the Constitution.
2. **Kesavananda Bharati (1973):** Preamble IS a part of the Constitution.
3. **LIC of India (1995):** Preamble is an integral part of the Constitution.`,
            deepUnderstanding: `**The Objectives:**
- **Justice:** Social, Economic, Political.
- **Liberty:** Thought, Expression, Belief, Faith, Worship.
- **Equality:** Status and Opportunity.
- **Fraternity:** Assuring dignity and unity/integrity.`,
            linkedFacts: `**Source of Authority:** The People of India.
**Nature of State:** Sovereign, Socialist, Secular, Democratic, Republic.
**Date of Adoption:** 26th Nov 1949 (Not 26th Jan 1950).`,
            trapZone: `**Trap 1:** "Preamble is enforceable in a court of law." → **WRONG.** It is non-justiciable.
**Trap 2:** "The word 'Secular' was there since 1950." → **WRONG.** Added by 42nd Amendment in 1976.
**Trap 3:** "Preamble is a source of power to the legislature." → **WRONG.** It is neither a source of power nor a prohibition upon powers.`,
            memoryTrick: 'Sequence: **S-S-S-D-R** (Sovereign, Socialist, Secular, Democratic, Republic)',
            prelimsSnapshot: `**UPSC Checklist:**
- Part of Constitution? Yes.
- Amendable? Yes (but not the Basic Structure).
- Enforceable? No.
- Source of Power? No.`,
            mcqs: `**Q. The mind of the makers of the Constitution of India is reflected in which of the following?**
A. The Preamble
B. The Fundamental Rights
C. The Directive Principles of State Policy
D. The Fundamental Duties

**Answer:** A. The Preamble (UPSC 2017)`,
            oneLineRevision: 'The Preamble summarizes the philosophy and objectives of the Constitution, acting as its guiding light and identity card.',
            linkedTopics: 'Basic Structure Doctrine, 42nd Amendment, Objective Resolution'
          }, { merge: true });

          await bundleService.rebuildTopicBundle('polity');
          
          // Force server cache refresh
          fetch('/api/admin/refresh-cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user?.uid })
          }).catch(err => console.warn('Cache refresh failed:', err));

          toast.success('Preamble content added and bundle rebuilt!');
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, 'topics/preamble');
          toast.error('Failed to add content');
        }
      }
    );
  };

  const seedArticle21 = async () => {
    showConfirm(
      'Add Article 21 Content',
      'This will add the full Article 21 high-yield content to the existing placeholder. Proceed?',
      async () => {
        try {
          const topicId = 'article-21-right-to-life';
          const topicRef = doc(db, 'topics', topicId);
          await setDoc(topicRef, {
            id: topicId,
            slug: 'article-21-right-to-life',
            subjectSlug: 'polity',
            chapter: 'Fundamental Rights',
            title: 'Article 21 – Right to Life and Personal Liberty',
            teaser: 'The "Heart of Fundamental Rights". A single sentence that has been expanded by the Supreme Court to cover everything from Privacy to Sleep.',
            status: 'free',
            order: 1,
            examRelevance: 'Critical - Highest frequency in both Prelims & Mains',
            estimatedTime: '10 mins',
            lastUpdated: new Date().toLocaleDateString(),
            whyThisMatters: 'Article 21 is the most evolved article in the Constitution. UPSC loves testing the "Judicial Activism" aspect and the specific rights that have been included under its umbrella over the years.',
            coreConcept: `**The Bare Text:**
“No person shall be deprived of his life or personal liberty except according to **procedure established by law**.”

**The Evolution:**
1. **A.K. Gopalan Case (1950):** Narrow interpretation. Only protected against arbitrary *executive* action, not *legislative* action.
2. **Maneka Gandhi Case (1978):** Revolutionary shift. Introduced the concept of **"Due Process of Law"**. Now, the law itself must be "just, fair, and reasonable".`,
            upscGoldPoint: `**Who is covered?**
- **Citizens:** YES
- **Foreigners:** YES (except enemy aliens)
- **Legal Persons (Corporations):** NO (Article 21 is for natural human beings only).

**Key Doctrine:**
The "Golden Triangle" of the Constitution consists of **Articles 14, 19, and 21**. They are not mutually exclusive but form a single protective layer.`,
            deepUnderstanding: `**Procedure Established by Law vs. Due Process of Law**
- **Procedure Established by Law (British Origin):** If a law is validly passed, the court won't check if the law is "fair".
- **Due Process of Law (American Origin):** The court checks if the law is "fair, just, and non-arbitrary".
- **Current Indian Status:** Though the text says "Procedure Established by Law", the Supreme Court (since Maneka Gandhi) interprets it as "Due Process".`,
            linkedFacts: `**Rights declared as part of Article 21 by SC:**
- **Right to Privacy** (K.S. Puttaswamy Case, 2017)
- **Right to Livelihood** (Olga Tellis Case)
- **Right to Shelter**
- **Right to Clean Environment** (M.C. Mehta Cases)
- **Right to Free Legal Aid**
- **Right to Speedy Trial**
- **Right to Sleep** (Ramlila Maidan Case)
- **Right to Marriage of Choice** (Hadiya Case/Shakti Vahini Case)`,
            trapZone: `**Trap 1:** "Article 21 can be suspended during Emergency." → **WRONG.** After the 44th Amendment (1978), Articles 20 and 21 **cannot** be suspended even during a National Emergency.
**Trap 2:** "Right to Property is part of Article 21." → **WRONG.** It was a FR (Art 31) but is now only a Constitutional Right (Art 300A).
**Trap 3:** "Article 21 protects against private individuals." → **WRONG.** Fundamental Rights are generally enforceable against the **State**, not private citizens (with some exceptions like Art 17).`,
            memoryTrick: 'Think of Article 21 as an **"Expanding Umbrella"**. Every time a new human need arises (Privacy, Environment, Internet), the Supreme Court puts it under this umbrella.',
            prelimsSnapshot: `**Quick Check for Prelims:**
- **Scope:** All persons (Citizens + Foreigners).
- **Emergency Status:** Non-suspendable (Art 359).
- **Nature:** Negative obligation on the State.
- **Key Case:** Maneka Gandhi (1978) - shifted from "Procedure" to "Due Process".`,
            mcqs: `**Q1. Which of the following is NOT protected under Article 21?**
A. Right to a speedy trial
B. Right to travel abroad
C. Right to strike
D. Right to privacy

**Answer:** C. Right to strike (It is a legal/statutory right, not a Fundamental Right under Art 21).

**Q2. The "Due Process of Law" is a characteristic of which Article?**
A. Article 14
B. Article 19
C. Article 21
D. Article 22

**Answer:** C. Article 21 (as interpreted by SC in Maneka Gandhi case).`,
            oneLineRevision: 'Article 21 is the bedrock of individual dignity, protecting life and liberty against arbitrary state action through the "just, fair, and reasonable" test.',
            linkedTopics: 'Article 14 (Equality), Article 19 (Freedoms), Emergency Provisions, Judicial Review'
          }, { merge: true });

          await bundleService.rebuildTopicBundle('polity');
          
          // Force server cache refresh
          fetch('/api/admin/refresh-cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user?.uid })
          }).catch(err => console.warn('Cache refresh failed:', err));

          toast.success('Article 21 content added and bundle rebuilt!');
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, 'topics/article-21');
          toast.error('Failed to add content');
        }
      }
    );
  };

  return (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Control Room</h1>
          <p className="text-slate-500 font-medium mt-1">Manage your high-yield content and app growth.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-5 py-2.5 rounded-full bg-emerald-50 border border-emerald-100 flex items-center gap-3 shadow-sm">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">App is Live</span>
          </div>
        </div>
      </header>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Live Subjects" value={subjects.filter(s => s.status === 'live').length.toString()} icon={BookOpen} color="violet" subtitle="Active categories" />
        <StatCard title="Total Topics" value={topics.length.toString()} icon={FileText} color="blue" subtitle="Revision units" />
        <StatCard title="Current Price" value={settings?.price ? `₹${settings.price}` : '₹999'} icon={Zap} color="amber" subtitle="Premium access" />
        <StatCard title="Sponsor" value={settings?.sponsorName || 'None'} icon={Users} color="emerald" subtitle="Active partner" />
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          <Card className="p-8 border-slate-200 shadow-sm">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-2.5 rounded-xl bg-violet-50 text-violet-600">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Founder's Quick Actions</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link to="/admin/topics" className="flex items-center gap-4 p-5 rounded-2xl border border-violet-100 bg-slate-50 hover:bg-white hover:shadow-xl hover:shadow-violet-200/50 transition-all group">
                <div className="h-12 w-12 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center group-hover:bg-violet-600 group-hover:text-white transition-all duration-300">
                  <Plus className="h-6 w-6" />
                </div>
                <div>
                  <span className="block text-sm font-bold text-slate-900">Add New Topic</span>
                  <span className="text-[10px] font-medium text-slate-500">Paste new revision content</span>
                </div>
              </Link>
              
              <Link to="/admin/subjects" className="flex items-center gap-4 p-5 rounded-2xl border border-violet-100 bg-slate-50 hover:bg-white hover:shadow-xl hover:shadow-violet-200/50 transition-all group">
                <div className="h-12 w-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div>
                  <span className="block text-sm font-bold text-slate-900">Manage Subjects</span>
                  <span className="text-[10px] font-medium text-slate-500">Edit categories & PDFs</span>
                </div>
              </Link>

              <Link to="/admin/settings" className="flex items-center gap-4 p-5 rounded-2xl border border-violet-100 bg-slate-50 hover:bg-white hover:shadow-xl hover:shadow-violet-200/50 transition-all group">
                <div className="h-12 w-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-all duration-300">
                  <Settings className="h-6 w-6" />
                </div>
                <div>
                  <span className="block text-sm font-bold text-slate-900">App Settings</span>
                  <span className="text-[10px] font-medium text-slate-500">Update pricing & branding</span>
                </div>
              </Link>

              <Link to="/dashboard" className="flex items-center gap-4 p-5 rounded-2xl border border-violet-100 bg-slate-50 hover:bg-white hover:shadow-xl hover:shadow-violet-200/50 transition-all group">
                <div className="h-12 w-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-all duration-300">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <span className="block text-sm font-bold text-slate-900">View Premium View</span>
                  <span className="text-[10px] font-medium text-slate-500">Preview as premium user</span>
                </div>
              </Link>

              <button onClick={seedData} className="flex items-center gap-4 p-5 rounded-2xl border border-violet-100 bg-slate-50 hover:bg-white hover:shadow-xl hover:shadow-violet-200/50 transition-all group text-left w-full">
                <div className="h-12 w-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-all duration-300">
                  <Zap className="h-6 w-6" />
                </div>
                <div>
                  <span className="block text-sm font-bold text-slate-900">Safe Seed Core Data</span>
                  <span className="text-[10px] font-medium text-slate-500">Add missing subjects/topics safely</span>
                </div>
              </button>

              <button onClick={seedArticle21} className="flex items-center gap-4 p-5 rounded-2xl border border-violet-100 bg-violet-50 hover:bg-white hover:shadow-xl hover:shadow-violet-200/50 transition-all group text-left w-full">
                <div className="h-12 w-12 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center group-hover:bg-violet-600 group-hover:text-white transition-all duration-300">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <span className="block text-sm font-bold text-slate-900">Add Article 21</span>
                  <span className="text-[10px] font-medium text-slate-500">Seed starter free content</span>
                </div>
              </button>

              <button onClick={seedPreamble} className="flex items-center gap-4 p-5 rounded-2xl border border-violet-100 bg-blue-50 hover:bg-white hover:shadow-xl hover:shadow-violet-200/50 transition-all group text-left w-full">
                <div className="h-12 w-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <span className="block text-sm font-bold text-slate-900">Add Preamble</span>
                  <span className="text-[10px] font-medium text-slate-500">Seed starter free content</span>
                </div>
              </button>

              <button 
                onClick={() => {
                  showConfirm(
                    'Rebuild All Bundles',
                    'This will scan all subjects and topics to recreate optimized data bundles. This reduces Firestore reads for your users significantly. Proceed?',
                    async () => {
                      const toastId = toast.loading('Rebuilding bundles...');
                      try {
                        await bundleService.rebuildAllBundles();
                        
                        // Force server cache refresh
                        fetch('/api/admin/refresh-cache', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ userId: user?.uid })
                        }).catch(err => console.warn('Cache refresh failed:', err));

                        toast.success('All bundles rebuilt successfully!', { id: toastId });
                      } catch (e) {
                        toast.error('Failed to rebuild bundles', { id: toastId });
                      }
                    }
                  );
                }} 
                className="flex items-center gap-4 p-5 rounded-2xl border border-emerald-100 bg-emerald-50 hover:bg-white hover:shadow-xl hover:shadow-emerald-200/50 transition-all group text-left w-full sm:col-span-2"
              >
                <div className="h-12 w-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                  <RefreshCw className="h-6 w-6" />
                </div>
                <div>
                  <span className="block text-sm font-bold text-slate-900">Optimize App Performance (Rebuild Bundles)</span>
                  <span className="text-[10px] font-medium text-slate-500">Reduces Firestore reads by up to 90% by bundling data</span>
                </div>
              </button>
            </div>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="p-8 border-slate-200 shadow-sm">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-2 rounded-xl bg-violet-50 text-violet-600">
                <LayoutDashboard className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Seed Data Overview</h3>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subjects to Seed</h4>
                <Badge variant="free">{INITIAL_SUBJECTS.length} Subjects</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {INITIAL_SUBJECTS.map(s => (
                  <Badge key={s.slug} variant="premium" className="bg-slate-100 text-slate-600 border-transparent">
                    {s.title}
                  </Badge>
                ))}
              </div>

              <div className="pt-6 border-t border-violet-100">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Topic Placeholders</h4>
                  <Badge variant="free">{TOPIC_PLACEHOLDERS.length} Topics</Badge>
                </div>
                <div className="max-h-80 overflow-y-auto pr-2 space-y-2">
                  {TOPIC_PLACEHOLDERS.map(t => (
                    <div key={t.slug} className="flex items-center justify-between p-3 rounded-xl border border-violet-100 bg-slate-50">
                      <div>
                        <p className="text-xs font-bold text-slate-900">{t.title}</p>
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-tight">{t.subjectSlug} • {t.chapter}</p>
                      </div>
                      <Badge variant={t.status === 'free' ? 'free' : 'premium'} className={cn(t.status === 'coming_soon' ? 'bg-amber-100 text-amber-700' : '')}>
                        {t.status === 'coming_soon' ? 'Placeholder' : t.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-8 border-slate-200 shadow-sm bg-slate-900 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <Info className="h-20 w-20" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-2 rounded-xl bg-white/10 text-violet-400">
                  <Info className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-black tracking-tight">Growth Tips</h3>
              </div>
              <ul className="space-y-6 text-sm font-bold text-slate-400">
                <li className="flex gap-4">
                  <div className="h-8 w-8 rounded-lg border border-violet-500/30 bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs font-black shrink-0">01</div>
                  <p className="leading-relaxed">Add <span className="text-white">1-2 topics daily</span> to keep users coming back for new content.</p>
                </li>
                <li className="flex gap-4">
                  <div className="h-8 w-8 rounded-lg border border-violet-500/30 bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs font-black shrink-0">02</div>
                  <p className="leading-relaxed">Mark high-value topics as <span className="text-violet-400 font-black">PREMIUM</span> to drive subscription revenue.</p>
                </li>
                <li className="flex gap-4">
                  <div className="h-8 w-8 rounded-lg border border-violet-500/30 bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs font-black shrink-0">03</div>
                  <p className="leading-relaxed">Use the <span className="text-white">"Copy Link"</span> feature to share specific topics on Telegram/WhatsApp.</p>
                </li>
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
  const colors: any = {
    violet: 'bg-violet-50 text-violet-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-700',
  };

  return (
    <Card className="p-6 border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className={cn('p-2 rounded-xl', colors[color])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
      <p className="text-2xl font-black text-slate-900 tracking-tight">{value}</p>
    </Card>
  );
}

function AdminSubjects({ showConfirm }: { showConfirm: any }) {
  const { user } = useAuth();
  const { subjects } = useSubjects();
  const [editingSubject, setEditingSubject] = useState<Partial<Subject> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject?.slug) return;

    const saveAction = async () => {
      setIsSaving(true);
      const id = (editingSubject.id || editingSubject.slug) as string;
      try {
        await setDoc(doc(db, 'subjects', id), { ...editingSubject, id });
        
        // Rebuild subjects bundle
        await bundleService.rebuildSubjectsBundle();
        
        // Force server cache refresh
        fetch('/api/admin/refresh-cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user?.uid })
        }).catch(err => console.warn('Cache refresh failed:', err));

        toast.success('Subject saved successfully!');
        setEditingSubject(null);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, `subjects/${id}`);
        toast.error('Failed to save subject');
      } finally {
        setIsSaving(false);
      }
    };

    if (editingSubject.id) {
      showConfirm('Update Subject', 'Are you sure you want to save changes to this subject?', saveAction);
    } else {
      saveAction();
    }
  };

  const handleDelete = async (id: string) => {
    showConfirm(
      'Delete Subject',
      'Are you sure? This will remove the subject from the app.',
      async () => {
        try {
          await deleteDoc(doc(db, 'subjects', id));
          // Rebuild Subjects bundle
          await bundleService.rebuildSubjectsBundle();

          // Force server cache refresh
          fetch('/api/admin/refresh-cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user?.uid })
          }).catch(err => console.warn('Cache refresh failed:', err));

          toast.success('Subject deleted and bundle updated');
        } catch (e) {
          handleFirestoreError(e, OperationType.DELETE, `subjects/${id}`);
          toast.error('Failed to delete subject');
        }
      }
    );
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Manage Subjects</h1>
          <p className="text-slate-500 font-medium mt-1">Categories that appear on your dashboard.</p>
        </div>
        <Button icon={Plus} size="lg" onClick={() => setEditingSubject({ status: 'coming_soon', order: 0, pdfVisible: false, pdfTitle: '', pdfUrl: '', pdfAccessType: 'premium' })} className="shadow-lg shadow-violet-200">
          Add New Subject
        </Button>
      </div>
      
      {editingSubject && (
        <Card className="max-w-4xl border-violet-200 shadow-2xl shadow-violet-100/50 animate-in fade-in zoom-in-95 duration-300 overflow-hidden">
          <div className="bg-slate-50 border-b border-violet-100 p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white shadow-sm text-violet-600">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{editingSubject.id ? 'Edit Subject' : 'Create New Subject'}</h3>
                {editingSubject.title && <p className="text-xs font-bold text-violet-600">{editingSubject.title}</p>}
              </div>
            </div>
            <button type="button" onClick={() => setEditingSubject(null)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSave} className="p-8 space-y-10">
            <div className="grid gap-10 lg:grid-cols-2">
              {/* Section 1: Basic Info */}
              <div className="space-y-8">
                <div className="space-y-6">
                  <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
                    <div className="p-1.5 rounded-lg bg-violet-100 text-violet-600">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Subject Identity</h4>
                  </div>
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Subject Name (e.g. Indian Polity)</label>
                      <input type="text" className="w-full h-12 rounded-xl border-slate-200 font-bold focus:ring-violet-500 focus:border-violet-500" value={editingSubject.title || ''} onChange={e => setEditingSubject({...editingSubject, title: e.target.value})} placeholder="e.g. Indian Polity" required />
                      <p className="text-[10px] font-medium text-slate-400 italic">Visible on the dashboard cards.</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Slug (lowercase, for URL)</label>
                      <input type="text" className="w-full h-12 rounded-xl border-slate-200 font-bold focus:ring-violet-500 focus:border-violet-500" value={editingSubject.slug || ''} onChange={e => setEditingSubject({...editingSubject, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})} placeholder="e.g. polity" required />
                      <p className="text-[10px] font-medium text-slate-400 italic">Used in the browser address bar.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Short Description</label>
                    <textarea className="w-full rounded-xl border-slate-200 font-medium focus:ring-violet-500 focus:border-violet-500 p-4" rows={3} value={editingSubject.description || ''} onChange={e => setEditingSubject({...editingSubject, description: e.target.value})} placeholder="What will students learn here?" />
                    <p className="text-[10px] font-medium text-slate-400 italic">A brief summary shown on the subject card.</p>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">App Visibility</label>
                      <select className="w-full h-12 rounded-xl border-slate-200 font-bold focus:ring-violet-500 focus:border-violet-500" value={editingSubject.status} onChange={e => setEditingSubject({...editingSubject, status: e.target.value as any})}>
                        <option value="live">Live & Active</option>
                        <option value="coming_soon">Coming Soon</option>
                        <option value="hidden">Hidden / Draft</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Display Order</label>
                      <input type="number" className="w-full h-12 rounded-xl border-slate-200 font-bold focus:ring-violet-500 focus:border-violet-500" value={editingSubject.order || 0} onChange={e => setEditingSubject({...editingSubject, order: parseInt(e.target.value)})} />
                      <p className="text-[10px] font-medium text-slate-400 italic">Lower numbers appear first.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: PDF Management */}
              <div className="space-y-8">
                <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-blue-100 text-blue-600">
                        <FileText className="h-4 w-4" />
                      </div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">PDF High-Yield Resource (Optional)</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingSubject({...editingSubject, pdfVisible: !editingSubject.pdfVisible})}
                      className={cn(
                        "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2",
                        editingSubject.pdfVisible 
                          ? "bg-violet-600 border-violet-600 text-white shadow-md shadow-violet-200" 
                          : "bg-white border-slate-200 text-slate-400"
                      )}
                    >
                      <div className={cn("h-2 w-2 rounded-full", editingSubject.pdfVisible ? "bg-white animate-pulse" : "bg-slate-300")} />
                      {editingSubject.pdfVisible ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                  
                  {editingSubject.pdfVisible ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Button Label</label>
                        <input type="text" className="w-full h-12 rounded-xl border-slate-200 text-sm font-bold focus:ring-violet-500 focus:border-violet-500" value={editingSubject.pdfTitle || ''} onChange={e => setEditingSubject({...editingSubject, pdfTitle: e.target.value})} placeholder="e.g. Download Polity PDF" />
                        <p className="text-[10px] font-medium text-slate-400 italic">What the button says in the app.</p>
                      </div>
                      <div className="grid gap-6 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">PDF Access</label>
                          <select 
                            className="w-full h-12 rounded-xl border-slate-200 text-sm font-bold focus:ring-violet-500 focus:border-violet-500"
                            value={editingSubject.pdfAccessType || 'premium'}
                            onChange={e => setEditingSubject({...editingSubject, pdfAccessType: e.target.value as any})}
                          >
                            <option value="free">Free for everyone</option>
                            <option value="premium">Premium users only</option>
                          </select>
                          <p className="text-[10px] font-medium text-slate-400 italic">Who can download this file?</p>
                        </div>
                        <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">PDF High-Yield Resource</label>
                            <div className="flex flex-col gap-4">
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Manual URL (e.g. Drive Link)</label>
                                <input 
                                  type="text" 
                                  className="w-full h-10 rounded-xl border-slate-200 text-xs font-medium focus:ring-violet-500 focus:border-violet-500" 
                                  value={editingSubject.pdfUrl || ''} 
                                  onChange={e => setEditingSubject({...editingSubject, pdfUrl: e.target.value})} 
                                  placeholder="Paste URL here..." 
                                />
                              </div>

                              <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">PDF Password (Optional)</label>
                                <input 
                                  type="text" 
                                  className="w-full h-10 rounded-xl border-slate-200 text-xs font-medium focus:ring-violet-500 focus:border-violet-500" 
                                  value={editingSubject.pdfPassword || ''} 
                                  onChange={e => setEditingSubject({...editingSubject, pdfPassword: e.target.value})} 
                                  placeholder="e.g. upsc2026" 
                                />
                              </div>
                              
                              <div className="pt-2">
                                {editingSubject.pdfUrl && (
                                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 group">
                                    <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600">
                                      <FileText className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                      <span className="block text-xs font-black text-emerald-900 truncate">PDF Linked</span>
                                      <a href={editingSubject.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-emerald-600 hover:underline truncate block">
                                        View File
                                      </a>
                                    </div>
                                    <button onClick={() => setEditingSubject({...editingSubject, pdfUrl: '', pdfPassword: ''})} type="button" className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg">
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            <p className="text-[10px] font-medium text-slate-400 italic">Upload the resource PDF. Remember to save subject after uploading!</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-3xl">
                      <FileText className="h-8 w-8 text-slate-200 mx-auto mb-3" />
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">PDF Resource Disabled</p>
                      <p className="text-[10px] font-medium text-slate-400 mt-1">Enable to show a download button for this subject.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-violet-100 flex items-center justify-end gap-4">
              <button type="button" onClick={() => setEditingSubject(null)} className="px-6 py-3 text-sm font-black text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest">Discard</button>
              <Button type="submit" icon={Save} loading={isSaving} className="px-10 h-14 text-base shadow-xl shadow-violet-200">
                {editingSubject.id ? 'Update Subject' : 'Create Subject'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full text-left min-w-[600px]">
          <thead className="bg-slate-50/50 border-b border-slate-200">
            <tr>
              <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-400">Subject</th>
              <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-400 text-center">Status</th>
              <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-400 text-center">PDF</th>
              <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {subjects.sort((a, b) => (a.order || 0) - (b.order || 0)).map((s) => (
              <tr key={s.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-8 py-5">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center group-hover:bg-violet-100 group-hover:text-violet-600 transition-colors">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="block font-black text-slate-900">{s.title}</span>
                      <span className="text-xs font-medium text-slate-400 tracking-tight">Order: {s.order} • /{s.slug}</span>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-5 text-center">
                  <Badge variant={s.status}>{s.status === 'live' ? 'Live' : 'Soon'}</Badge>
                </td>
                <td className="px-8 py-5 text-center">
                  {s.pdfVisible ? (
                    <div className="inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                      <FileText className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-black uppercase tracking-widest">{s.pdfAccessType}</span>
                    </div>
                  ) : (
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">None</span>
                  )}
                </td>
                <td className="px-8 py-5 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingSubject(s)} className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(s.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const BULK_PASTE_TEMPLATE = `### Why this matters
[Explain why this topic is high-yield for UPSC]

### Core Concept
[The fundamental principle or definition]

### UPSC Gold Point
[A critical fact or observation often tested]

### Deep Understanding
[Detailed explanation or analysis]

### Linked Facts
[Related data points or dimensions]

### Trap Zone
[Common mistakes or confusing points]

### Memory Trick
[Mnemonics or simple analogies]

### Prelims Snapshot
[Quick facts for last-minute revision]

### MCQs
[1-2 practice questions with options]

### One-Line Revision
[The entire topic in a single sentence]

### Linked Topics
[Comma separated list of related topics]`;

function AdminTopics({ showConfirm }: { showConfirm: any }) {
  const { user } = useAuth();
  const { topics } = useTopics();
  const { subjects } = useSubjects();
  const [editingTopic, setEditingTopic] = useState<Partial<Topic> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handlePaste = (e: React.ClipboardEvent) => {
    // Force plain text paste to preserve symbols like ° and subscripts
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const target = e.target as HTMLTextAreaElement | HTMLInputElement;
    const start = target.selectionStart || 0;
    const end = target.selectionEnd || 0;
    const value = target.value;
    const newValue = value.substring(0, start) + text + value.substring(end);
    
    const name = target.name;
    if (name && editingTopic) {
      setEditingTopic({ ...editingTopic, [name]: newValue });
      
      // Set cursor position after update
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + text.length;
      }, 0);
    }
  };

  const filteredTopics = topics.filter(t => filterSubject === 'all' || t.subjectSlug === filterSubject);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [filterSubject]);

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTopics.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTopics.map(t => t.id)));
    }
  };

  const handleDeleteSelected = async () => {
    const count = selectedIds.size;
    showConfirm(
      `Delete ${count} Topics`,
      `Are you sure? This will permanently delete the ${count} selected topics. This action cannot be undone.`,
      async () => {
        const toastId = toast.loading(`Deleting ${count} topics...`);
        try {
          const batch = writeBatch(db);
          selectedIds.forEach(id => {
            batch.delete(doc(db, 'topics', id));
          });
          await batch.commit();
          setSelectedIds(new Set());
          toast.success(`Successfully deleted ${count} topics`, { id: toastId });
        } catch (e) {
          handleFirestoreError(e, OperationType.DELETE, 'topics/bulk');
          toast.error('Failed to delete topics', { id: toastId });
        }
      }
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTopic?.slug || !editingTopic.title) {
      toast.error('Title and Slug are required');
      return;
    }

    const saveAction = async () => {
      setIsSaving(true);
      const id = (editingTopic.id || editingTopic.slug) as string;
      
      // Sanitizer to remove undefined values effectively
      const sanitize = (obj: any): any => {
        const result: any = {};
        Object.keys(obj).forEach(key => {
          if (obj[key] !== undefined) {
            result[key] = obj[key] === '' ? null : obj[key];
          }
        });
        return result;
      };

      try {
        const payload = sanitize({ 
          ...editingTopic, 
          id,
          order: Number.isNaN(Number(editingTopic.order)) ? 0 : Number(editingTopic.order)
        });
        
        await setDoc(doc(db, 'topics', id), payload);
        
        // Rebuild the relevant topic bundle
        if (editingTopic.subjectSlug) {
          try {
            await bundleService.rebuildTopicBundle(editingTopic.subjectSlug);
          } catch (bundleErr) {
            console.error('Bundle rebuild failed, but Firestore saved:', bundleErr);
            toast.error('Topic saved, but cache update failed. Users might see old data for a while.', { duration: 5000 });
          }
        }
        
        toast.success('Topic saved successfully!');
        
        // Force server cache refresh so changes appear immediately
        fetch('/api/admin/refresh-cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user?.uid })
        }).catch(err => console.warn('Cache refresh failed:', err));

        setEditingTopic(null);
      } catch (e) {
        console.error('Failed to save topic:', e);
        handleFirestoreError(e, OperationType.WRITE, `topics/${id}`);
        toast.error('Firestore Error: Failed to publish topic. Check console for details.');
      } finally {
        setIsSaving(false);
      }
    };

    if (editingTopic.id) {
      showConfirm('Update Topic', 'Are you sure you want to save changes to this topic?', saveAction);
    } else {
      saveAction();
    }
  };

  const handleDelete = async (id: string) => {
    showConfirm(
      'Delete Topic',
      'Are you sure? This will permanently delete this topic.',
      async () => {
        try {
          await deleteDoc(doc(db, 'topics', id));
          // Rebuild relevant topic bundle
          const topicToDelete = topics.find(t => t.id === id);
          if (topicToDelete?.subjectSlug) {
             await bundleService.rebuildTopicBundle(topicToDelete.subjectSlug);
          }
          
          // Force server cache refresh
          fetch('/api/admin/refresh-cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user?.uid })
          }).catch(err => console.warn('Cache refresh failed:', err));

          toast.success('Topic deleted and bundle updated');
        } catch (e) {
          handleFirestoreError(e, OperationType.DELETE, `topics/${id}`);
          toast.error('Failed to delete topic');
        }
      }
    );
  };

  const handleDeleteAllInSubject = async () => {
    const subjectTitle = filterSubject === 'all' ? 'All Subjects' : subjects.find(s => s.slug === filterSubject)?.title || filterSubject;
    showConfirm(
      `Delete All Topics in ${subjectTitle}`,
      `Are you sure? This will permanently delete ALL ${filteredTopics.length} topics currently shown for ${subjectTitle}. This action cannot be undone.`,
      async () => {
        if (filteredTopics.length === 0) {
          toast.error('No topics found to delete');
          return;
        }

        const toastId = toast.loading(`Deleting ${filteredTopics.length} topics...`);
        try {
          const batch = writeBatch(db);
          filteredTopics.forEach(t => {
            batch.delete(doc(db, 'topics', t.id));
          });
          await batch.commit();

          // Force server cache refresh
          fetch('/api/admin/refresh-cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user?.uid })
          }).catch(err => console.warn('Cache refresh failed:', err));

          toast.success(`Successfully deleted ${filteredTopics.length} topics`, { id: toastId });
        } catch (e) {
          handleFirestoreError(e, OperationType.DELETE, 'topics/bulk');
          toast.error('Failed to delete topics', { id: toastId });
        }
      }
    );
  };

  const [isBulkPasteOpen, setIsBulkPasteOpen] = useState(false);
  const [bulkContent, setBulkContent] = useState('');

  const handleBulkPaste = () => {
    const sections = [
      { key: 'whyThisMatters', header: '### Why this matters' },
      { key: 'coreConcept', header: '### Core Concept' },
      { key: 'upscGoldPoint', header: '### UPSC Gold Point' },
      { key: 'deepUnderstanding', header: '### Deep Understanding' },
      { key: 'linkedFacts', header: '### Linked Facts' },
      { key: 'trapZone', header: '### Trap Zone' },
      { key: 'memoryTrick', header: '### Memory Trick' },
      { key: 'prelimsSnapshot', header: '### Prelims Snapshot' },
      { key: 'mcqs', header: '### MCQs' },
      { key: 'oneLineRevision', header: '### One-Line Revision' },
      { key: 'linkedTopics', header: '### Linked Topics' },
    ];

    let updatedTopic = { ...editingTopic };
    
    sections.forEach((section, index) => {
      const nextHeader = sections[index + 1]?.header;
      const startIdx = bulkContent.indexOf(section.header);
      
      if (startIdx !== -1) {
        const contentStart = startIdx + section.header.length;
        const endIdx = nextHeader ? bulkContent.indexOf(nextHeader, contentStart) : bulkContent.length;
        
        const content = bulkContent.substring(contentStart, endIdx !== -1 ? endIdx : bulkContent.length).trim();
        updatedTopic = { ...updatedTopic, [section.key]: content };
      }
    });

    setEditingTopic(updatedTopic);
    setIsBulkPasteOpen(false);
    setBulkContent('');
    toast.success('Fields populated from bulk content!');
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Content Topics</h1>
          <p className="text-slate-500 font-medium mt-1">Manage your revision flow: Subject → Chapter → Topic.</p>
        </div>
        <div className="flex gap-4">
          {selectedIds.size > 0 ? (
            <Button 
              variant="outline" 
              icon={Trash2} 
              size="lg" 
              onClick={handleDeleteSelected} 
              className="border-2 border-rose-100 text-rose-600 hover:bg-rose-50"
            >
              Delete {selectedIds.size} Selected
            </Button>
          ) : filteredTopics.length > 0 && (
            <Button 
              variant="outline" 
              icon={Trash2} 
              size="lg" 
              onClick={handleDeleteAllInSubject} 
              className="border-2 border-violet-100 text-slate-400 hover:bg-slate-50"
            >
              Delete All Topics
            </Button>
          )}
          <Button icon={Plus} size="lg" onClick={() => setEditingTopic({ status: 'free', order: 0, subjectSlug: filterSubject !== 'all' ? filterSubject : subjects[0]?.slug })} className="shadow-lg shadow-violet-200">
            Create New Topic
          </Button>
        </div>
      </div>

      {/* Subject Navigation Flow */}
      <div className="flex flex-wrap gap-2 p-2 bg-white rounded-3xl border border-violet-100 shadow-sm">
        <button
          onClick={() => setFilterSubject('all')}
          className={cn(
            "px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all",
            filterSubject === 'all' 
              ? "bg-violet-600 text-white shadow-lg shadow-violet-200" 
              : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
          )}
        >
          All Subjects
        </button>
        {subjects.map(s => (
          <button
            key={s.slug}
            onClick={() => setFilterSubject(s.slug)}
            className={cn(
              "px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all",
              filterSubject === s.slug 
                ? "bg-violet-600 text-white shadow-lg shadow-violet-200" 
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
            )}
          >
            {s.title}
          </button>
        ))}
      </div>

      {/* Bulk Paste Modal */}
      {isBulkPasteOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-violet-100 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Bulk Paste Content</h3>
                <p className="text-sm font-medium text-slate-400">Paste a markdown block with headers to populate fields automatically.</p>
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    navigator.clipboard.writeText(BULK_PASTE_TEMPLATE);
                    toast.success('Template copied to clipboard!');
                  }}
                  className="h-10 rounded-xl px-4 font-bold border-2 border-violet-100 text-slate-600 hover:bg-slate-50"
                >
                  <Copy className="mr-2 h-4 w-4" /> Copy Template
                </Button>
                <Button variant="outline" onClick={() => setIsBulkPasteOpen(false)} className="h-10 w-10 p-0 rounded-xl">
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              <div className="p-6 rounded-2xl bg-violet-50 border border-violet-100 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-widest text-violet-600">Instructions</h4>
                <p className="text-sm font-medium text-violet-900/70 leading-relaxed">
                  Use the following headers (H3) to separate sections. Any text after a header until the next header will be assigned to that field.
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    '### Why this matters', '### Core Concept', '### UPSC Gold Point', 
                    '### Deep Understanding', '### Linked Facts', '### Trap Zone', 
                    '### Memory Trick', '### Prelims Snapshot', '### MCQs', 
                    '### One-Line Revision', '### Linked Topics'
                  ].map(h => (
                    <code key={h} className="px-2 py-1 rounded bg-white border border-violet-200 text-[10px] font-bold text-violet-600">{h}</code>
                  ))}
                </div>
              </div>
              <textarea 
                className="w-full h-[400px] rounded-2xl border-slate-200 font-mono text-sm p-6 focus:ring-violet-500 focus:border-violet-500"
                value={bulkContent}
                onChange={e => setBulkContent(e.target.value)}
                placeholder="### Why this matters&#10;This topic is key because...&#10;&#10;### Core Concept&#10;The main idea is..."
              />
            </div>
            <div className="p-8 border-t border-violet-100 bg-slate-50 flex justify-end gap-4">
              <Button variant="outline" onClick={() => setIsBulkPasteOpen(false)} className="h-12 rounded-xl px-6 font-bold border">
                Cancel
              </Button>
              <Button onClick={handleBulkPaste} className="h-12 rounded-xl px-8 font-bold shadow-xl shadow-violet-200">
                <Zap className="mr-2 h-5 w-5" /> Populate Fields
              </Button>
            </div>
          </div>
        </div>
      )}

      {editingTopic && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8 overflow-hidden">
          <Card className="w-full max-w-5xl h-full max-h-[90vh] flex flex-col border-violet-200 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            {/* Sticky Header */}
            <div className="bg-white border-b border-violet-100 p-6 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-2xl bg-violet-50 text-violet-600">
                  <Layout className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest">{editingTopic.id ? 'Edit Topic' : 'New Topic'}</h3>
                  {editingTopic.title && <p className="text-xs font-bold text-violet-600">{editingTopic.title}</p>}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Button variant="outline" onClick={() => setIsBulkPasteOpen(true)} className="h-10 rounded-xl px-4 font-bold border border-violet-200 text-violet-600 hover:bg-violet-50">
                  <Zap className="mr-2 h-4 w-4" /> Bulk Paste
                </Button>
                <button type="button" onClick={() => setEditingTopic(null)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Scrollable Form Content */}
            <form id="topic-form" onSubmit={handleSave} className="flex-1 overflow-y-auto p-8 lg:p-12 space-y-16">
              <div className="grid gap-16 lg:grid-cols-2">
                {/* Left Column: Identity & Core */}
                <div className="space-y-16">
                  <section className="space-y-8">
                    <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
                      <div className="p-1.5 rounded-lg bg-violet-100 text-violet-600">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Topic Identity</h4>
                    </div>
                    <div className="grid gap-6 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Topic Name (Public Title)</label>
                        <input type="text" name="title" className="w-full h-12 rounded-xl border-slate-200 font-bold focus:ring-violet-500 focus:border-violet-500" value={editingTopic.title || ''} onChange={e => setEditingTopic({...editingTopic, title: e.target.value})} placeholder="e.g. Fundamental Rights" required />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Slug (for URL)</label>
                        <input type="text" name="slug" className="w-full h-12 rounded-xl border-slate-200 font-bold focus:ring-violet-500 focus:border-violet-500" value={editingTopic.slug || ''} onChange={e => setEditingTopic({...editingTopic, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})} placeholder="e.g. fundamental-rights" required />
                      </div>
                    </div>
                    <div className="grid gap-6 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Parent Subject</label>
                        <select name="subjectSlug" className="w-full h-12 rounded-xl border-slate-200 font-bold focus:ring-violet-500 focus:border-violet-500" value={editingTopic.subjectSlug} onChange={e => setEditingTopic({...editingTopic, subjectSlug: e.target.value})}>
                          {subjects.map(s => <option key={s.slug} value={s.slug}>{s.title}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Chapter / Category (Optional)</label>
                        <input type="text" name="chapter" className="w-full h-12 rounded-xl border-slate-200 font-bold focus:ring-violet-500 focus:border-violet-500" value={editingTopic.chapter || ''} onChange={e => setEditingTopic({...editingTopic, chapter: e.target.value})} placeholder="e.g. Fundamental Rights" />
                      </div>
                    </div>
                    <div className="grid gap-6 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Display Order</label>
                        <input type="number" name="order" className="w-full h-12 rounded-xl border-slate-200 font-bold focus:ring-violet-500 focus:border-violet-500" value={editingTopic.order || 0} onChange={e => setEditingTopic({...editingTopic, order: parseInt(e.target.value) || 0})} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Short Teaser</label>
                      <textarea name="teaser" onPaste={handlePaste} className="w-full rounded-xl border-slate-200 font-medium focus:ring-violet-500 focus:border-violet-500 p-4" rows={2} value={editingTopic.teaser || ''} onChange={e => setEditingTopic({...editingTopic, teaser: e.target.value})} placeholder="A brief hook for the dashboard..." />
                    </div>
                    <div className="grid gap-6 sm:grid-cols-3">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Access Status</label>
                        <select name="status" className="w-full h-12 rounded-xl border-slate-200 font-bold focus:ring-violet-500 focus:border-violet-500" value={editingTopic.status} onChange={e => setEditingTopic({...editingTopic, status: e.target.value as any})}>
                          <option value="free">Free</option>
                          <option value="premium">Premium</option>
                          <option value="coming_soon">Coming Soon</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Exam Relevance</label>
                        <input type="text" name="examRelevance" className="w-full h-12 rounded-xl border-slate-200 font-bold focus:ring-violet-500 focus:border-violet-500" value={editingTopic.examRelevance || ''} onChange={e => setEditingTopic({...editingTopic, examRelevance: e.target.value})} placeholder="e.g. High - Prelims" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Revision Time</label>
                        <input type="text" name="estimatedTime" className="w-full h-12 rounded-xl border-slate-200 font-bold focus:ring-violet-500 focus:border-violet-500" value={editingTopic.estimatedTime || ''} onChange={e => setEditingTopic({...editingTopic, estimatedTime: e.target.value})} placeholder="e.g. 5 mins" />
                      </div>
                    </div>
                    <div className="grid gap-6 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Last Updated</label>
                        <input type="text" name="lastUpdated" className="w-full h-12 rounded-xl border-slate-200 font-bold focus:ring-violet-500 focus:border-violet-500" value={editingTopic.lastUpdated || ''} onChange={e => setEditingTopic({...editingTopic, lastUpdated: e.target.value})} placeholder="e.g. 01 April 2026" />
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">PDF & Graphics Resource</label>
                        <div className="grid gap-6">
                          {/* Topic PDF */}
                          <div className="space-y-4 p-6 rounded-2xl bg-slate-50 border border-slate-200">
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="h-4 w-4 text-violet-600" />
                              <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-900">PDF Resource</h5>
                            </div>
                            
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">PDF URL (e.g. Google Drive)</label>
                                <input 
                                  type="text" 
                                  name="pdfUrl"
                                  className="w-full h-10 rounded-xl border-slate-200 text-xs font-medium focus:ring-violet-500 focus:border-violet-500" 
                                  value={editingTopic.pdfUrl || ''} 
                                  onChange={e => setEditingTopic({...editingTopic, pdfUrl: e.target.value})} 
                                  placeholder="Paste link here..." 
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">PDF Password</label>
                                <input 
                                  type="text" 
                                  name="pdfPassword"
                                  className="w-full h-10 rounded-xl border-slate-200 text-xs font-medium focus:ring-violet-500 focus:border-violet-500" 
                                  value={editingTopic.pdfPassword || ''} 
                                  onChange={e => setEditingTopic({...editingTopic, pdfPassword: e.target.value})} 
                                  placeholder="Secret password..." 
                                />
                              </div>
                            </div>

                            <div className="pt-2">
                              {editingTopic.pdfUrl && (
                                <div className="p-3 rounded-xl bg-violet-100/50 border border-violet-200 flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-violet-700 truncate max-w-[150px]">{editingTopic.pdfUrl}</span>
                                  <button type="button" onClick={() => setEditingTopic({...editingTopic, pdfUrl: '', pdfPassword: ''})} className="p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg transition-colors">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Topic Infographic */}
                          <div className="space-y-4 p-6 rounded-2xl bg-amber-50/50 border border-amber-100">
                            <div className="flex items-center gap-2 mb-2">
                              <Image className="h-4 w-4 text-amber-600" />
                              <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-900">Infographic Resource</h5>
                            </div>

                            <div className="space-y-3">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-amber-900/60 uppercase tracking-tighter">Image URL</label>
                                <input 
                                  type="text" 
                                  name="infographicUrl"
                                  className="w-full h-10 rounded-xl border-amber-200 text-xs font-medium focus:ring-amber-500 focus:border-amber-500 bg-white" 
                                  value={editingTopic.infographicUrl || ''} 
                                  onChange={e => setEditingTopic({...editingTopic, infographicUrl: e.target.value})} 
                                  placeholder="Paste image link..." 
                                />
                              </div>
                            </div>

                            <div className="pt-2">
                              {editingTopic.infographicUrl && (
                                <div className="p-3 rounded-xl bg-amber-100/50 border border-amber-200 flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-amber-700 truncate max-w-[150px]">{editingTopic.infographicUrl}</span>
                                  <button type="button" onClick={() => setEditingTopic({...editingTopic, infographicUrl: ''})} className="p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg transition-colors">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-8 p-8 rounded-[2rem] bg-white border border-violet-100 shadow-xl shadow-slate-100/50">
                    <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
                      <div className="p-1.5 rounded-lg bg-violet-100 text-violet-600">
                        <Zap className="h-4 w-4" />
                      </div>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-900">Main Topic Content</h4>
                    </div>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Why this matters</label>
                        <textarea name="whyThisMatters" onPaste={handlePaste} className="w-full h-32 rounded-2xl bg-slate-50/50 border-slate-200 text-slate-900 font-medium text-sm focus:ring-violet-500 focus:border-violet-500 p-4" value={editingTopic.whyThisMatters || ''} onChange={e => setEditingTopic({...editingTopic, whyThisMatters: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Core Concept</label>
                        <textarea name="coreConcept" onPaste={handlePaste} className="w-full h-64 rounded-2xl bg-slate-50/50 border-slate-200 text-slate-900 font-medium text-sm focus:ring-violet-500 focus:border-violet-500 p-4" value={editingTopic.coreConcept || ''} onChange={e => setEditingTopic({...editingTopic, coreConcept: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">UPSC Gold Point</label>
                        <textarea name="upscGoldPoint" onPaste={handlePaste} className="w-full h-32 rounded-2xl bg-slate-50/50 border-slate-200 text-slate-900 font-medium text-sm focus:ring-violet-500 focus:border-violet-500 p-4" value={editingTopic.upscGoldPoint || ''} onChange={e => setEditingTopic({...editingTopic, upscGoldPoint: e.target.value})} />
                      </div>
                    </div>
                  </section>
                </div>

                {/* Right Column: Strategy & Assessment */}
                <div className="space-y-16">
                  <section className="space-y-8">
                    <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
                      <div className="p-1.5 rounded-lg bg-amber-100 text-amber-600">
                        <Target className="h-4 w-4" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Advanced Sections</h4>
                    </div>
                    <div className="grid gap-8">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Deep Understanding</label>
                        <textarea name="deepUnderstanding" onPaste={handlePaste} className="w-full rounded-xl border-slate-200 bg-slate-50/50 font-medium focus:ring-violet-500 focus:border-violet-500 p-4" rows={4} value={editingTopic.deepUnderstanding || ''} onChange={e => setEditingTopic({...editingTopic, deepUnderstanding: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Linked Facts / Dimensions</label>
                        <textarea name="linkedFacts" onPaste={handlePaste} className="w-full rounded-xl border-slate-200 bg-slate-50/50 font-medium focus:ring-violet-500 focus:border-violet-500 p-4" rows={4} value={editingTopic.linkedFacts || ''} onChange={e => setEditingTopic({...editingTopic, linkedFacts: e.target.value})} />
                      </div>
                      <div className="grid gap-6 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Trap Zone</label>
                          <textarea name="trapZone" onPaste={handlePaste} className="w-full rounded-xl border-slate-200 bg-orange-50/30 font-medium focus:ring-orange-500 focus:border-orange-500 p-4" rows={4} value={editingTopic.trapZone || ''} onChange={e => setEditingTopic({...editingTopic, trapZone: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Memory Trick</label>
                          <textarea name="memoryTrick" onPaste={handlePaste} className="w-full rounded-xl border-slate-200 bg-emerald-50/30 font-medium focus:ring-emerald-500 focus:border-emerald-500 p-4" rows={4} value={editingTopic.memoryTrick || ''} onChange={e => setEditingTopic({...editingTopic, memoryTrick: e.target.value})} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Prelims Snapshot</label>
                        <textarea name="prelimsSnapshot" onPaste={handlePaste} className="w-full rounded-xl border-slate-200 bg-blue-50/30 font-medium focus:ring-blue-500 focus:border-blue-500 p-4" rows={4} value={editingTopic.prelimsSnapshot || ''} onChange={e => setEditingTopic({...editingTopic, prelimsSnapshot: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">MCQs (Question & Answer)</label>
                        <textarea name="mcqs" onPaste={handlePaste} className="w-full rounded-xl border-slate-200 bg-indigo-50/30 font-medium focus:ring-indigo-500 focus:border-indigo-500 p-4" rows={4} value={editingTopic.mcqs || ''} onChange={e => setEditingTopic({...editingTopic, mcqs: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">One-Line Revision</label>
                        <textarea name="oneLineRevision" onPaste={handlePaste} className="w-full rounded-xl border-slate-200 bg-violet-50/30 font-medium focus:ring-violet-500 focus:border-violet-500 p-4" rows={2} value={editingTopic.oneLineRevision || ''} onChange={e => setEditingTopic({...editingTopic, oneLineRevision: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Linked Topics</label>
                        <input type="text" className="w-full h-12 rounded-xl border-slate-200 font-bold focus:ring-violet-500 focus:border-violet-500" value={editingTopic.linkedTopics || ''} onChange={e => setEditingTopic({...editingTopic, linkedTopics: e.target.value})} placeholder="e.g. Preamble, Fundamental Rights" />
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </form>

            {/* Sticky Footer */}
            <div className="bg-slate-50 border-t border-violet-100 p-6 flex items-center justify-end gap-4 shrink-0">
              <button type="button" onClick={() => setEditingTopic(null)} className="px-6 py-3 text-sm font-black text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest">Discard Changes</button>
              <Button type="submit" form="topic-form" icon={Save} loading={isSaving} className="px-10 h-14 text-base shadow-xl shadow-violet-200">
                {editingTopic.id ? 'Update Topic' : 'Publish Topic'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-violet-100 shadow-sm">
          <div className="flex items-center gap-3">
            <Filter className="h-4 w-4 text-slate-400" />
            <select className="bg-transparent border-none font-bold text-slate-600 focus:ring-0 text-sm" value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
              <option value="all">All Subjects</option>
              {subjects.map(s => <option key={s.slug} value={s.slug}>{s.title}</option>)}
            </select>
          </div>
          <div className="text-xs font-black text-slate-400 uppercase tracking-widest">
            {filteredTopics.length} Topics Found
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-slate-50/50 border-b border-slate-200">
              <tr>
                <th className="px-8 py-5 w-10">
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 h-4 w-4"
                    checked={filteredTopics.length > 0 && selectedIds.size === filteredTopics.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-400">Topic Title</th>
                <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-400">Subject / Chapter</th>
                <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-400 text-center">Status</th>
                <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTopics.sort((a, b) => (a.order || 0) - (b.order || 0)).map((t) => (
                <tr key={t.id} className={cn("hover:bg-slate-50/50 transition-colors group", selectedIds.has(t.id) && "bg-violet-50/30")}>
                  <td className="px-8 py-5">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 h-4 w-4"
                      checked={selectedIds.has(t.id)}
                      onChange={() => toggleSelection(t.id)}
                    />
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center group-hover:bg-violet-100 group-hover:text-violet-600 transition-colors">
                        <Layout className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="block font-black text-slate-900">{t.title}</span>
                        <span className="text-xs font-medium text-slate-400 tracking-tight">Order: {t.order} • /{t.slug}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="space-y-1">
                      <Badge variant="live" className="bg-white text-violet-600 border-violet-100 font-black text-[10px] uppercase tracking-tighter">
                        {subjects.find(s => s.slug === t.subjectSlug)?.title || t.subjectSlug}
                      </Badge>
                      {t.chapter && (
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                          {t.chapter}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <Badge variant={t.status}>{t.status === 'free' ? 'Free' : t.status === 'premium' ? 'Premium' : 'Soon'}</Badge>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => {
                        const url = `${window.location.origin}/subject/${t.subjectSlug}/topic/${t.slug}`;
                        navigator.clipboard.writeText(url);
                        toast.success('Link copied to clipboard');
                      }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Copy Link">
                        <ExternalLink className="h-4 w-4" />
                      </button>
                      <button onClick={() => setEditingTopic(t)} className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(t.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AdminSettings({ showConfirm }: { showConfirm: any }) {
  const { settings } = useSettings();
  const [formData, setFormData] = useState<AppSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings) setFormData(settings);
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;
    showConfirm(
      'Save Settings',
      'Are you sure you want to update the global app settings? This will affect all live users immediately.',
      async () => {
        setIsSaving(true);
        try {
          await setDoc(doc(db, 'settings', 'global'), formData);
          toast.success('Global settings updated!');
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, 'settings/global');
          toast.error('Failed to save settings');
        } finally {
          setIsSaving(false);
        }
      }
    );
  };

  if (!formData) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
    </div>
  );

  return (
    <div className="space-y-10">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">App Settings</h1>
          <p className="text-slate-500 font-medium mt-1">Control the global identity, pricing, and messaging of your app.</p>
        </div>
        <Button onClick={handleSave} icon={Save} loading={isSaving} className="shadow-lg shadow-violet-200 hidden sm:flex">
          Update Global Settings
        </Button>
      </header>

      <div className="grid gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-10">
          <Card className="p-8 border-slate-200 shadow-sm space-y-10">
            {/* Section: Branding */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
                <div className="p-1.5 rounded-lg bg-violet-100 text-violet-600">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Branding & Identity</h4>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">App Name</label>
                  <input type="text" className="w-full h-12 rounded-xl border-slate-200 font-bold focus:ring-violet-500 focus:border-violet-500" value={formData.appName || ''} onChange={e => setFormData({...formData, appName: e.target.value})} placeholder="e.g. PreCall" />
                  <p className="text-[10px] font-medium text-slate-400 italic">The name of your application.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Partner / Sponsor Name</label>
                  <input type="text" className="w-full h-12 rounded-xl border-slate-200 font-bold focus:ring-violet-500 focus:border-violet-500" value={formData.sponsorName || ''} onChange={e => setFormData({...formData, sponsorName: e.target.value})} placeholder="e.g. UPSC Mentor" />
                  <p className="text-[10px] font-medium text-slate-400 italic">Appears in the header and cards.</p>
                </div>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sponsor Footer Text</label>
                  <input type="text" className="w-full h-12 rounded-xl border-slate-200 font-bold focus:ring-violet-500 focus:border-violet-500" value={formData.sponsorText || ''} onChange={e => setFormData({...formData, sponsorText: e.target.value})} placeholder="e.g. Powered by Mentor Partner" />
                  <p className="text-[10px] font-medium text-slate-400 italic">Small text shown in the app footer.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">App Footer Text</label>
                  <input type="text" className="w-full h-12 rounded-xl border-slate-200 font-bold focus:ring-violet-500 focus:border-violet-500" value={formData.footerText || ''} onChange={e => setFormData({...formData, footerText: e.target.value})} placeholder="e.g. Built for UPSC Aspirants" />
                  <p className="text-[10px] font-medium text-slate-400 italic">General footer copyright/info text.</p>
                </div>
              </div>
            </section>

            {/* Section: Pricing */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
                <div className="p-1.5 rounded-lg bg-amber-100 text-amber-600">
                  <Zap className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Pricing Strategy</h4>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Current Price (₹)</label>
                  <input type="text" className="w-full h-12 rounded-xl border-slate-200 font-bold focus:ring-violet-500 focus:border-violet-500" value={formData.price || ''} onChange={e => setFormData({...formData, price: e.target.value})} placeholder="e.g. 999" />
                  <p className="text-[10px] font-medium text-slate-400 italic">What users pay today for full access.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Individual PDF Price (₹)</label>
                  <input type="text" className="w-full h-12 rounded-xl border-slate-200 font-bold focus:ring-violet-500 focus:border-violet-500" value={formData.pdfPrice || ''} onChange={e => setFormData({...formData, pdfPrice: e.target.value})} placeholder="e.g. 199" />
                  <p className="text-[10px] font-medium text-slate-400 italic">Price per subject PDF in the store.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Original Price (₹)</label>
                  <input type="text" className="w-full h-12 rounded-xl border-slate-200 font-bold focus:ring-violet-500 focus:border-violet-500" value={formData.originalPrice || ''} onChange={e => setFormData({...formData, originalPrice: e.target.value})} placeholder="e.g. 2,499" />
                  <p className="text-[10px] font-medium text-slate-400 italic">Shown with a strikethrough to show value.</p>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Pricing CTA Text</label>
                <input type="text" className="w-full h-12 rounded-xl border-slate-200 font-bold focus:ring-violet-500 focus:border-violet-500" value={formData.pricingText || ''} onChange={e => setFormData({...formData, pricingText: e.target.value})} placeholder="e.g. Full access at ₹999 (Limited Offer)" />
                <p className="text-[10px] font-medium text-slate-400 italic">Marketing line shown on the pricing card in the app.</p>
              </div>
            </section>

            {/* Section: Landing Page */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
                <div className="p-1.5 rounded-lg bg-blue-100 text-blue-600">
                  <LayoutDashboard className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Landing Page Content</h4>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Hero Tagline</label>
                  <textarea className="w-full rounded-xl border-slate-200 font-medium focus:ring-violet-500 focus:border-violet-500 p-6 bg-slate-50/50" rows={3} value={formData.heroTagline || ''} onChange={setFormData ? e => setFormData({...formData, heroTagline: e.target.value}) : undefined} placeholder="The main headline at the top of your app..." />
                  <p className="text-[10px] font-medium text-slate-400 italic">Keep it punchy and high-yield.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Premium CTA Button Text</label>
                  <input type="text" className="w-full h-12 rounded-xl border-slate-200 font-bold focus:ring-violet-500 focus:border-violet-500" value={formData.premiumCtaLine || ''} onChange={e => setFormData({...formData, premiumCtaLine: e.target.value})} placeholder="e.g. Unlock 100+ High-Yield Topics" />
                  <p className="text-[10px] font-medium text-slate-400 italic">The text on the main upgrade button.</p>
                </div>
              </div>
            </section>
          </Card>

          <div className="sm:hidden pt-4">
            <Button onClick={handleSave} icon={Save} loading={isSaving} className="w-full h-14 text-base shadow-lg shadow-violet-200">
              Update Global Settings
            </Button>
          </div>
        </div>

        <div className="space-y-8">
          <Card className="p-8 border-slate-200 shadow-sm bg-slate-50 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-violet-100 text-violet-600">
                <Info className="h-4 w-4" />
              </div>
              <h5 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Founder's Note</h5>
            </div>
            <p className="text-xs font-medium text-slate-500 leading-relaxed">
              These settings update your app instantly. Use the <span className="text-violet-600 font-bold tracking-tight">Pricing Strategy</span> to run limited-time offers or test different price points.
            </p>
            <div className="pt-6 border-t border-slate-200">
              <div className="flex items-center gap-3 text-emerald-600">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Live Updates Enabled</span>
              </div>
              <p className="mt-2 text-[10px] font-medium text-slate-400">
                Changes will be visible to all users as soon as you click save. No deployment required.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Dynamic coupon management removed - logic is now hardcoded for PRECALL10 in the backend


function AdminAccess({ showConfirm }: { showConfirm: any }) {
  const { user, adminEmails } = useAuth();
  const [newEmail, setNewEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailToAdd = newEmail.trim().toLowerCase();
    
    if (!emailToAdd) return;
    if (adminEmails.includes(emailToAdd)) {
      toast.error('Email is already an admin');
      return;
    }

    showConfirm(
      'Add Admin',
      `Are you sure you want to grant admin access to ${emailToAdd}?`,
      async () => {
        setIsSaving(true);
        try {
          const adminsRef = doc(db, 'settings', 'admins');
          // We only save the dynamic ones to Firestore
          const dynamicAdmins = adminEmails.filter(e => e !== 'precall.admin@gmail.com');
          await setDoc(adminsRef, {
            emails: [...dynamicAdmins, emailToAdd]
          });
          toast.success('Admin added successfully');
          setNewEmail('');
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, 'settings/admins');
          toast.error('Failed to add admin');
        } finally {
          setIsSaving(false);
        }
      }
    );
  };

  const handleRemoveAdmin = async (emailToRemove: string) => {
    if (emailToRemove === 'precall.admin@gmail.com') {
      toast.error('The founder email cannot be removed for safety.');
      return;
    }

    if (emailToRemove === user?.email?.toLowerCase()) {
      toast.error('You cannot remove yourself to avoid accidental lockout.');
      return;
    }

    showConfirm(
      'Remove Admin',
      `Are you sure you want to remove admin access for ${emailToRemove}?`,
      async () => {
        setIsSaving(true);
        try {
          const adminsRef = doc(db, 'settings', 'admins');
          const dynamicAdmins = adminEmails.filter(e => e !== 'precall.admin@gmail.com' && e !== emailToRemove);
          await setDoc(adminsRef, {
            emails: dynamicAdmins
          });
          toast.success('Admin removed successfully');
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, 'settings/admins');
          toast.error('Failed to remove admin');
        } finally {
          setIsSaving(false);
        }
      }
    );
  };

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Admin Access</h1>
        <p className="text-slate-500 font-medium mt-1">Manage who can access this control center.</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-0 border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50/50 border-b border-violet-100 px-8 py-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Approved Admin Emails</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {adminEmails.map((email) => (
                <div key={email} className="flex items-center justify-between px-8 py-5 hover:bg-slate-50/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{email}</p>
                      {email === 'precall.admin@gmail.com' ? (
                        <Badge variant="premium">Founder</Badge>
                      ) : (
                        <Badge variant="free">Admin</Badge>
                      )}
                    </div>
                  </div>
                  {email !== 'precall.admin@gmail.com' && email !== user?.email?.toLowerCase() && (
                    <button 
                      onClick={() => handleRemoveAdmin(email)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-8 border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl bg-violet-50 text-violet-600">
                <Plus className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Add New Admin</h3>
            </div>
            <form onSubmit={handleAddAdmin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Google Email Address</label>
                <input 
                  type="email" 
                  required
                  className="w-full h-12 rounded-xl border-slate-200 font-bold focus:ring-violet-500 focus:border-violet-500" 
                  placeholder="e.g. helper@gmail.com"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                />
              </div>
              <Button type="submit" loading={isSaving} className="w-full h-12 shadow-lg shadow-violet-200">
                Grant Admin Access
              </Button>
            </form>
            <div className="mt-6 p-4 rounded-2xl bg-amber-50 border border-amber-100 flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
              <p className="text-[10px] font-bold text-amber-800 leading-relaxed uppercase tracking-wider">
                Warning: Admins can edit all content and settings. Only add trusted team members.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default AdminPanel;
