import {
  AlertTriangle, BarChart3, Calculator, Factory, FileText, FolderOpen, HelpCircle, LayoutDashboard, Plus,
  Printer, Ruler, SearchCheck, Settings, type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Version prévue pour les modules pas encore livrés. */
  version?: string;
  description?: string;
}

export const MAIN_NAV: NavItem[] = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/etudes', label: 'Mes études', icon: FolderOpen },
  { to: '/nouvelle-etude', label: 'Nouvelle étude', icon: Plus },
];

export const MODULE_NAV: NavItem[] = [
  { to: '/dce', label: 'DCE', icon: FileText },
  { to: '/analyse', label: 'Analyse', icon: BarChart3 },
  { to: '/modules/metre', label: 'Métré', icon: Ruler, version: 'V1.4',
    description: 'Consulter les postes CFO/CFA, saisir les quantités, visualiser les écarts avec la DPGF et valider.' },
  { to: '/modules/consultations', label: 'Consultations', icon: Factory, version: 'V1.5',
    description: 'Consulter fournisseurs et sous-traitants, enregistrer les offres, relancer et comparer.' },
  { to: '/modules/chiffrage', label: 'Chiffrage', icon: Calculator, version: 'V1.6',
    description: 'Calculer déboursé sec, prix de revient et prix de vente, avec la traçabilité de chaque prix.' },
  { to: '/modules/risques', label: 'Risques', icon: AlertTriangle, version: 'V1.7',
    description: 'Recenser les risques techniques et financiers, leur impact et les actions associées.' },
  { to: '/modules/questions', label: 'Questions', icon: HelpCircle, version: 'V1.7',
    description: 'Suivre les questions posées au maître d’ouvrage, les relances et les réponses.' },
  { to: '/modules/revue', label: 'Revue de prix', icon: SearchCheck, version: 'V1.8',
    description: 'Lancer les contrôles de cohérence et afficher les anomalies avant validation.' },
  { to: '/modules/rapports', label: 'Rapports', icon: Printer, version: 'V1.10',
    description: 'Générer le rapport PDF complet, la synthèse réunion et l’export Excel du chiffrage.' },
];

export const SETTINGS_NAV: NavItem = { to: '/parametres', label: 'Paramètres', icon: Settings };
