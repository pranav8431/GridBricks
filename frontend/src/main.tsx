import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import 'dayjs/locale/en-gb';
import './styles.css';

import { MantineProvider } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import { createQueryClient } from './api/queries';
import { App } from './App';
import { theme } from './theme';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

createRoot(container).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light">
      <DatesProvider settings={{ locale: 'en-gb', firstDayOfWeek: 1 }}>
        <QueryClientProvider client={createQueryClient()}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </DatesProvider>
    </MantineProvider>
  </StrictMode>,
);
