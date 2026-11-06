import { defineConfig } from 'vitest/config';

// Integration tests run against a real MySQL (the transactional and locking
// behaviour is the point of this codebase - a mock would test nothing).
// Point them at any server with DB_HOST/DB_PORT/DB_USER/DB_PASSWORD; they use
// their own database, erp_test, which is dropped and recreated per run.
const env = {
  NODE_ENV: 'test',
  DB_HOST: process.env.DB_HOST || '127.0.0.1',
  DB_PORT: process.env.DB_PORT || '3306',
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD ?? '',
  DB_NAME: process.env.TEST_DB_NAME || 'erp_test',
  JWT_SECRET: 'test-secret-not-for-production',
  AWS_REGION: '',
  S3_BUCKET_NAME: '',
};
Object.assign(process.env, env); // visible to globalSetup in this process too

export default defineConfig({
  test: {
    env,
    globalSetup: './test/globalSetup.js',
    fileParallelism: false, // files share one database
    testTimeout: 15000,
  },
});
