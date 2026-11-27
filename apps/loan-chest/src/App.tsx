import { Route, Routes } from 'react-router-dom';

import { AboutPage } from './pages/AboutPage';
import { CleaningRotaPage } from './pages/CleaningRotaPage';
import { DrawerPullPage } from './pages/DrawerPullPage';
import { HomePage } from './pages/HomePage';
import { MeasuringTapePage } from './pages/MeasuringTapePage';
import { ReturnSlipPage } from './pages/ReturnSlipPage';
import { WaitingListPage } from './pages/WaitingListPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/drawer-pull" element={<DrawerPullPage />} />
      <Route path="/return-slip" element={<ReturnSlipPage />} />
      <Route path="/cleaning-rota" element={<CleaningRotaPage />} />
      <Route path="/waiting-list" element={<WaitingListPage />} />
      <Route path="/measuring-tape" element={<MeasuringTapePage />} />
      <Route path="/about" element={<AboutPage />} />
    </Routes>
  );
}
