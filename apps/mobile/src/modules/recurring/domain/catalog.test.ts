// Finding a merchant in the shared catalog (SCRUM-58).
import { findMerchant, forDetection, safeCancelUrl, type CatalogEntry } from './catalog';

const entry = (
  key: string,
  patterns: string[],
  over: Partial<CatalogEntry> = {},
): CatalogEntry => ({
  key,
  displayName: key,
  category: 'subscriptions',
  isSubscription: true,
  matchPatterns: patterns,
  cancelUrl: null,
  cancelSteps: [],
  ...over,
});

const catalog = [
  entry('netflix', ['netflix'], {
    displayName: 'Netflix',
    cancelUrl: 'https://www.netflix.com/cancelplan',
  }),
  entry('apple', ['apple', 'apple com bill']),
  entry('youtube premium', ['youtube']),
  entry('streaming video', ['streaming video'], { displayName: 'Streaming de video' }),
];

describe('findMerchant', () => {
  it('finds the same key first', () => {
    expect(findMerchant(catalog, 'streaming video')?.displayName).toBe('Streaming de video');
  });

  it('finds a pattern as whole words inside the key, the longest one winning', () => {
    expect(findMerchant(catalog, 'cargo netflix com')?.key).toBe('netflix');
    expect(findMerchant(catalog, 'apple com bill')?.key).toBe('apple');
    expect(findMerchant(catalog, 'google youtube')?.key).toBe('youtube premium');
  });

  it('does not match inside another word, nor without a key', () => {
    expect(findMerchant(catalog, 'pineapple store')).toBeNull();
    expect(findMerchant(catalog, null)).toBeNull();
  });
});

describe('forDetection and safeCancelUrl', () => {
  it('gives detection the name and kind, and opens only https links', () => {
    expect(forDetection(catalog[0]!)).toEqual({ displayName: 'Netflix', isSubscription: true });
    expect(forDetection(null)).toBeNull();
    expect(safeCancelUrl(catalog[0]!)).toBe('https://www.netflix.com/cancelplan');
    expect(safeCancelUrl(entry('x', [], { cancelUrl: 'javascript:alert(1)' }))).toBeNull();
    expect(safeCancelUrl(entry('x', [], { cancelUrl: 'http://example.com' }))).toBeNull();
  });
});
