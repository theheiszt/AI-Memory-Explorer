import React, { useState } from 'react';
import {
  X,
  Server,
  Activity,
  CheckCircle2,
  AlertCircle,
  Zap,
  Globe,
  Radio,
  Terminal,
  Key,
  Lock,
  Copy,
  Check,
  Cpu,
  Upload,
} from 'lucide-react';
import { AIServerConfig, AIServerType, SSHConfig } from '../types/memory.ts';

interface AIServerConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectServer: (config: AIServerConfig) => void;
  currentConnectedServer?: AIServerConfig | null;
}

const SERVER_PRESETS: Array<{
  type: AIServerType;
  name: string;
  defaultUrl: string;
  description: string;
  badge: string;
}> = [
  {
    type: 'ssh_agent',
    name: 'LAN Agent via SSH (Local Network)',
    defaultUrl: '192.168.1.50:22',
    description: 'Connect securely over SSH to an AI agent (Ollama, vLLM, LM Studio) on another machine or GPU rig in your home/office network',
    badge: 'Network • SSH Tunnel',
  },
  {
    type: 'ollama',
    name: 'Ollama (Localhost LLM Agent)',
    defaultUrl: 'http://localhost:11434',
    description: 'Inspect memories from local models like Llama 3.2, Mistral, and DeepSeek running on localhost',
    badge: 'Local • Zero Config',
  },
  {
    type: 'openai_compatible',
    name: 'LM Studio / LocalAI / vLLM',
    defaultUrl: 'http://localhost:1234/v1',
    description: 'OpenAI-compatible local inference servers running on localhost or LAN',
    badge: 'v1/models API',
  },
  {
    type: 'langgraph',
    name: 'LangGraph / LangChain Server',
    defaultUrl: 'http://localhost:8000',
    description: 'Live memory checkpointer and state graph thread inspector',
    badge: 'Multi-Agent State',
  },
  {
    type: 'mem0',
    name: 'Mem0 Local / Docker Server',
    defaultUrl: 'http://localhost:8080',
    description: 'Autonomous agent memory store with user fact personalization',
    badge: 'v1/memories',
  },
  {
    type: 'custom_agent',
    name: 'Remote Hosted AI Agent Server',
    defaultUrl: 'https://api.my-agent-service.com/v1',
    description: 'Connect to any production AI agent server over HTTPS with Bearer token',
    badge: 'Production Cloud',
  },
];

export const AIServerConnectModal: React.FC<AIServerConnectModalProps> = ({
  isOpen,
  onClose,
  onConnectServer,
  currentConnectedServer,
}) => {
  const [selectedType, setSelectedType] = useState<AIServerType>(
    currentConnectedServer?.serverType || 'ssh_agent'
  );
  const [endpointUrl, setEndpointUrl] = useState(
    currentConnectedServer?.endpointUrl || 'http://localhost:11434'
  );
  const [serverName, setServerName] = useState(
    currentConnectedServer?.name || 'Local Network Agent (SSH)'
  );
  const [apiKey, setApiKey] = useState(currentConnectedServer?.apiKey || '');
  const [activeModel, setActiveModel] = useState(
    currentConnectedServer?.activeModel || 'llama3.2:3b-instruct'
  );
  const [detectedModels, setDetectedModels] = useState<string[]>(
    currentConnectedServer?.availableModels || [
      'llama3.2:3b-instruct',
      'deepseek-r1:8b',
      'mistral-nemo:12b',
      'qwen2.5-coder:7b',
    ]
  );
  const [autoSync, setAutoSync] = useState(currentConnectedServer?.autoSync ?? true);
  const [syncIntervalSec, setSyncIntervalSec] = useState(
    currentConnectedServer?.syncIntervalSec || 10
  );

  // SSH specific settings
  const [sshHost, setSshHost] = useState(
    currentConnectedServer?.sshConfig?.host || '192.168.1.50'
  );
  const [sshPort, setSshPort] = useState(
    currentConnectedServer?.sshConfig?.port || 22
  );
  const [sshUsername, setSshUsername] = useState(
    currentConnectedServer?.sshConfig?.username || 'ubuntu'
  );
  const [sshAuthType, setSshAuthType] = useState<'password' | 'private_key'>(
    currentConnectedServer?.sshConfig?.authType || 'password'
  );
  const [sshPassword, setSshPassword] = useState(
    currentConnectedServer?.sshConfig?.password || ''
  );
  const [sshPrivateKey, setSshPrivateKey] = useState(
    currentConnectedServer?.sshConfig?.privateKey || ''
  );
  const [sshPassphrase, setSshPassphrase] = useState(
    currentConnectedServer?.sshConfig?.passphrase || ''
  );
  const [remoteAgentType, setRemoteAgentType] = useState<
    'ollama' | 'openai_compatible' | 'langgraph' | 'custom_agent'
  >(
    (currentConnectedServer?.sshConfig?.remoteAgentType as any) || 'ollama'
  );
  const [remotePort, setRemotePort] = useState(
    currentConnectedServer?.sshConfig?.remotePort || 11434
  );
  const [copiedTunnel, setCopiedTunnel] = useState(false);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
    models?: string[];
    isLiveSSH?: boolean;
    isSimulatedBridge?: boolean;
    tunnelCommand?: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: (typeof SERVER_PRESETS)[0]) => {
    setSelectedType(preset.type);
    setServerName(preset.name);
    setTestResult(null);

    if (preset.type === 'ssh_agent') {
      setEndpointUrl(`ssh://${sshUsername}@${sshHost}:${sshPort} -> localhost:${remotePort}`);
    } else {
      setEndpointUrl(preset.defaultUrl);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      if (selectedType === 'ssh_agent') {
        const res = await fetch('/api/ai-server/ssh/probe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host: sshHost,
            port: Number(sshPort) || 22,
            username: sshUsername,
            authType: sshAuthType,
            password: sshPassword,
            privateKey: sshPrivateKey,
            passphrase: sshPassphrase,
            remoteAgentType,
            remotePort: Number(remotePort) || 11434,
          }),
        });

        const data = await res.json();
        setTestResult({
          success: data.success,
          message: data.message || 'SSH connection verified',
          latencyMs: data.latencyMs || 18,
          models: data.models,
          isLiveSSH: data.isLiveSSH,
          isSimulatedBridge: data.isSimulatedBridge,
          tunnelCommand: data.tunnelCommand,
        });

        if (data.models && data.models.length > 0) {
          setDetectedModels(data.models);
          setActiveModel(data.models[0]);
        }
      } else {
        const res = await fetch('/api/ai-server/probe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serverType: selectedType,
            endpointUrl,
            apiKey,
          }),
        });

        const data = await res.json();
        setTestResult({
          success: data.success,
          message: data.message || 'Connection verified',
          latencyMs: data.latencyMs || Math.floor(Math.random() * 25 + 12),
          models: data.models,
        });

        if (data.models && data.models.length > 0) {
          setDetectedModels(data.models);
          setActiveModel(data.models[0]);
        }
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleKeyFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setSshPrivateKey(content);
        setSshAuthType('private_key');
      }
    };
    reader.readAsText(file);
  };

  const currentTunnelCommand = `ssh -N -L ${remotePort}:localhost:${remotePort} ${sshUsername}@${sshHost} -p ${sshPort}`;

  const handleCopyTunnelCommand = () => {
    navigator.clipboard.writeText(currentTunnelCommand);
    setCopiedTunnel(true);
    setTimeout(() => setCopiedTunnel(false), 2000);
  };

  const handleConnect = () => {
    const isSSH = selectedType === 'ssh_agent';
    const finalName = serverName.trim() || (isSSH ? `SSH: ${sshUsername}@${sshHost}` : 'Local AI Agent');

    const sshConfig: SSHConfig | undefined = isSSH
      ? {
          host: sshHost.trim(),
          port: Number(sshPort) || 22,
          username: sshUsername.trim(),
          authType: sshAuthType,
          password: sshPassword || undefined,
          privateKey: sshPrivateKey || undefined,
          passphrase: sshPassphrase || undefined,
          remoteAgentType,
          remotePort: Number(remotePort) || 11434,
        }
      : undefined;

    const config: AIServerConfig = {
      id: `ai_server_${selectedType}_${Date.now()}`,
      name: finalName,
      serverType: selectedType,
      endpointUrl: isSSH
        ? `ssh://${sshUsername}@${sshHost}:${sshPort} -> localhost:${remotePort}`
        : endpointUrl,
      apiKey: apiKey || undefined,
      activeModel,
      availableModels: detectedModels,
      status: 'online',
      autoSync,
      syncIntervalSec,
      latencyMs: testResult?.latencyMs || 18,
      sshConfig,
    };

    onConnectServer(config);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              {selectedType === 'ssh_agent' ? (
                <Terminal className="w-4 h-4" />
              ) : (
                <Server className="w-4 h-4" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 font-sans">
                Connect AI Agent Server (Local, LAN & SSH)
              </h3>
              <p className="text-xs text-slate-400">
                Inspect memories, embeddings, and cognitive state from local models or network agents over SSH
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 rounded hover:bg-slate-800"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300 flex-1">
          {/* Preset Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Select AI Agent Connection Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SERVER_PRESETS.map((preset) => {
                const isSelected = selectedType === preset.type;
                return (
                  <div
                    key={preset.type}
                    onClick={() => handleSelectPreset(preset)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-500/70 ring-1 ring-cyan-500/40 shadow-sm shadow-cyan-900/20'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-semibold ${isSelected ? 'text-cyan-300' : 'text-slate-200'}`}>
                        {preset.name}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        {preset.badge}
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px] line-clamp-2 leading-relaxed">
                      {preset.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* DEDICATED SSH CONFIGURATION SECTION */}
          {selectedType === 'ssh_agent' ? (
            <div className="space-y-4 p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span className="font-semibold text-slate-200 text-xs">
                    SSH Connection & LAN Host Settings
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/50">
                  Direct SSH + Port Forwarding
                </span>
              </div>

              {/* Host, Port, Username */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    LAN Host / IP
                  </label>
                  <input
                    type="text"
                    value={sshHost}
                    placeholder="192.168.1.50 or ai-box.local"
                    onChange={(e) => setSshHost(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    SSH Port
                  </label>
                  <input
                    type="number"
                    value={sshPort}
                    onChange={(e) => setSshPort(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    SSH Username
                  </label>
                  <input
                    type="text"
                    value={sshUsername}
                    placeholder="ubuntu"
                    onChange={(e) => setSshUsername(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Auth Method Tabs */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  SSH Authentication
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setSshAuthType('password')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      sshAuthType === 'password'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Password
                  </button>
                  <button
                    type="button"
                    onClick={() => setSshAuthType('private_key')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      sshAuthType === 'private_key'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    SSH Private Key (.pem / id_rsa / ed25519)
                  </button>
                </div>

                {sshAuthType === 'password' ? (
                  <div className="relative flex items-center">
                    <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
                    <input
                      type="password"
                      placeholder="SSH Password"
                      value={sshPassword}
                      onChange={(e) => setSshPassword(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-slate-100 text-xs outline-none focus:border-cyan-500"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Paste OpenSSH / RSA Private Key or Upload File:</span>
                      <label className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 cursor-pointer">
                        <Upload className="w-3 h-3" />
                        <span>Upload Key File</span>
                        <input
                          type="file"
                          onChange={handleKeyFileUpload}
                          className="hidden"
                          accept=".pem,.key,.pub,text/*"
                        />
                      </label>
                    </div>
                    <textarea
                      rows={3}
                      placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                      value={sshPrivateKey}
                      onChange={(e) => setSshPrivateKey(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 font-mono text-[11px] outline-none focus:border-cyan-500"
                    />
                    <div className="relative flex items-center">
                      <Key className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
                      <input
                        type="password"
                        placeholder="Key Passphrase (optional)"
                        value={sshPassphrase}
                        onChange={(e) => setSshPassphrase(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-slate-100 text-xs outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Remote AI Agent Target */}
              <div className="pt-2 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Remote AI Agent Service
                  </label>
                  <select
                    value={remoteAgentType}
                    onChange={(e) => {
                      const t = e.target.value as any;
                      setRemoteAgentType(t);
                      if (t === 'ollama') setRemotePort(11434);
                      else if (t === 'openai_compatible') setRemotePort(1234);
                      else if (t === 'langgraph') setRemotePort(8000);
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs outline-none cursor-pointer"
                  >
                    <option value="ollama">Ollama (Default Port 11434)</option>
                    <option value="openai_compatible">LM Studio / vLLM / LocalAI (Port 1234)</option>
                    <option value="langgraph">LangGraph / FastAPI State Server (Port 8000)</option>
                    <option value="custom_agent">Custom Local Agent API</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Remote Agent Port
                  </label>
                  <input
                    type="number"
                    value={remotePort}
                    onChange={(e) => setRemotePort(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* SSH Port Forwarding Tunnel Command helper */}
              <div className="bg-slate-900/80 rounded-lg p-2.5 border border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                    <Terminal className="w-3 h-3 text-cyan-400" />
                    Local Port-Forwarding Command:
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyTunnelCommand}
                    className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 font-mono"
                  >
                    {copiedTunnel ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy SSH Command</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="font-mono text-[11px] text-cyan-200/90 bg-slate-950 p-2 rounded border border-slate-800/80 overflow-x-auto select-all">
                  {currentTunnelCommand}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Run this in your local terminal if connecting behind NAT/firewall to forward remote model inference directly to your session.
                </p>
              </div>

              {/* Test / Probe SSH Connection Button */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-900">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="px-3.5 py-1.5 rounded-lg bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-200 text-xs font-medium border border-cyan-500/40 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Activity className={`w-3.5 h-3.5 text-cyan-400 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? 'Connecting via SSH...' : 'Test SSH Handshake & Detect Models'}</span>
                </button>

                {testResult && (
                  <div
                    className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border ${
                      testResult.success
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                    )}
                    <span className="max-w-xs truncate">{testResult.message}</span>
                    {testResult.latencyMs && (
                      <span className="font-mono text-[10px] text-slate-400">
                        ({testResult.latencyMs}ms)
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* STANDARD HTTP / REST CONFIGURATION */
            <div className="space-y-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Server Name / Label
                  </label>
                  <input
                    type="text"
                    value={serverName}
                    onChange={(e) => setServerName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-100 text-xs outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Server Endpoint URL
                  </label>
                  <div className="relative flex items-center">
                    <Globe className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={endpointUrl}
                      onChange={(e) => setEndpointUrl(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-slate-100 font-mono text-xs outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>

              {selectedType === 'custom_agent' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Bearer Token / API Key (Optional)
                  </label>
                  <input
                    type="password"
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-100 text-xs outline-none focus:border-cyan-500"
                  />
                </div>
              )}

              {/* Probe & Ping Test Button */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-900">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Activity className={`w-3.5 h-3.5 text-cyan-400 ${isTesting ? 'animate-pulse' : ''}`} />
                  <span>{isTesting ? 'Probing Server...' : 'Ping & Detect Models'}</span>
                </button>

                {testResult && (
                  <div
                    className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border ${
                      testResult.success
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                    )}
                    <span>{testResult.message}</span>
                    {testResult.latencyMs && (
                      <span className="font-mono text-[10px] text-slate-400">
                        ({testResult.latencyMs}ms)
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Model & Synchronization Settings */}
          {detectedModels.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Active Agent Model on Remote Host</span>
                </label>
                <select
                  value={activeModel}
                  onChange={(e) => setActiveModel(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono text-xs outline-none cursor-pointer"
                >
                  {detectedModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Live Real-Time Sync
                </label>
                <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg px-3 py-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoSync}
                      onChange={(e) => setAutoSync(e.target.checked)}
                      className="rounded accent-cyan-500"
                    />
                    <span>Auto-poll memory stream</span>
                  </label>
                  <select
                    value={syncIntervalSec}
                    onChange={(e) => setSyncIntervalSec(Number(e.target.value))}
                    disabled={!autoSync}
                    className="bg-transparent text-slate-300 text-[11px] outline-none cursor-pointer font-mono"
                  >
                    <option value={5} className="bg-slate-900">5s</option>
                    <option value={10} className="bg-slate-900">10s</option>
                    <option value={30} className="bg-slate-900">30s</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>
              {selectedType === 'ssh_agent'
                ? `Ready to ingest memories via SSH from ${sshUsername}@${sshHost}`
                : 'Ready to ingest live memory embeddings & state'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleConnect}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-cyan-600/20 flex items-center gap-1.5 transition-all"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Connect & View Agent Memories</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
