import {
  AlertTriangle, BadgeCheck, BarChart3, Building2, Calculator, Factory, FileText, FolderOpen, HelpCircle, LayoutDashboard, Plus,
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
  { to: '/metre', label: 'Métré', icon: Ruler },
  { to: '/consultations', label: 'Consultations', icon: Factory },
  { to: '/fournisseurs', label: 'Fournisseurs', icon: Building2 },
  { to: '/chiffrage', label: 'Chiffrage', icon: Calculator },
  { to: '/risques', label: 'Risques', icon: AlertTriangle },
  { to: '/questions', label: 'Questions', icon: HelpCircle },
  { to: '/revue', label: 'Revue de prix', icon: SearchCheck },
  { to: '/validation', label: 'Validation', icon: BadgeCheck },
  { to: '/modules/rapports', label: 'Rapports', icon: Printer, version: 'V1.10',
    description: 'Générer le rapport PDF complet, la synthèse réunion et l’export Excel du chiffrage.' },
];

export const SETTINGS_NAV: NavItem = { to: '/parametres', label: 'Paramètres', icon: Settings };
