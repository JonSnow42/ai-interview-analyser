import { isApiKeyConfigured } from '../llmClient.js';

describe('llmClient Config Tests', () => {
  it('should check if isApiKeyConfigured returns a boolean value', () => {
    const isConfigured = isApiKeyConfigured();
    expect(typeof isConfigured).toBe('boolean');
  });
});
