import { describe, test, expect, vi, beforeEach } from 'vitest';
import AICoachingService from '../../services/aiCoaching.js';

// Mock axios for API calls
vi.mock('axios', () => ({
  default: {
    post: vi.fn()
  }
}));

describe('AICoachingService', () => {
  let aiCoach;
  
  beforeEach(() => {
    vi.clearAllMocks();
    aiCoach = new AICoachingService({
      provider: 'openai',
      apiKey: 'test-key',
      model: 'gpt-4-turbo-preview',
      slidingWindowSize: 5
    });
  });

  test('should initialize with correct config', () => {
    expect(aiCoach.provider).toBe('openai');
    expect(aiCoach.model).toBe('gpt-4-turbo-preview');
    expect(aiCoach.slidingWindowSize).toBe(5);
  });

  test('should build athlete context correctly', () => {
    const user = {
      ftp: 250,
      hrmax: 180,
      isFastTwitch: true
    };

    const context = aiCoach.buildAthleteContext(user);
    
    expect(context.role).toBe('system');
    expect(context.content).toContain('FTP: 250W');
    expect(context.content).toContain('Max Heart Rate: 180 bpm');
    expect(context.content).toContain('Fast-twitch dominant');
  });

  test('should get fast twitch description correctly', () => {
    expect(aiCoach.getFastTwitchDescription(true))
      .toBe('Fast-twitch dominant (explosive power, better at short high-intensity efforts)');
    
    expect(aiCoach.getFastTwitchDescription(false))
      .toBe('Slow-twitch dominant (endurance-oriented, better at sustained efforts)');
    
    expect(aiCoach.getFastTwitchDescription(null))
      .toBe('Unknown fiber type dominance');
  });

  test('should manage conversation history with sliding window', () => {
    const userId = 123;
    
    // Add messages beyond sliding window size
    for (let i = 0; i < 10; i++) {
      aiCoach.manageConversationHistory(userId, `message ${i}`, `response ${i}`);
    }
    
    const history = aiCoach.getConversationHistory(userId);
    expect(history.length).toBeLessThanOrEqual(aiCoach.slidingWindowSize * 2); // user + assistant messages
  });

  test('should clear conversation history', () => {
    const userId = 123;
    aiCoach.manageConversationHistory(userId, 'test message', 'test response');
    
    aiCoach.clearHistory(userId);
    
    const history = aiCoach.getConversationHistory(userId);
    expect(history.length).toBe(0);
  });

  test('should switch provider correctly', () => {
    aiCoach.switchProvider('anthropic', 'new-key', 'claude-3-opus-20240229');
    
    expect(aiCoach.provider).toBe('anthropic');
    expect(aiCoach.model).toBe('claude-3-opus-20240229');
  });

  test('should set sliding window size', () => {
    aiCoach.setSlidingWindowSize(15);
    expect(aiCoach.slidingWindowSize).toBe(15);
  });
});