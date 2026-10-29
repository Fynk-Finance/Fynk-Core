// Recomendaciones: numbers from M10, text from the model only by factKey, actions, filters and
// the disclaimer in every render path (HU-024, HU-025, HU-026).
import { act, fireEvent, screen } from '@testing-library/react-native';

import { ApiError } from '@shared/api';
import { createFixedClock, createInMemoryVault } from '@shared/testing';
import { snapshotDataRange } from '@modules/analytics';

import { recommendationsMigrations } from '../adapters/vault/migrations';
import { createVaultRecommendationsStore } from '../adapters/vault/store';
import { setRecommendationsService } from '../application/hooks';
import type { RecommendationsApiPort } from '../application/ports';
import { createRecommendationsService } from '../application/recommendationsService';
import type { ModelTexts } from '../domain/steps';
import { designReport } from '../testing/designReport';
import { renderScreens, RouteProbe } from '../testing/renderScreen';
import { createRecommendationsScreen, defaultNavigation } from './RecommendationsScreen';
import { recommendationsStrings as s } from './strings.es-CO';

const texts: ModelTexts = {
  summary: 'Este mes recibiste $5.580.000 y tus gastos fijos son $1.930.600.',
  steps: [
    {
      factKey: 'category_increase.restaurants',
      title: 'Restaurantes',
      text: 'Este mes llevas un 30 % más que el anterior. Fija un tope semanal.',
    },
  ],
  fallback: false,
  modelId: 'amazon.nova-lite-v1:0',
  promptVersion: '2026-10-28.1',
  snapshotHash: 'h',
  generatedAt: '2026-10-28T17:00:00Z',
};

const Recommendations = createRecommendationsScreen({
  ...defaultNavigation,
  useDisplayName: () => 'Laura Gómez',
});

const screens = {
  Recomendaciones: Recommendations,
  'analytics.CapForm': RouteProbe,
  'savings.Goals': RouteProbe,
  Billetera: RouteProbe,
};

async function install(create: RecommendationsApiPort['create'] = async () => texts) {
  const vault = await createInMemoryVault();
  vault.registerMigrations('recommendations', recommendationsMigrations);
  await vault.migrate();
  const api = { create: jest.fn(create) };
  const store = createVaultRecommendationsStore(() => vault.db);
  const service = createRecommendationsService({
    analytics: { getReport: async () => designReport() },
    api,
    store,
    clock: createFixedClock('2026-10-28T17:00:00Z'),
    dataRange: snapshotDataRange,
  });
  setRecommendationsService(service);
  return { api, service };
}

afterEach(async () => {
  await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
  setRecommendationsService(null);
});

it('shows the design numbers from M10 and the model text by factKey', async () => {
  await install();
  await renderScreens({ screens, initial: 'Recomendaciones' });
  expect(await screen.findByText(texts.summary)).toBeOnTheScreen();
  expect(screen.getByText('Cancela 2 suscripciones que casi no usas')).toBeOnTheScreen();
  expect(screen.getByTestId('recommendations.total')).toHaveTextContent('$101.800');
  expect(screen.getByText('Podrías ahorrar en 2 frentes')).toBeOnTheScreen();
  expect(screen.getByText('Ahorra $45.000 al mes')).toBeOnTheScreen();
  expect(screen.getByText('Hasta $56.800 al mes')).toBeOnTheScreen();
  expect(screen.getByText('Meta 2 meses antes')).toBeOnTheScreen();
  expect(screen.getByText(texts.steps[0]!.text)).toBeOnTheScreen();
  // Subscriptions has no model text: fixed template.
  expect(
    screen.getByText('Tienes 4 activas por $112.600 al mes. Revisa cuáles usas.'),
  ).toBeOnTheScreen();
  expect(screen.getByText('3 sugerencias')).toBeOnTheScreen();
  expect(screen.getByTestId('recommendations.basedOn')).toHaveTextContent(
    'Basado en tus movimientos del 1 nov 2025 al 28 oct 2026. Texto redactado con IA a partir de tus cifras.',
  );
  expect(screen.getByTestId('recommendations.disclaimer')).toHaveTextContent(s.disclaimer);
  expect(screen.queryByText(/Ver plan|Transporte/)).toBeNull();
});

it('"Fijar tope" opens the cap form with the category and the suggested amount', async () => {
  await install();
  await renderScreens({ screens, initial: 'Recomendaciones' });
  fireEvent.press(
    await screen.findByTestId('recommendations.action.category_increase.restaurants'),
  );
  expect(await screen.findByTestId('probe.route')).toHaveTextContent(
    'analytics.CapForm {"categoryId":"restaurants","suggestedMinor":15000000}',
  );
});

it('"Programar" opens the goal reminder and "Revisar" the subscriptions', async () => {
  await install();
  await renderScreens({ screens, initial: 'Recomendaciones' });
  fireEvent.press(await screen.findByTestId('recommendations.action.payday_contribution'));
  expect(await screen.findByTestId('probe.route')).toHaveTextContent(
    'savings.Goals {"goalId":"goal-cartagena","paydayAmountMinor":30000000}',
  );
});

it('filters the steps by Gastos', async () => {
  await install();
  await renderScreens({ screens, initial: 'Recomendaciones' });
  await screen.findByText(texts.summary);
  fireEvent.press(screen.getByTestId('recommendations.filter.expenses'));
  expect(await screen.findByText('1 sugerencia')).toBeOnTheScreen();
  expect(screen.queryByTestId('recommendations.step.subscriptions.low_use')).toBeNull();
});

it('keeps numbers, templates and the disclaimer when the backend answers fallback', async () => {
  await install(async () => ({ ...texts, fallback: true }));
  await renderScreens({ screens, initial: 'Recomendaciones' });
  expect(
    await screen.findByText('Podrías ahorrar hasta $101.800 al mes en 2 frentes.'),
  ).toBeOnTheScreen();
  expect(screen.getByTestId('recommendations.disclaimer')).toBeOnTheScreen();
});

it('keeps numbers and the disclaimer offline, in dark', async () => {
  await install(async () => {
    throw ApiError.network();
  });
  await renderScreens({ screens, initial: 'Recomendaciones', preference: 'dark' });
  expect(await screen.findByTestId('recommendations.notice')).toHaveTextContent(s.offline);
  expect(screen.getByText('Ahorra $45.000 al mes')).toBeOnTheScreen();
  expect(screen.getByTestId('recommendations.disclaimer')).toBeOnTheScreen();
});

it('shows the disclaimer even before the module is configured', async () => {
  await renderScreens({ screens, initial: 'Recomendaciones' });
  expect(await screen.findByText(s.empty)).toBeOnTheScreen();
  expect(screen.getByTestId('recommendations.disclaimer')).toHaveTextContent(s.disclaimer);
});
