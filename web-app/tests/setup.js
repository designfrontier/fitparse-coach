import { beforeAll, afterAll, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import fs from 'fs';

// Set test database URL
const testDbUrl = 'file:./test.db';
process.env.DATABASE_URL = testDbUrl;

// Create a test database instance
const prisma = new PrismaClient();

// Make prisma available globally for tests
global.prisma = prisma;

beforeAll(async () => {
  // Remove existing test database
  if (fs.existsSync('./test.db')) {
    fs.unlinkSync('./test.db');
  }
  
  // Apply migrations to create test database
  execSync('npx prisma migrate deploy', { 
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: testDbUrl }
  });
  
  // Generate Prisma client
  execSync('npx prisma generate');
});

afterEach(async () => {
  // Clean up test data after each test
  try {
    await prisma.goal.deleteMany();
    await prisma.activityCache.deleteMany();  
    await prisma.user.deleteMany();
    await prisma.config.deleteMany();
  } catch (error) {
    // Ignore errors during cleanup
  }
});

afterAll(async () => {
  // Cleanup
  await prisma.$disconnect();
  
  // Remove test database
  if (fs.existsSync('./test.db')) {
    fs.unlinkSync('./test.db');
  }
});