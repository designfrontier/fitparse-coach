import { describe, test, expect, beforeEach } from 'vitest';

describe('Prisma Database Operations', () => {
  let testUser;

  beforeEach(async () => {
    // Clean slate for each test
  });

  test('should create and retrieve a user', async () => {
    const userData = {
      stravaId: 98765,
      firstname: 'Jane',
      lastname: 'Doe',
      ftp: 280,
      hrmax: 175,
      isFastTwitch: false
    };

    // Create user
    const createdUser = await global.prisma.user.create({
      data: userData
    });

    expect(createdUser.id).toBeDefined();
    expect(createdUser.stravaId).toBe(userData.stravaId);
    expect(createdUser.firstname).toBe(userData.firstname);
    expect(createdUser.ftp).toBe(userData.ftp);
    expect(createdUser.isFastTwitch).toBe(userData.isFastTwitch);

    // Retrieve user
    const retrievedUser = await global.prisma.user.findUnique({
      where: { id: createdUser.id }
    });

    expect(retrievedUser).toEqual(createdUser);
  });

  test('should update user settings', async () => {
    // Create initial user
    const user = await global.prisma.user.create({
      data: {
        stravaId: 54321,
        firstname: 'Update',
        lastname: 'Test',
        ftp: 250,
        hrmax: 180
      }
    });

    // Update user
    const updatedUser = await global.prisma.user.update({
      where: { id: user.id },
      data: {
        ftp: 300,
        hrmax: 185,
        isFastTwitch: true
      }
    });

    expect(updatedUser.ftp).toBe(300);
    expect(updatedUser.hrmax).toBe(185);
    expect(updatedUser.isFastTwitch).toBe(true);
  });

  test('should create and retrieve goals', async () => {
    // Create user first
    const user = await global.prisma.user.create({
      data: {
        stravaId: 11111,
        firstname: 'Goal',
        lastname: 'Tester'
      }
    });

    // Create goal
    const goal = await global.prisma.goal.create({
      data: {
        userId: user.id,
        type: 'weekly',
        isActive: true,
        content: JSON.stringify({ target: 'Ride 100km this week' })
      }
    });

    expect(goal.userId).toBe(user.id);
    expect(goal.type).toBe('weekly');
    expect(goal.isActive).toBe(true);

    // Retrieve goals for user
    const userGoals = await global.prisma.goal.findMany({
      where: { userId: user.id }
    });

    expect(userGoals.length).toBe(1);
    expect(userGoals[0].id).toBe(goal.id);
  });

  test('should handle config operations', async () => {
    // Create config
    const config = await global.prisma.config.create({
      data: {
        key: 'TEST_KEY',
        value: 'test_value'
      }
    });

    expect(config.key).toBe('TEST_KEY');
    expect(config.value).toBe('test_value');

    // Retrieve config
    const retrievedConfig = await global.prisma.config.findUnique({
      where: { key: 'TEST_KEY' }
    });

    expect(retrievedConfig).toEqual(config);

    // Update config
    const updatedConfig = await global.prisma.config.update({
      where: { key: 'TEST_KEY' },
      data: { value: 'updated_value' }
    });

    expect(updatedConfig.value).toBe('updated_value');
  });
});