import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Folder,
  Sliders,
  Key,
  Shield,
  Trash2,
  HardDrive,
  Cpu,
  Info,
  CheckCircle2,
  AlertCircle,
  Save,
  RotateCcw,
  Heart,
  Copy,
  Check,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultAlgorithm: 'umap' | 'pca';
  onChangeDefaultAlgorithm: (algo: 'umap' | 'pca') => void;
  densityScale: number;
  onChangeDensityScale: (scale: number) => void;
  vectorTargetCount: number;
  onChangeVectorTargetCount: (count: number) => void;
  onClearCache?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  defaultAlgorithm,
  onChangeDefaultAlgorithm,
  densityScale,
  onChangeDensityScale,
  vectorTargetCount,
  onChangeVectorTargetCount,
  onClearCache,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'storage' | 'system' | 'donations'>('general');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [appPaths, setAppPaths] = useState<{ appData?: string; storage?: string; logs?: string }>({});
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isKeySaved, setIsKeySaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const isDesktop = typeof window !== 'undefined' && !!window.desktopBridge?.isDesktop;

  useEffect(() => {
    if (isOpen && isDesktop && window.desktopBridge) {
      window.desktopBridge.getAppPaths().then((paths: any) => {
        if (paths) setAppPaths(paths);
      });
      window.desktopBridge.getSystemInfo().then((info: any) => {
        if (info) setSystemInfo(info);
      });
      window.desktopBridge.getSettings().then((settings: any) => {
        if (settings?.geminiApiKey) {
          setApiKeyInput(settings.geminiApiKey);
          setIsKeySaved(true);
        }
      });
    }
  }, [isOpen, isDesktop]);

  if (!isOpen) return null;

  const handleSaveApiKey = async () => {
    if (isDesktop && window.desktopBridge) {
      await window.desktopBridge.saveSettings({
        geminiApiKey: apiKeyInput.trim(),
        defaultAlgorithm,
        densityScale,
        vectorTargetCount,
      });
      setIsKeySaved(!!apiKeyInput.trim());
      setSaveMessage('Credentials saved securely to local desktop settings.');
      setTimeout(() => setSaveMessage(null), 3000);
    } else {
      setSaveMessage('Settings updated for current session.');
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  const handleClearApiKey = async () => {
    setApiKeyInput('');
    setIsKeySaved(false);
    if (isDesktop && window.desktopBridge) {
      await window.desktopBridge.saveSettings({
        geminiApiKey: '',
        defaultAlgorithm,
        densityScale,
        vectorTargetCount,
      });
    }
    setSaveMessage('API key cleared. System will use offline local cognitive engine.');
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Application Settings</span>
                {isDesktop && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/50">
                    Windows Desktop Edition
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">Configure projections, data persistence, and cognitive engine</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-6 gap-2 text-xs font-medium">
          <button
            onClick={() => setActiveTab('general')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'general'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>General & Projections</span>
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'ai'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>AI & Cognitive Engine</span>
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'storage'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Persistence & Cache</span>
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'system'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>System Diagnostics</span>
          </button>
          <button
            onClick={() => setActiveTab('donations')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'donations'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Heart className="w-3.5 h-3.5 text-rose-400" />
            <span>Support & Donate</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-slate-300">
          {saveMessage && (
            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{saveMessage}</span>
            </div>
          )}

          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Default Dimensionality Reduction
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => onChangeDefaultAlgorithm('umap')}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      defaultAlgorithm === 'umap'
                        ? 'bg-indigo-950/40 border-indigo-500 text-indigo-200 shadow-sm'
                        : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center justify-between">
                      <span>UMAP (Nonlinear Manifold)</span>
                      {defaultAlgorithm === 'umap' && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Preserves local neighborhood clusters and semantic communities.</p>
                  </button>

                  <button
                    onClick={() => onChangeDefaultAlgorithm('pca')}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      defaultAlgorithm === 'pca'
                        ? 'bg-indigo-950/40 border-indigo-500 text-indigo-200 shadow-sm'
                        : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center justify-between">
                      <span>PCA (Principal Component Analysis)</span>
                      {defaultAlgorithm === 'pca' && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Deterministic orthogonal projection maximizing global variance.</p>
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Vector Target Density
                  </label>
                  <span className="font-mono text-xs text-indigo-400">{vectorTargetCount.toLocaleString()} nodes</span>
                </div>
                <input
                  type="range"
                  min="1000"
                  max="10000"
                  step="500"
                  value={vectorTargetCount}
                  onChange={e => onChangeVectorTargetCount(Number(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                  <span>1,000 (Fast)</span>
                  <span>5,000 (Balanced)</span>
                  <span>10,000 (Dense)</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Cluster Dispersion Scale
                  </label>
                  <span className="font-mono text-xs text-indigo-400">{densityScale.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={densityScale}
                  onChange={e => onChangeDensityScale(Number(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                  <span>0.5x (Compact)</span>
                  <span>1.0x (Standard)</span>
                  <span>2.0x (Dispersed)</span>
                </div>
              </div>
            </div>
          )}

          {/* AI & Cognitive Tab */}
          {activeTab === 'ai' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  <span>Cognitive Audit Provider Policy</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  AI Memory Explorer supports both cloud reasoning models via Gemini and an automatic <strong>Offline Local Cognitive Reasoning Engine</strong>. When no cloud API key is configured or the network is disconnected, cognitive reflection and contradiction audits run completely on-device without data transmission.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Google Gemini API Key (Optional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={e => setApiKeyInput(e.target.value)}
                    placeholder="AIzaSy..."
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={handleSaveApiKey}
                    className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                  {isKeySaved && (
                    <button
                      onClick={handleClearApiKey}
                      className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-300 hover:text-rose-300 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
                      title="Clear stored key and revert to local engine"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Keys are stored exclusively in your local user data directory and never logged or exported.
                </p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/40 border border-slate-800">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isKeySaved ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                  <span className="text-xs font-medium text-slate-300">
                    Active Reasoning Mode:
                  </span>
                </div>
                <span className="text-xs font-mono text-cyan-300">
                  {isKeySaved ? 'Gemini 4 Argon / High Thinking' : 'Local Offline Cognitive Engine'}
                </span>
              </div>
            </div>
          )}

          {/* Storage & Persistence Tab */}
          {activeTab === 'storage' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Application Data Directory
                </label>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-400 break-all select-all flex items-center justify-between gap-2">
                  <span>{appPaths.storage || '%APPDATA%\\AI Memory Explorer\\storage'}</span>
                  <Folder className="w-4 h-4 text-slate-500 flex-shrink-0" />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Stores imported sources, snapshot diffs, and settings across application sessions.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Diagnostic Logs Directory
                </label>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-400 break-all select-all flex items-center justify-between gap-2">
                  <span>{appPaths.logs || '%APPDATA%\\AI Memory Explorer\\logs'}</span>
                  <Folder className="w-4 h-4 text-slate-500 flex-shrink-0" />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">Clear Cache & Temporary Embeddings</h4>
                  <p className="text-[11px] text-slate-500">Resets memory cache and forces fresh projection recomputation.</p>
                </div>
                <button
                  onClick={() => {
                    if (onClearCache) onClearCache();
                    setSaveMessage('Memory cache cleared.');
                    setTimeout(() => setSaveMessage(null), 3000);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear Cache</span>
                </button>
              </div>
            </div>
          )}

          {/* System Diagnostics Tab */}
          {activeTab === 'system' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="text-slate-500 text-[10px] uppercase font-mono">Application</div>
                  <div className="font-semibold text-slate-200 mt-0.5">AI Memory Explorer v1.0.0</div>
                  <div className="text-slate-400 text-[11px] mt-1 font-mono">Windows Desktop Shell</div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="text-slate-500 text-[10px] uppercase font-mono">Electron & Chromium</div>
                  <div className="font-semibold text-slate-200 mt-0.5">
                    {systemInfo?.electronVersion ? `Electron ${systemInfo.electronVersion}` : 'Electron 44.9.0'}
                  </div>
                  <div className="text-slate-400 text-[11px] mt-1 font-mono">
                    {systemInfo?.chromeVersion ? `Chrome ${systemInfo.chromeVersion}` : 'Chromium 134'}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="text-slate-500 text-[10px] uppercase font-mono">Operating System</div>
                  <div className="font-semibold text-slate-200 mt-0.5">
                    {systemInfo?.platform ? `${systemInfo.platform.toUpperCase()} (${systemInfo.arch})` : 'Windows x64'}
                  </div>
                  <div className="text-slate-400 text-[11px] mt-1 font-mono">
                    {systemInfo?.cpuCount ? `${systemInfo.cpuCount} Cores detected` : 'Multi-core x64'}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="text-slate-500 text-[10px] uppercase font-mono">System Memory</div>
                  <div className="font-semibold text-slate-200 mt-0.5">
                    {systemInfo?.totalMemoryMb ? `${(systemInfo.totalMemoryMb / 1024).toFixed(1)} GB Total RAM` : 'Host Memory'}
                  </div>
                  <div className="text-slate-400 text-[11px] mt-1 font-mono">
                    {systemInfo?.freeMemoryMb ? `${(systemInfo.freeMemoryMb / 1024).toFixed(1)} GB Available` : 'Available'}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800 space-y-1.5 text-xs text-slate-400">
                <div className="flex items-center gap-1.5 text-indigo-400 font-semibold">
                  <Info className="w-3.5 h-3.5" />
                  <span>Security & Isolation Status</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1">
                  <div>Context Isolation: <span className="text-emerald-400 font-bold">ACTIVE</span></div>
                  <div>Node Integration: <span className="text-emerald-400 font-bold">DISABLED</span></div>
                  <div>Sandbox Bridge: <span className="text-emerald-400 font-bold">SECURE</span></div>
                  <div>Source Operations: <span className="text-emerald-400 font-bold">READ-ONLY</span></div>
                </div>
              </div>
            </div>
          )}

          {/* Support & Donations Tab */}
          {activeTab === 'donations' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-950/60 via-slate-900 to-purple-950/40 border border-indigo-500/30">
                <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                  <Heart className="w-4 h-4 fill-rose-400" />
                  <span>Support Open-Source Development</span>
                </div>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  AI Memory Explorer is an open-source, provider-independent project. If you find this software helpful for your research, AI agent orchestration, or memory auditing, donations are deeply appreciated!
                </p>
              </div>

              <div className="space-y-3">
                {/* Bitcoin */}
                <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-amber-500/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span className="font-semibold text-slate-100 text-xs">Bitcoin (BTC)</span>
                      <span className="text-[10px] text-slate-500 font-mono">Native SegWit</span>
                    </div>
                    <button
                      onClick={() => handleCopy('btc', 'bc1q3nvq2wa44c2uxd35lfk79w04g8apw3285pts7t')}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 transition-colors border border-slate-700"
                    >
                      {copiedKey === 'btc' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-medium">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>Copy Address</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="mt-2 font-mono text-[11px] text-amber-300/90 bg-slate-900/90 p-2 rounded border border-slate-800/80 select-all break-all">
                    bc1q3nvq2wa44c2uxd35lfk79w04g8apw3285pts7t
                  </div>
                </div>

                {/* Ethereum */}
                <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-indigo-500/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                      <span className="font-semibold text-slate-100 text-xs">Ethereum (ETH)</span>
                      <span className="text-[10px] text-slate-500 font-mono">ERC-20 / EVM</span>
                    </div>
                    <button
                      onClick={() => handleCopy('eth', '0x023412b3ace6deA537feA0ca5888ccfB5250b3Ba')}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 transition-colors border border-slate-700"
                    >
                      {copiedKey === 'eth' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-medium">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>Copy Address</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="mt-2 font-mono text-[11px] text-indigo-300/90 bg-slate-900/90 p-2 rounded border border-slate-800/80 select-all break-all">
                    0x023412b3ace6deA537feA0ca5888ccfB5250b3Ba
                  </div>
                </div>

                {/* Solana */}
                <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-cyan-500/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                      <span className="font-semibold text-slate-100 text-xs">Solana (SOL)</span>
                      <span className="text-[10px] text-slate-500 font-mono">SPL Network</span>
                    </div>
                    <button
                      onClick={() => handleCopy('sol', 'BU5zBur46YjnCaY34XGBTJ8KSAG9EExjpZA58wDo7wAx')}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 transition-colors border border-slate-700"
                    >
                      {copiedKey === 'sol' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-medium">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>Copy Address</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="mt-2 font-mono text-[11px] text-cyan-300/90 bg-slate-900/90 p-2 rounded border border-slate-800/80 select-all break-all">
                    BU5zBur46YjnCaY34XGBTJ8KSAG9EExjpZA58wDo7wAx
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-mono">
            {isDesktop ? 'Desktop Mode: Loopback 127.0.0.1' : 'Web Mode'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
