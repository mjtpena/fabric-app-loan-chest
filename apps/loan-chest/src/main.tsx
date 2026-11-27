import {
  Archive,
  ClipboardCheck,
  Hand,
  Info,
  ListOrdered,
  Ruler,
  Sparkles,
} from 'lucide-react';
import { mountApp } from '@x10/shared/runtime';

import { App } from './App';
import { config } from './app.config';
import './index.css';

const ICONS = [
  <Archive key="chest" size={16} />,
  <Hand key="pull" size={16} />,
  <ClipboardCheck key="return" size={16} />,
  <Sparkles key="clean" size={16} />,
  <ListOrdered key="queue" size={16} />,
  <Ruler key="tape" size={16} />,
  <Info key="info" size={16} />,
];
const nav = config.nav.map((item, idx) => ({ ...item, icon: ICONS[idx] }));

mountApp({ ...config, nav }, <App />);
