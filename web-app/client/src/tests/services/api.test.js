import { describe, test, expect, vi, beforeEach } from 'vitest';
import * as api from '../../services/api';

// Mock axios
const mockAxios = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  create: vi.fn(() => mockAxios)
};

vi.mock('axios', () => ({
  default: mockAxios
}));

describe('API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset axios create mock
    mockAxios.create.mockReturnValue(mockAxios);
  });

  test('getCurrentUser should make GET request to /api/user', async () => {
    const mockUser = {
      id: 1,
      firstname: 'Test',
      lastname: 'User',
      ftp: 250,
      hrmax: 180
    };

    mockAxios.get.mockResolvedValue({ data: mockUser });

    const result = await api.getCurrentUser();

    expect(mockAxios.get).toHaveBeenCalledWith('/api/user');
    expect(result).toEqual(mockUser);
  });

  test('updateSettings should make PUT request with correct data', async () => {
    const settings = { ftp: 275, hrmax: 185, isFastTwitch: true };
    const mockResponse = { success: true, user: { ...settings, id: 1 } };

    mockAxios.put.mockResolvedValue({ data: mockResponse });

    const result = await api.updateSettings(settings);

    expect(mockAxios.put).toHaveBeenCalledWith('/api/settings', settings);
    expect(result).toEqual(mockResponse);
  });

  test('sendCoachingMessage should make POST request to coaching endpoint', async () => {
    const messageData = { 
      message: 'Analyze my workout',
      includeRecentData: true
    };
    const mockResponse = { response: 'Great workout analysis...' };

    mockAxios.post.mockResolvedValue({ data: mockResponse });

    const result = await api.sendCoachingMessage(messageData);

    expect(mockAxios.post).toHaveBeenCalledWith('/api/coach/message', messageData);
    expect(result).toEqual(mockResponse);
  });

  test('analyzeActivities should make POST request with activities data', async () => {
    const activitiesData = { 
      startDate: '2023-01-01',
      endDate: '2023-01-07'
    };
    const mockResponse = { analysisComplete: true };

    mockAxios.post.mockResolvedValue({ data: mockResponse });

    const result = await api.analyzeActivities(activitiesData);

    expect(mockAxios.post).toHaveBeenCalledWith('/api/analyze', activitiesData);
    expect(result).toEqual(mockResponse);
  });

  test('saveGoals should make POST request with goal data', async () => {
    const goalData = {
      type: 'weekly',
      content: 'Ride 100km this week'
    };
    const mockResponse = { id: 1, ...goalData };

    mockAxios.post.mockResolvedValue({ data: mockResponse });

    const result = await api.saveGoals(goalData);

    expect(mockAxios.post).toHaveBeenCalledWith('/api/goals', goalData);
    expect(result).toEqual(mockResponse);
  });

  test('should handle API errors gracefully', async () => {
    const mockError = new Error('Network error');
    mockAxios.get.mockRejectedValue(mockError);

    await expect(api.getCurrentUser()).rejects.toThrow('Network error');
  });
});