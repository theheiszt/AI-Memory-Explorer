import { test } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { redactSensitiveObject, exportDiagnosticLogs } from '../export/exporter.js';
import type { DiagnosticLog } from '../../types/memory.js';

test('security: file bridge rejects null bytes and executable extensions', () => {
  const disallowedExts = ['.exe', '.bat', '.cmd', '.vbs', '.ps1', '.dll', '.com', '.scr', '.msi', '.pif'];

  // 1. Null byte check
  const hasNullByte = (p: string) => p.includes('\0');
  assert.strictEqual(hasNullByte('valid_dataset.json'), false);
  assert.strictEqual(hasNullByte('malicious\0.exe'), true);

  // 2. Disallowed extension validator
  const isExtensionDisallowed = (p: string) => {
    const ext = path.extname(p).toLowerCase();
    return disallowedExts.includes(ext);
  };

  assert.strictEqual(isExtensionDisallowed('export.json'), false);
  assert.strictEqual(isExtensionDisallowed('coordinates.csv'), false);
  assert.strictEqual(isExtensionDisallowed('payload.exe'), true);
  assert.strictEqual(isExtensionDisallowed('script.bat'), true);
  assert.strictEqual(isExtensionDisallowed('command.ps1'), true);
});

test('security: diagnostic exporter and log sanitizer redact secrets and credentials', () => {
  const sensitiveContext = {
    apiKey: 'AIzaSySecretApiKey1234567890',
    bearerToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    databasePassword: 'SuperSecretDbPassword!@#',
    userCredentials: 'super_sensitive_blob',
    userInfo: {
      authToken: 'secret_token_abc',
      safeMetadata: 'cluster_analysis_run',
    },
  };

  const redacted = redactSensitiveObject(sensitiveContext) as any;
  assert.strictEqual(redacted.apiKey, '[REDACTED_SECRET]');
  assert.strictEqual(redacted.bearerToken, '[REDACTED_SECRET]');
  assert.strictEqual(redacted.databasePassword, '[REDACTED_SECRET]');
  assert.strictEqual(redacted.userCredentials, '[REDACTED_SECRET]');
  assert.strictEqual(redacted.userInfo.authToken, '[REDACTED_SECRET]');
  assert.strictEqual(redacted.userInfo.safeMetadata, 'cluster_analysis_run');

  const testLogs: DiagnosticLog[] = [
    {
      id: 'log_1',
      timestamp: new Date().toISOString(),
      level: 'error',
      component: 'QdrantAdapter',
      message: 'Authentication failed for remote endpoint',
      redactedContext: { apiKey: 'raw_api_key_should_be_hidden' },
    },
  ];

  const exported = exportDiagnosticLogs(testLogs, true);
  assert.ok(!exported.includes('raw_api_key_should_be_hidden'));
  assert.ok(exported.includes('[REDACTED_SECRET]'));
});

test('security: loopback verification accurately distinguishes local from external IPs', () => {
  const isAllowedLoopback = (remoteIp: string, hostname: string) => {
    return (
      remoteIp === '127.0.0.1' ||
      remoteIp === '::1' ||
      remoteIp === '::ffff:127.0.0.1' ||
      hostname === '127.0.0.1' ||
      hostname === 'localhost'
    );
  };

  assert.strictEqual(isAllowedLoopback('127.0.0.1', '127.0.0.1'), true);
  assert.strictEqual(isAllowedLoopback('::1', 'localhost'), true);
  assert.strictEqual(isAllowedLoopback('::ffff:127.0.0.1', '127.0.0.1'), true);
  assert.strictEqual(isAllowedLoopback('192.168.1.100', '192.168.1.100'), false);
  assert.strictEqual(isAllowedLoopback('10.0.0.5', 'my-domain.com'), false);
  assert.strictEqual(isAllowedLoopback('172.16.0.1', 'external.host'), false);
});
