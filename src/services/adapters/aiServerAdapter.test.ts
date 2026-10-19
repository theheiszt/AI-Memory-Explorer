import test from 'node:test';
import assert from 'node:assert/strict';
import { AIServerAdapter } from './aiServerAdapter.ts';
import type { AIServerConfig } from '../../types/memory.ts';

test('AIServerAdapter: initializes and provides capabilities', () => {
  const config: AIServerConfig = {
    id: 'local_ollama_1',
    name: 'Local Ollama Instance',
    serverType: 'ollama',
    endpointUrl: 'http://localhost:11434',
    status: 'online',
    autoSync: false,
    syncIntervalSec: 10,
    activeModel: 'llama3.2',
  };

  const adapter = new AIServerAdapter(config);
  assert.equal(adapter.id, 'local_ollama_1');
  assert.equal(adapter.name, 'Local Ollama Instance');

  const caps = adapter.getCapabilities();
  assert.equal(caps.hasEmbeddings, true);
  assert.equal(caps.supportsRealtimeSync, true);
  assert.equal(caps.embeddingModel, 'llama3.2');
});

test('AIServerAdapter: supports LAN agent connection over SSH', () => {
  const sshConfig: AIServerConfig = {
    id: 'ssh_lan_agent_1',
    name: 'Homelab GPU Agent (SSH)',
    serverType: 'ssh_agent',
    endpointUrl: 'ssh://ubuntu@192.168.1.50:22 -> localhost:11434',
    status: 'online',
    autoSync: true,
    syncIntervalSec: 10,
    activeModel: 'llama3.2:3b-instruct',
    sshConfig: {
      host: '192.168.1.50',
      port: 22,
      username: 'ubuntu',
      authType: 'password',
      remoteAgentType: 'ollama',
      remotePort: 11434,
    },
  };

  const adapter = new AIServerAdapter(sshConfig);
  assert.equal(adapter.id, 'ssh_lan_agent_1');
  assert.equal(adapter.name, 'Homelab GPU Agent (SSH)');
  assert.equal(adapter.config.serverType, 'ssh_agent');
  assert.equal(adapter.config.sshConfig?.host, '192.168.1.50');
  assert.equal(adapter.config.sshConfig?.remotePort, 11434);

  const caps = adapter.getCapabilities();
  assert.equal(caps.hasEmbeddings, true);
  assert.equal(caps.embeddingModel, 'llama3.2:3b-instruct');
});
