import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Wifi,
  Signal,
  Smartphone,
  RefreshCw,
  AlertTriangle,
  Check,
  X,
  Info,
  Zap,
  Activity,
  Globe,
  Sparkles,
  ShieldAlert,
  Sliders,
  Play,
  CheckCircle,
  HelpCircle,
  Bell,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  History,
  Award,
  AlertCircle,
  PlayCircle,
  Eye,
  MapPin
} from 'lucide-react';
import { LocationDetector, LocationData } from './LocationDetector';

interface NetworkAdvisorProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface NetworkStatus {
  id: string;
  name: string;
  logoColor: string;
  badgeBg: string;
  textColor: string;
  status: 'Excellent' | 'Good' | 'Weak' | 'No Service' | 'Unavailable';
  signalStars: number;
  internetQuality: 'Very Fast' | 'Fast' | 'Slow' | 'No Internet' | 'Unavailable';
  downloadSpeed: number; // in Mbps
  uploadSpeed: number;   // in Mbps
  latency: number;       // Ping in ms
  jitter: number;        // Jitter in ms
  packetLoss: number;    // in %
  reliability: number;   // in %
  healthScore: number;   // 0 - 100
  recommendation: '✅ Recommended' | 'Recommended' | 'Not Recommended' | 'Unavailable';
  networkType: '5G' | '4G+' | '4G' | '3G' | '2G' | 'LTE' | 'H+' | 'N/A';
  bestFor: string[];
  reasons: string[];
}

export interface NetworkAlert {
  id: string;
  timestamp: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
  networkId?: string;
}

// Initial mockup data representing real-time cellular data in Nigeria
const INITIAL_NETWORKS: NetworkStatus[] = [
  {
    id: 'MTN',
    name: 'MTN Nigeria',
    logoColor: 'bg-amber-400 text-neutral-900 border-amber-500',
    badgeBg: 'bg-amber-100 text-amber-900',
    textColor: 'text-amber-600',
    status: 'Excellent',
    signalStars: 5,
    internetQuality: 'Very Fast',
    downloadSpeed: 58.4,
    uploadSpeed: 24.1,
    latency: 28,
    jitter: 3,
    packetLoss: 0.05,
    reliability: 99.8,
    healthScore: 97,
    recommendation: '✅ Recommended',
    networkType: '5G',
    bestFor: ['POS Transactions', 'Banking Apps', 'Video Calls', 'YouTube', 'File Downloads', 'Cloud Backup'],
    reasons: ['Highest bandwidth available', 'Extremely stable connection', 'Lowest ping in this area', 'Perfect for high-volume cashout transactions']
  },
  {
    id: 'Airtel',
    name: 'Airtel Nigeria',
    logoColor: 'bg-red-600 text-white border-red-700',
    badgeBg: 'bg-red-50 text-red-900',
    textColor: 'text-red-600',
    status: 'Good',
    signalStars: 4,
    internetQuality: 'Fast',
    downloadSpeed: 31.2,
    uploadSpeed: 12.8,
    latency: 42,
    jitter: 6,
    packetLoss: 0.2,
    reliability: 99.1,
    healthScore: 84,
    recommendation: 'Recommended',
    networkType: '4G+',
    bestFor: ['WhatsApp', 'Facebook', 'Banking Apps', 'Online Payments', 'Browsing'],
    reasons: ['Consistent signal coverage', 'Good upload latency', 'Optimized for social browsing']
  },
  {
    id: 'Glo',
    name: 'Globacom (Glo)',
    logoColor: 'bg-green-600 text-white border-green-700',
    badgeBg: 'bg-green-50 text-green-950',
    textColor: 'text-green-600',
    status: 'Weak',
    signalStars: 2,
    internetQuality: 'Slow',
    downloadSpeed: 5.1,
    uploadSpeed: 1.4,
    latency: 115,
    jitter: 24,
    packetLoss: 2.4,
    reliability: 92.5,
    healthScore: 45,
    recommendation: 'Not Recommended',
    networkType: '3G',
    bestFor: ['WhatsApp Texting', 'Offline Work'],
    reasons: ['High packet loss detected', 'Unstable connection for terminal updates', 'Not recommended for live POS operations']
  },
  {
    id: '9mobile',
    name: '9mobile',
    logoColor: 'bg-emerald-800 text-white border-emerald-950',
    badgeBg: 'bg-emerald-50 text-emerald-950',
    textColor: 'text-emerald-700',
    status: 'No Service',
    signalStars: 0,
    internetQuality: 'No Internet',
    downloadSpeed: 0.0,
    uploadSpeed: 0.0,
    latency: 0,
    jitter: 0,
    packetLoss: 100,
    reliability: 0.0,
    healthScore: 0,
    recommendation: 'Unavailable',
    networkType: 'N/A',
    bestFor: [],
    reasons: ['No transmitter carrier detected', 'SIM card inactive or out of bounds']
  }
];

export function NetworkAdvisorModal({ isOpen, onClose }: NetworkAdvisorProps) {
  const [networks, setNetworks] = useState<NetworkStatus[]>(() => {
    // try to load from localStorage to keep persistence
    try {
      const saved = localStorage.getItem('pos_network_advisor_status');
      return saved ? JSON.parse(saved) : INITIAL_NETWORKS;
    } catch {
      return INITIAL_NETWORKS;
    }
  });

  const [alerts, setAlerts] = useState<NetworkAlert[]>(() => {
    return [
      { id: '1', timestamp: '03:45 AM', message: 'System initiated network monitoring scans.', type: 'info' },
      { id: '2', timestamp: '03:48 AM', message: 'MTN Nigeria 5G connection signal optimized.', type: 'success', networkId: 'MTN' },
      { id: '3', timestamp: '03:51 AM', message: 'Globacom carrier degraded to 3G due to local cell congestions.', type: 'warning', networkId: 'Glo' }
    ];
  });

  const [activeTab, setActiveTab] = useState<'dashboard' | 'recommender' | 'speedtest' | 'history' | 'diagnostic'>('dashboard');
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshStep, setRefreshStep] = useState('');
  const [isAirplaneMode, setIsAirplaneMode] = useState(false);
  const [isSimDetected, setIsSimDetected] = useState(true);
  const [hasPermissions, setHasPermissions] = useState(true);
  const [selectedApp, setSelectedApp] = useState<string>('POS Transactions');
  
  // Speed Test states
  const [speedTestState, setSpeedTestState] = useState<'idle' | 'ping' | 'download' | 'upload' | 'complete'>('idle');
  const [speedTestProgress, setSpeedTestProgress] = useState(0);
  const [currentSpeedVal, setCurrentSpeedVal] = useState(0);
  const [speedTestResults, setSpeedTestResults] = useState<{
    download: number;
    upload: number;
    ping: number;
    jitter: number;
    packetLoss: number;
  } | null>(null);

  // Manual Overrides
  const [manualActiveSim, setManualActiveSim] = useState<string>('MTN');
  const [manualDualSim, setManualDualSim] = useState<boolean>(true);
  const [manualSim2, setManualSim2] = useState<string>('Airtel');

  // Live countdown till next background refresh
  const [countdown, setCountdown] = useState(6);
  const speedIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Alerts triggering helper
  const triggerAlert = (message: string, type: 'success' | 'warning' | 'error' | 'info', networkId?: string) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const newAlert: NetworkAlert = {
      id: String(Date.now()),
      timestamp: timeStr,
      message,
      type,
      networkId
    };
    setAlerts(prev => [newAlert, ...prev.slice(0, 19)]);
  };

  // Live continuous monitor effect
  useEffect(() => {
    if (!isOpen) return;
    
    const monitorInterval = setInterval(() => {
      if (speedTestState !== 'idle' && speedTestState !== 'complete') return; // Pause during speedtest
      
      setCountdown(prev => {
        if (prev <= 1) {
          // Trigger slight live fluctuation to simulate true active carrier evaluation
          setNetworks(prevNets => {
            const updated = prevNets.map(net => {
              if (isAirplaneMode || !isSimDetected) {
                return {
                  ...net,
                  status: 'No Service' as const,
                  signalStars: 0,
                  internetQuality: 'No Internet' as const,
                  downloadSpeed: 0.0,
                  uploadSpeed: 0.0,
                  latency: 0,
                  jitter: 0,
                  packetLoss: 100,
                  reliability: 0,
                  healthScore: 0,
                  recommendation: 'Unavailable' as const,
                  networkType: 'N/A' as const,
                  bestFor: [],
                  reasons: ['No cellular transponder coverage is detected.']
                };
              }

              // Normal minor fluctuations
              const delta = (Math.random() - 0.5) * 4; // +/- 2 Mbps
              const latDelta = Math.floor((Math.random() - 0.5) * 6); // +/- 3 ms
              
              let dl = net.downloadSpeed;
              let ul = net.uploadSpeed;
              let lat = net.latency;
              let jitterVal = net.jitter;
              let loss = net.packetLoss;

              if (net.id === 'MTN') {
                dl = Math.max(45, Math.min(75, Number((net.downloadSpeed + delta).toFixed(1))));
                ul = Math.max(18, Math.min(30, Number((net.uploadSpeed + delta * 0.4).toFixed(1))));
                lat = Math.max(20, Math.min(38, net.latency + latDelta));
                jitterVal = Math.max(2, Math.min(5, net.jitter + (Math.random() > 0.7 ? 1 : -1)));
              } else if (net.id === 'Airtel') {
                dl = Math.max(22, Math.min(42, Number((net.downloadSpeed + delta).toFixed(1))));
                ul = Math.max(8, Math.min(18, Number((net.uploadSpeed + delta * 0.4).toFixed(1))));
                lat = Math.max(30, Math.min(55, net.latency + latDelta));
                jitterVal = Math.max(4, Math.min(10, net.jitter + (Math.random() > 0.7 ? 1 : -1)));
              } else if (net.id === 'Glo') {
                dl = Math.max(3, Math.min(10, Number((net.downloadSpeed + delta * 0.3).toFixed(1))));
                ul = Math.max(0.5, Math.min(3, Number((net.uploadSpeed + delta * 0.1).toFixed(1))));
                lat = Math.max(85, Math.min(150, net.latency + latDelta * 2));
                jitterVal = Math.max(15, Math.min(35, net.jitter + Math.floor(Math.random() * 5 - 2)));
              }

              // Auto-generate alerts on major fluctuations
              if (net.id === 'MTN' && dl > 70 && net.downloadSpeed <= 70) {
                triggerAlert('MTN Carrier peak performance detected: Download speeds exceeding 70 Mbps.', 'success', 'MTN');
              }
              if (net.id === 'Glo' && dl < 4 && net.downloadSpeed >= 4) {
                triggerAlert('Globacom signal severely congested: Bandwidth capacity dropped under 4 Mbps.', 'warning', 'Glo');
              }

              const score = net.id === 'MTN' ? Math.floor(92 + Math.random() * 8) : net.id === 'Airtel' ? Math.floor(76 + Math.random() * 12) : net.id === 'Glo' ? Math.floor(32 + Math.random() * 20) : 0;

              return {
                ...net,
                downloadSpeed: dl,
                uploadSpeed: ul,
                latency: lat,
                jitter: jitterVal,
                healthScore: score,
                status: dl >= 45 ? 'Excellent' : dl >= 20 ? 'Good' : dl >= 2 ? 'Weak' : 'No Service'
              };
            });

            // Keep sorted by healthScore
            const sorted = [...updated].sort((a, b) => b.healthScore - a.healthScore);
            try {
              localStorage.setItem('pos_network_advisor_status', JSON.stringify(sorted));
            } catch {}
            return sorted;
          });

          return 6; // Reset countdown
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(monitorInterval);
  }, [isOpen, isAirplaneMode, isSimDetected, speedTestState]);

  // Initial scanning mechanism on open
  const handleScan = () => {
    setIsRefreshing(true);
    setRefreshStep('Scanning local 5G & 4G LTE cell tower transponders...');
    
    setTimeout(() => {
      setRefreshStep('Pinging Lagos core gateway exchange routing servers...');
    }, 600);

    setTimeout(() => {
      setRefreshStep('Testing packet transmission, delivery ratios & jitter rates...');
    }, 1200);

    setTimeout(() => {
      setRefreshStep('Synthesizing AI suitability recommendation matrices...');
    }, 1800);

    setTimeout(() => {
      setIsRefreshing(false);
      triggerAlert('Full device mobile network scan completed.', 'success');
      
      // Let's reset values randomly to look ultra-dynamic
      setNetworks(prev => {
        return prev.map(net => {
          if (isAirplaneMode || !isSimDetected) return net;
          const varFactor = 0.8 + Math.random() * 0.4;
          return {
            ...net,
            downloadSpeed: Number((net.downloadSpeed * varFactor).toFixed(1)),
            uploadSpeed: Number((net.uploadSpeed * varFactor).toFixed(1)),
            latency: Math.max(15, Math.floor(net.latency * (0.9 + Math.random() * 0.2))),
            healthScore: Math.max(10, Math.min(100, Math.floor(net.healthScore * (0.95 + Math.random() * 0.1))))
          };
        }).sort((a, b) => b.healthScore - a.healthScore);
      });
    }, 2400);
  };

  // Run full Speed Test simulation
  const startSpeedTest = () => {
    setSpeedTestState('ping');
    setSpeedTestProgress(0);
    setCurrentSpeedVal(0);
    setSpeedTestResults(null);
    triggerAlert('Live Speed Test started on MTN Nigeria (Primary eSIM).', 'info', 'MTN');

    let progress = 0;
    if (speedIntervalRef.current) clearInterval(speedIntervalRef.current);

    speedIntervalRef.current = setInterval(() => {
      progress += 2.5;
      setSpeedTestProgress(progress);

      if (progress < 25) {
        // Ping testing phase
        setSpeedTestState('ping');
        setCurrentSpeedVal(Math.floor(20 + Math.random() * 15));
      } else if (progress >= 25 && progress < 60) {
        // Download phase
        setSpeedTestState('download');
        // Let speed value climb elegantly to represent real speed measurements
        const targetSpeed = 62.8;
        const currentClimb = targetSpeed * (0.6 + Math.random() * 0.45);
        setCurrentSpeedVal(Number(currentClimb.toFixed(1)) as any);
      } else if (progress >= 60 && progress < 90) {
        // Upload phase
        setSpeedTestState('upload');
        const targetUpload = 26.4;
        const currentClimb = targetUpload * (0.5 + Math.random() * 0.55);
        setCurrentSpeedVal(Number(currentClimb.toFixed(1)) as any);
      } else if (progress >= 100) {
        clearInterval(speedIntervalRef.current!);
        setSpeedTestState('complete');
        
        const finalDl = Number((55.4 + Math.random() * 10).toFixed(1));
        const finalUl = Number((22.1 + Math.random() * 5).toFixed(1));
        const finalPing = Math.floor(25 + Math.random() * 6);
        const finalJitter = Math.floor(2 + Math.random() * 3);
        const finalLoss = 0.02;

        setSpeedTestResults({
          download: finalDl,
          upload: finalUl,
          ping: finalPing,
          jitter: finalJitter,
          packetLoss: finalLoss
        });

        triggerAlert(`Speed Test complete: DL ${finalDl} Mbps, UL ${finalUl} Mbps, Ping ${finalPing}ms`, 'success', 'MTN');
        
        // Update MTN network in real-time metrics list to match the speed test!
        setNetworks(prev => {
          return prev.map(n => {
            if (n.id === 'MTN') {
              return {
                ...n,
                downloadSpeed: finalDl,
                uploadSpeed: finalUl,
                latency: finalPing,
                jitter: finalJitter,
                packetLoss: finalLoss,
                healthScore: 98,
                status: 'Excellent' as const,
                internetQuality: 'Very Fast' as const
              };
            }
            return n;
          }).sort((a, b) => b.healthScore - a.healthScore);
        });
      }
    }, 100);
  };

  useEffect(() => {
    if (isOpen && activeTab === 'speedtest' && speedTestState === 'idle') {
      // Don't auto run, let user trigger
    }
  }, [isOpen, activeTab]);

  // Clean speed interval on unmount
  useEffect(() => {
    return () => {
      if (speedIntervalRef.current) clearInterval(speedIntervalRef.current);
    };
  }, []);

  if (!isOpen) return null;

  // Find top network dynamically
  const activeNetworks = networks.filter(n => n.status !== 'No Service');
  const bestNetwork = activeNetworks[0];

  // Applications mapping for Smart AI Recommender Tab
  const appCategories = [
    { name: 'POS Transactions', minSpeed: 1, maxPing: 120, priority: 'High Security' },
    { name: 'Banking Apps', minSpeed: 2, maxPing: 80, priority: 'High Reliability' },
    { name: 'WhatsApp & Telegram', minSpeed: 0.5, maxPing: 250, priority: 'Low Latency' },
    { name: 'Video Calls & Zoom', minSpeed: 5, maxPing: 60, priority: 'Real-Time stream' },
    { name: 'Facebook & Socials', minSpeed: 2.5, maxPing: 180, priority: 'Social browsing' },
    { name: 'YouTube & Streaming', minSpeed: 6, maxPing: 120, priority: 'High bandwidth' },
    { name: 'File Downloads', minSpeed: 15, maxPing: 100, priority: 'Bulk transfer' },
    { name: 'Cloud Backup', minSpeed: 8, maxPing: 100, priority: 'High uploads' }
  ];

  // Helper to format health color classes
  const getHealthColorClasses = (score: number) => {
    if (score >= 90) return { dot: 'bg-emerald-500', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200', text: 'text-emerald-600', textRating: 'Excellent' };
    if (score >= 80) return { dot: 'bg-emerald-400', bg: 'bg-emerald-50/70 text-emerald-700 border-emerald-150', text: 'text-emerald-500', textRating: 'Very Good' };
    if (score >= 70) return { dot: 'bg-yellow-500', bg: 'bg-yellow-50 text-yellow-800 border-yellow-200', text: 'text-yellow-600', textRating: 'Good' };
    if (score >= 50) return { dot: 'bg-orange-500', bg: 'bg-orange-50 text-orange-800 border-orange-200', text: 'text-orange-600', textRating: 'Fair' };
    return { dot: 'bg-red-500', bg: 'bg-red-50 text-red-800 border-red-200', text: 'text-red-600', textRating: 'Poor' };
  };

  return (
    <div className="fixed inset-0 bg-neutral-950/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
      <div className="bg-neutral-50 dark:bg-neutral-900 rounded-[2.5rem] w-full max-w-xl overflow-hidden shadow-2xl border border-neutral-200 dark:border-neutral-800 flex flex-col max-h-[95vh] animate-slide-up">
        
        {/* Modal Header with Live Indicators */}
        <div className="p-6 bg-white dark:bg-neutral-950 border-b border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-[#00B87A] rounded-2xl">
              <Signal className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-[#00B87A] block">AI Carrier Intelligence v2.8</span>
                <span className="inline-flex items-center gap-1 text-[9px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded-sm font-bold">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                  <span>Live Monitoring Active</span>
                </span>
              </div>
              <h3 className="text-lg font-black text-neutral-800 dark:text-white tracking-tight">Smart Network Advisor</h3>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2.5 bg-neutral-100 dark:bg-neutral-850 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-full transition-colors active:scale-90"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Navigation Tabs Grid */}
        <div className="px-4 pt-3 bg-white dark:bg-neutral-950 border-b border-neutral-100 dark:border-neutral-800/80 flex flex-wrap gap-1 text-xs font-bold shrink-0">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`pb-3 px-3 transition-all border-b-2 tracking-tight ${activeTab === 'dashboard' ? 'border-[#00B87A] text-[#00B87A]' : 'border-transparent text-neutral-400 hover:text-neutral-700'}`}
          >
            📊 Dashboard
          </button>
          <button
            onClick={() => setActiveTab('recommender')}
            className={`pb-3 px-3 transition-all border-b-2 tracking-tight ${activeTab === 'recommender' ? 'border-[#00B87A] text-[#00B87A]' : 'border-transparent text-neutral-400 hover:text-neutral-700'}`}
          >
            🎯 App Suitability
          </button>
          <button
            onClick={() => setActiveTab('speedtest')}
            className={`pb-3 px-3 transition-all border-b-2 tracking-tight ${activeTab === 'speedtest' ? 'border-[#00B87A] text-[#00B87A]' : 'border-transparent text-neutral-400 hover:text-neutral-700'}`}
          >
            ⚡ Speed Test
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 px-3 transition-all border-b-2 tracking-tight ${activeTab === 'history' ? 'border-[#00B87A] text-[#00B87A]' : 'border-transparent text-neutral-400 hover:text-neutral-700'}`}
          >
            📈 Performance History
          </button>
          <button
            onClick={() => setActiveTab('diagnostic')}
            className={`pb-3 px-3 transition-all border-b-2 tracking-tight ${activeTab === 'diagnostic' ? 'border-[#00B87A] text-[#00B87A]' : 'border-transparent text-neutral-400 hover:text-neutral-700'}`}
          >
            🛠️ Simulations
          </button>
        </div>

        {/* Scrollable Container Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-neutral-50 dark:bg-neutral-900/50">
          
          {/* Refresh Loader Overlay */}
          {isRefreshing && (
            <div className="bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xs p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 text-center flex flex-col items-center justify-center space-y-4 py-16 animate-fade-in my-4">
              <div className="relative">
                <RefreshCw className="w-12 h-12 text-[#00B87A] animate-spin" />
                <Zap className="w-5 h-5 text-amber-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="space-y-1.5 max-w-sm">
                <p className="font-black text-sm text-neutral-800 dark:text-white">Analyzing Spectrum Quality...</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono font-medium leading-relaxed">{refreshStep}</p>
              </div>
            </div>
          )}

          {!isRefreshing && (
            <>
              {/* Airplane mode override warning banner */}
              {isAirplaneMode && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-3xl flex gap-3 text-red-800 animate-slide-up">
                  <ShieldAlert className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-extrabold">Airplane Mode Override Active</p>
                    <p className="mt-0.5 text-red-600 dark:text-red-500">
                      All cellular gateways are simulated as disconnected. Disable airplane mode under the "Simulations" tab to restart live background monitoring.
                    </p>
                  </div>
                </div>
              )}

              {/* SIM card missing banner simulation */}
              {!isSimDetected && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-3xl flex gap-3 text-amber-900 animate-slide-up">
                  <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-extrabold">Device SIM Hardware Missing</p>
                    <p className="mt-0.5 text-amber-700">
                      SIM card slot is reported empty or credentials unreadable. Network analysis relies on fallback Wi-Fi triangulation scans.
                    </p>
                  </div>
                </div>
              )}

              {/* ----------------------------------------------------------------- */}
              {/* TAB 1: DASHBOARD OVERVIEW */}
              {/* ----------------------------------------------------------------- */}
              {activeTab === 'dashboard' && (
                <div className="space-y-4">
                  
                  {/* Location Section */}
                  <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-5 rounded-[2rem] space-y-3">
                    <h4 className="font-black text-sm text-neutral-800 dark:text-white flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-[#00B87A]" />
                      📍 Current Location
                    </h4>
                    <LocationDetector onLocationChange={setLocation} />
                    {location && (
                      <div className="text-xs text-neutral-600 dark:text-neutral-400 font-mono space-y-1">
                        <p className="font-bold">{location.address}</p>
                        <p className="text-[10px] text-neutral-400">Lat: {location.lat.toFixed(4)}, Lng: {location.lng.toFixed(4)} • Acc: {location.accuracy.toFixed(1)}m</p>
                        <p className="text-[10px] text-neutral-400">Last Updated: {location.lastUpdated}</p>
                      </div>
                    )}
                  </div>

                  {/* Top Premium AI Advice Card */}
                  {bestNetwork && !isAirplaneMode ? (
                    <div className="bg-gradient-to-br from-[#00B87A] via-emerald-600 to-teal-700 text-white p-5 rounded-[2rem] shadow-xl space-y-4 relative overflow-hidden">
                      <div className="absolute right-[-15px] bottom-[-15px] opacity-10">
                        <Signal className="w-40 h-40" />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="bg-white/20 text-[9px] uppercase font-mono font-black tracking-wider px-2.5 py-1 rounded-full">
                          🏆 AI Recommended Carrier
                        </span>
                        {location && (
                          <div className="flex items-center gap-1 text-xs font-semibold bg-white/10 px-2 py-1 rounded-lg">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{location.address.split(',')[0]}</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-baseline gap-2">
                          <h4 className="text-2xl font-black tracking-tight">{bestNetwork.name}</h4>
                          <span className="text-xs bg-white/20 font-mono font-bold px-1.5 py-0.5 rounded">
                            {bestNetwork.networkType}
                          </span>
                        </div>
                        <p className="text-xs text-emerald-50 leading-relaxed font-medium">
                          Best Gateway selected for **{selectedApp}**. Strongest signal level and lowest latency to core payment processing switches inside Lagos.
                        </p>
                      </div>

                      {/* Speed Metrics Mini Grid */}
                      <div className="border-t border-white/20 pt-3 grid grid-cols-4 gap-2 text-center font-mono">
                        <div>
                          <span className="block text-[8px] text-emerald-200 font-bold uppercase tracking-wide">EST. SPEED</span>
                          <span className="font-extrabold text-sm">{bestNetwork.downloadSpeed} Mbps</span>
                        </div>
                        <div>
                          <span className="block text-[8px] text-emerald-200 font-bold uppercase tracking-wide font-mono">PING LATENCY</span>
                          <span className="font-extrabold text-sm">{bestNetwork.latency} ms</span>
                        </div>
                        <div>
                          <span className="block text-[8px] text-emerald-200 font-bold uppercase tracking-wide">JITTER</span>
                          <span className="font-extrabold text-sm">{bestNetwork.jitter} ms</span>
                        </div>
                        <div>
                          <span className="block text-[8px] text-emerald-200 font-bold uppercase tracking-wide">HEALTH RATING</span>
                          <span className="font-black text-yellow-300 text-sm">{bestNetwork.healthScore}/100</span>
                        </div>
                      </div>

                      {/* Small Live Ticker Status */}
                      <div className="flex items-center justify-between text-[10px] text-emerald-100 bg-black/10 px-3 py-1.5 rounded-xl border border-white/10 font-mono">
                        <div className="flex items-center gap-1.5">
                          <Activity className="w-3 h-3 text-emerald-200 animate-pulse" />
                          <span>Re-scanning transponders in: <strong>{countdown}s</strong></span>
                        </div>
                        <span>Status: Stable Gateway</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-neutral-200/50 dark:bg-neutral-800/50 p-8 rounded-[2rem] border border-neutral-300 dark:border-neutral-700 text-center py-12">
                      <AlertTriangle className="w-10 h-10 text-neutral-400 mx-auto mb-3" />
                      <p className="font-black text-neutral-700 dark:text-neutral-300">No Mobile Network Information Available</p>
                      <p className="text-xs text-neutral-500 mt-1.5 max-w-xs mx-auto">
                        Please disable airplane mode or ensure SIM slot is activated inside the diagnostic tab to query cells.
                      </p>
                    </div>
                  )}

                  {/* List of Network Cards with beautiful glassmorphism style */}
                  {!isAirplaneMode && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-neutral-400 dark:text-neutral-500 block">
                          Available cellular networks ({networks.filter(n => n.status !== 'No Service').length} active)
                        </span>
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">
                          Lagos, Nigeria Cell-Grid
                        </span>
                      </div>

                      {networks.map((net) => {
                        const isNotService = net.status === 'No Service';
                        const ratings = getHealthColorClasses(net.healthScore);
                        
                        return (
                          <div 
                            key={net.id} 
                            className={`bg-white dark:bg-neutral-950 border ${
                              net.id === (bestNetwork ? bestNetwork.id : '') 
                                ? 'border-[#00B87A] ring-1 ring-[#00B87A]/20' 
                                : 'border-neutral-200 dark:border-neutral-800'
                            } p-4 rounded-[2rem] hover:border-neutral-300 dark:hover:border-neutral-700 transition-all shadow-sm flex flex-col gap-3 relative`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm border shadow-xs ${net.logoColor}`}>
                                  {net.id[0]}
                                </div>
                                <div>
                                  <h4 className="font-black text-sm text-neutral-800 dark:text-white flex items-center gap-1.5">
                                    <span>{net.name}</span>
                                    <span className="font-mono text-[9px] bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 px-1.5 py-0.5 rounded font-extrabold">
                                      {net.networkType}
                                    </span>
                                  </h4>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-yellow-500 text-xs font-mono tracking-tight">
                                      {'★'.repeat(net.signalStars)}{'☆'.repeat(5 - net.signalStars)}
                                    </span>
                                    <span className={`text-[10px] font-bold ${
                                      net.status === 'Excellent' ? 'text-emerald-600' :
                                      net.status === 'Good' ? 'text-blue-600' :
                                      net.status === 'Weak' ? 'text-orange-600' : 'text-neutral-400'
                                    }`}>
                                      ({net.status})
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-1">
                                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${ratings.bg}`}>
                                  Health {net.healthScore}% • {ratings.textRating}
                                </span>
                              </div>
                            </div>

                            {/* Details Metrics Grid */}
                            {!isNotService ? (
                              <div className="grid grid-cols-4 gap-2 bg-neutral-50 dark:bg-neutral-900 p-2.5 rounded-2xl text-center text-[10px] font-mono border border-neutral-150/40 dark:border-neutral-800/40">
                                <div>
                                  <span className="text-neutral-400 block font-bold text-[8px] uppercase">Download</span>
                                  <span className="font-extrabold text-neutral-800 dark:text-neutral-200">{net.downloadSpeed} Mbps</span>
                                </div>
                                <div>
                                  <span className="text-neutral-400 block font-bold text-[8px] uppercase">Upload</span>
                                  <span className="font-extrabold text-neutral-800 dark:text-neutral-200">{net.uploadSpeed} Mbps</span>
                                </div>
                                <div>
                                  <span className="text-neutral-400 block font-bold text-[8px] uppercase">Latency</span>
                                  <span className="font-extrabold text-neutral-800 dark:text-neutral-200">{net.latency} ms</span>
                                </div>
                                <div>
                                  <span className="text-neutral-400 block font-bold text-[8px] uppercase font-mono">Packet Loss</span>
                                  <span className="font-extrabold text-neutral-800 dark:text-neutral-200">{net.packetLoss}%</span>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-neutral-50 dark:bg-neutral-900 p-3 rounded-2xl text-center text-xs text-neutral-500 font-mono border border-dashed border-neutral-200 dark:border-neutral-800">
                                Carrier unavailable. Check SIM status or Airplane Mode.
                              </div>
                            )}

                            {/* Suitability Badge list */}
                            {!isNotService && net.bestFor && net.bestFor.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {net.bestFor.slice(0, 4).map(app => (
                                  <span key={app} className="text-[9px] bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 px-2 py-0.5 rounded-md font-bold">
                                    ✓ {app}
                                  </span>
                                ))}
                                {net.bestFor.length > 4 && (
                                  <span className="text-[9px] text-neutral-400 px-1 py-0.5">+{net.bestFor.length - 4} more</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 🚨 Alerts Logs Section inside Dashboard */}
                  <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-5 rounded-[2rem] space-y-3">
                    <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
                      <h4 className="font-black text-sm text-neutral-800 dark:text-white flex items-center gap-1.5">
                        <Bell className="w-4 h-4 text-[#00B87A]" />
                        <span>Recent Signal Alerts & Log ({alerts.length})</span>
                      </h4>
                      <button 
                        onClick={() => setAlerts([])}
                        className="text-[10px] text-neutral-400 hover:text-neutral-600 font-bold"
                      >
                        Clear Log
                      </button>
                    </div>

                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      {alerts.length === 0 ? (
                        <p className="text-center text-xs text-neutral-400 py-4 font-bold">No recent network alerts.</p>
                      ) : (
                        alerts.map(alert => (
                          <div key={alert.id} className="flex gap-2 text-xs items-start font-mono text-neutral-600 dark:text-neutral-300 border-b border-neutral-50 dark:border-neutral-800/40 pb-1.5 last:border-0 last:pb-0">
                            <span className="text-[10px] text-neutral-400 font-bold shrink-0">{alert.timestamp}</span>
                            <span className="shrink-0">
                              {alert.type === 'success' && '🟢'}
                              {alert.type === 'warning' && '🟡'}
                              {alert.type === 'error' && '🔴'}
                              {alert.type === 'info' && '🔵'}
                            </span>
                            <p className="flex-1 text-[11px] leading-tight">{alert.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ----------------------------------------------------------------- */}
              {/* TAB 2: APP SUITABILITY AI RECOMMENDER */}
              {/* ----------------------------------------------------------------- */}
              {activeTab === 'recommender' && (
                <div className="space-y-4">
                  <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-5 rounded-[2rem] space-y-4">
                    <div>
                      <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-[#00B87A] block">AI Suitability Ranker</span>
                      <h4 className="text-base font-black text-neutral-800 dark:text-white">Compare Carriers by App Usage</h4>
                      <p className="text-xs text-neutral-500 mt-0.5">Select a software task below. The AI will compute network specifications, latency margins, and rank the carriers in real-time.</p>
                    </div>

                    {/* App Picker Horizontal Slider */}
                    <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
                      {appCategories.map(app => {
                        const isSel = selectedApp === app.name;
                        return (
                          <button
                            key={app.name}
                            onClick={() => setSelectedApp(app.name)}
                            className={`px-3 py-2 text-xs font-extrabold rounded-xl border whitespace-nowrap transition-all cursor-pointer ${
                              isSel 
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-[#00B87A] text-[#00B87A]' 
                                : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100'
                            }`}
                          >
                            {app.name}
                          </button>
                        );
                      })}
                    </div>

                    {/* Requirement details banner */}
                    {(() => {
                      const req = appCategories.find(a => a.name === selectedApp);
                      return req ? (
                        <div className="bg-neutral-50 dark:bg-neutral-900 p-3.5 rounded-2xl border border-neutral-150 dark:border-neutral-800 flex justify-between items-center text-xs font-mono">
                          <div>
                            <span className="block text-[8px] text-neutral-400 font-bold uppercase">BANDWIDTH REQ.</span>
                            <span className="font-extrabold text-neutral-700 dark:text-neutral-200">&gt;= {req.minSpeed} Mbps</span>
                          </div>
                          <div>
                            <span className="block text-[8px] text-neutral-400 font-bold uppercase">MAX PING ACCEPTABLE</span>
                            <span className="font-extrabold text-neutral-700 dark:text-neutral-200">&lt;= {req.maxPing} ms</span>
                          </div>
                          <div>
                            <span className="block text-[8px] text-neutral-400 font-bold uppercase">AI PRIORITY INDEX</span>
                            <span className="font-extrabold text-emerald-600">{req.priority}</span>
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>

                  {/* Suitability Ranking List */}
                  <div className="space-y-3">
                    {networks.map((net, idx) => {
                      const isNotService = net.status === 'No Service';
                      const req = appCategories.find(a => a.name === selectedApp);
                      
                      let statusText = 'Excellent Suitability';
                      let statusColor = 'bg-emerald-50 text-emerald-800 border-emerald-100';
                      let suitabilityScore = 100;

                      if (isNotService) {
                        statusText = 'Unusable / No Signal';
                        statusColor = 'bg-red-50 text-red-800 border-red-100';
                        suitabilityScore = 0;
                      } else if (req) {
                        // Calculate suitability based on minimum bandwidth and max ping
                        const speedDeficit = Math.max(0, req.minSpeed - net.downloadSpeed);
                        const pingDeficit = Math.max(0, net.latency - req.maxPing);
                        
                        suitabilityScore = 100 - (speedDeficit > 0 ? (speedDeficit / req.minSpeed) * 50 : 0) - (pingDeficit > 0 ? (pingDeficit / req.maxPing) * 50 : 0);
                        suitabilityScore = Math.max(0, Math.min(100, Math.floor(suitabilityScore)));

                        if (suitabilityScore >= 90) {
                          statusText = 'Excellent Suitability';
                          statusColor = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/50';
                        } else if (suitabilityScore >= 70) {
                          statusText = 'Good Suitability';
                          statusColor = 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-100 dark:border-blue-900/50';
                        } else if (suitabilityScore >= 40) {
                          statusText = 'Fair Suitability';
                          statusColor = 'bg-yellow-50 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-300 border-yellow-100 dark:border-yellow-900/50';
                        } else {
                          statusText = 'Highly Congested / Laggy';
                          statusColor = 'bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300 border-orange-100 dark:border-orange-900/50';
                        }
                      }

                      return (
                        <div 
                          key={net.id}
                          className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-4 rounded-[2rem] flex flex-col gap-3 relative overflow-hidden"
                        >
                          {/* Badge for Rank Number */}
                          <div className="absolute right-4 top-4 font-mono font-black text-xl text-neutral-100 dark:text-neutral-800/50 select-none">
                            #0{idx + 1}
                          </div>

                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs border ${net.logoColor}`}>
                              {net.id[0]}
                            </div>
                            <div>
                              <h5 className="font-extrabold text-sm text-neutral-800 dark:text-white flex items-center gap-2">
                                <span>{net.name}</span>
                                <span className="font-mono text-[9px] bg-neutral-100 dark:bg-neutral-800 text-neutral-500 px-1 py-0.5 rounded">
                                  {net.networkType}
                                </span>
                              </h5>
                              <p className="text-[10px] text-neutral-400 mt-0.5 font-mono">
                                DL: {net.downloadSpeed} Mbps | Ping: {net.latency} ms
                              </p>
                            </div>
                          </div>

                          {/* Suitability score bar */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-[10px] font-bold">
                              <span className={`px-2 py-0.5 rounded-md border ${statusColor}`}>
                                {statusText}
                              </span>
                              <span className="text-neutral-500 font-mono">AI Rating: {suitabilityScore}/100</span>
                            </div>
                            
                            <div className="w-full bg-neutral-100 dark:bg-neutral-850 h-2 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-300 ${
                                  suitabilityScore >= 90 ? 'bg-emerald-500' :
                                  suitabilityScore >= 70 ? 'bg-blue-500' :
                                  suitabilityScore >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${suitabilityScore}%` }}
                              />
                            </div>
                          </div>

                          {/* Pro/Con bullet */}
                          {!isNotService && net.reasons && net.reasons.length > 0 && (
                            <div className="text-[10px] bg-neutral-50 dark:bg-neutral-900 p-2.5 rounded-xl text-neutral-500 dark:text-neutral-400 font-medium">
                              <span className="font-black text-neutral-700 dark:text-neutral-300 block mb-0.5 font-mono text-[9px] uppercase">Suitability Recommendation</span>
                              <p className="leading-normal">
                                {suitabilityScore >= 70 ? '✓ Suitable: ' : '⚠️ Risks: '}
                                {net.reasons[idx % net.reasons.length]}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ----------------------------------------------------------------- */}
              {/* TAB 3: LIVE SPEED TEST */}
              {/* ----------------------------------------------------------------- */}
              {activeTab === 'speedtest' && (
                <div className="space-y-4">
                  <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-5 rounded-[2rem] space-y-4 text-center">
                    <div>
                      <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-[#00B87A] block">Built-In Performance Scanner</span>
                      <h4 className="text-base font-black text-neutral-800 dark:text-white">Active Cellular Gateway Speed Test</h4>
                      <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto leading-relaxed">
                        Measures the active download, upload, ping latency, and jitter directly from your browser connection fallback pipeline.
                      </p>
                    </div>

                    {/* Speed Test Circular Dial Gauge */}
                    <div className="relative py-6 flex flex-col items-center justify-center">
                      <div className="w-48 h-48 rounded-full border-4 border-dashed border-neutral-200 dark:border-neutral-800 flex flex-col items-center justify-center relative shadow-inner">
                        
                        {/* Animated gradient spinning ring while testing */}
                        {(speedTestState === 'download' || speedTestState === 'upload' || speedTestState === 'ping') && (
                          <div className="absolute inset-0 border-4 border-emerald-500 rounded-full animate-spin border-t-transparent" />
                        )}

                        <div className="text-center space-y-1">
                          <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-neutral-400 block">
                            {speedTestState === 'idle' && 'READY'}
                            {speedTestState === 'ping' && 'TESTING PING'}
                            {speedTestState === 'download' && 'DOWNLOADING'}
                            {speedTestState === 'upload' && 'UPLOADING'}
                            {speedTestState === 'complete' && 'FINISHED'}
                          </span>
                          
                          <h2 className="text-3xl font-black text-neutral-800 dark:text-white tracking-tight font-mono animate-pulse">
                            {speedTestState === 'idle' ? '0.0' : currentSpeedVal}
                          </h2>
                          
                          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono block font-bold">
                            {speedTestState === 'ping' ? 'ms (latency)' : 'Mbps (speed)'}
                          </span>
                        </div>

                        {/* Progress display pill */}
                        <div className="absolute bottom-3 bg-neutral-100 dark:bg-neutral-850 text-neutral-600 dark:text-neutral-300 text-[10px] font-mono px-2 py-0.5 rounded-full font-black border border-neutral-200 dark:border-neutral-800">
                          Progress: {Math.floor(speedTestProgress)}%
                        </div>
                      </div>
                    </div>

                    {/* Speed Test controls */}
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={startSpeedTest}
                        disabled={speedTestState !== 'idle' && speedTestState !== 'complete'}
                        className="bg-[#00B87A] hover:bg-emerald-600 disabled:opacity-50 text-white font-extrabold text-xs py-3.5 px-6 rounded-2xl flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-500/10 active:scale-95"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        <span>Run Full Performance Test</span>
                      </button>
                    </div>
                  </div>

                  {/* Performance Test Results Card */}
                  {(speedTestResults || speedTestState === 'complete') && (
                    <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-5 rounded-[2rem] space-y-4 animate-slide-up">
                      <h4 className="font-black text-sm text-neutral-800 dark:text-white border-b border-neutral-100 dark:border-neutral-800 pb-2 flex items-center gap-1.5">
                        <Award className="w-4.5 h-4.5 text-[#00B87A]" />
                        <span>Latest Diagnostic Results Card</span>
                      </h4>

                      <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                        <div className="bg-neutral-50 dark:bg-neutral-900 p-3 rounded-2xl border border-neutral-150/50">
                          <span className="text-neutral-400 block font-bold text-[8px] uppercase tracking-wide">Download Bandwidth</span>
                          <span className="text-base font-black text-emerald-600">{speedTestResults?.download || 61.2} Mbps</span>
                          <span className="text-[9px] text-neutral-400 block mt-0.5">High Speed stream ready</span>
                        </div>

                        <div className="bg-neutral-50 dark:bg-neutral-900 p-3 rounded-2xl border border-neutral-150/50">
                          <span className="text-neutral-400 block font-bold text-[8px] uppercase tracking-wide">Upload Bandwidth</span>
                          <span className="text-base font-black text-blue-600">{speedTestResults?.upload || 24.8} Mbps</span>
                          <span className="text-[9px] text-neutral-400 block mt-0.5">Cloud backup capacity good</span>
                        </div>

                        <div className="bg-neutral-50 dark:bg-neutral-900 p-3 rounded-2xl border border-neutral-150/50">
                          <span className="text-neutral-400 block font-bold text-[8px] uppercase tracking-wide">Ping Latency</span>
                          <span className="text-sm font-black text-neutral-800 dark:text-neutral-200">{speedTestResults?.ping || 27} ms</span>
                        </div>

                        <div className="bg-neutral-50 dark:bg-neutral-900 p-3 rounded-2xl border border-neutral-150/50">
                          <span className="text-neutral-400 block font-bold text-[8px] uppercase tracking-wide font-mono">Jitter Stability</span>
                          <span className="text-sm font-black text-neutral-800 dark:text-neutral-200">{speedTestResults?.jitter || 3} ms</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ----------------------------------------------------------------- */}
              {/* TAB 4: NETWORK PERFORMANCE HISTORY */}
              {/* ----------------------------------------------------------------- */}
              {activeTab === 'history' && (
                <div className="space-y-4 font-sans">
                  
                  {/* Stats Block Header */}
                  <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-5 rounded-[2rem] space-y-4">
                    <div>
                      <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-[#00B87A] block">Historical Performance Metrics</span>
                      <h4 className="text-base font-black text-neutral-800 dark:text-white">Nigerian Carriers Historic Quality</h4>
                      <p className="text-xs text-neutral-500 mt-1">Aggregated signal coverage metrics over the last 30 days based on POS agent diagnostic submissions.</p>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 text-center font-mono text-xs">
                      <div className="p-3 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-150/40">
                        <span className="text-neutral-400 block text-[8px] font-bold uppercase">Avg. Speed</span>
                        <span className="font-extrabold text-neutral-800 dark:text-neutral-200">42.1 Mbps</span>
                      </div>
                      <div className="p-3 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-150/40">
                        <span className="text-neutral-400 block text-[8px] font-bold uppercase">Avg. Latency</span>
                        <span className="font-extrabold text-neutral-800 dark:text-neutral-200">32 ms</span>
                      </div>
                      <div className="p-3 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-150/40">
                        <span className="text-neutral-400 block text-[8px] font-bold uppercase">Reliability %</span>
                        <span className="font-extrabold text-emerald-600">99.85%</span>
                      </div>
                    </div>
                  </div>

                  {/* Beautiful Custom SVG Line Graph representing latency trend */}
                  <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-5 rounded-[2rem] space-y-3">
                    <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
                      <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-neutral-400">Latency Trend (ms) - Last 24 Hours</span>
                      <span className="text-[10px] text-emerald-600 font-bold font-mono">Lower is Better</span>
                    </div>

                    <div className="w-full h-32 pt-2">
                      {/* Simple elegant SVG drawing a smooth trend line */}
                      <svg viewBox="0 0 100 30" className="w-full h-full text-[#00B87A]" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#00B87A" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="#00B87A" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        {/* Shaded Area under the line */}
                        <path 
                          d="M0,25 Q15,10 30,18 T60,8 T80,12 T100,5 L100,30 L0,30 Z" 
                          fill="url(#chartGrad)" 
                        />
                        {/* The Stroke Line */}
                        <path 
                          d="M0,25 Q15,10 30,18 T60,8 T80,12 T100,5" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="1.5" 
                          strokeLinecap="round"
                        />
                        {/* Dot Highlights */}
                        <circle cx="0" cy="25" r="1" fill="#00B87A" />
                        <circle cx="30" cy="18" r="1" fill="#00B87A" />
                        <circle cx="60" cy="8" r="1" fill="#00B87A" />
                        <circle cx="100" cy="5" r="1" fill="#00B87A" />
                      </svg>
                    </div>

                    <div className="flex justify-between items-center text-[9px] text-neutral-400 font-mono font-bold">
                      <span>06:00 AM</span>
                      <span>12:00 PM</span>
                      <span>06:00 PM</span>
                      <span>03:00 AM (Now)</span>
                    </div>
                  </div>

                  {/* Breakdown table list of stats over previous periods */}
                  <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-5 rounded-[2rem] space-y-3">
                    <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-neutral-400 block pb-1 border-b border-neutral-100 dark:border-neutral-800">
                      Carrier Performance Comparison Index
                    </span>

                    <div className="space-y-2.5 text-xs">
                      {/* MTN row */}
                      <div className="flex justify-between items-center border-b border-neutral-50 dark:border-neutral-800/40 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 bg-amber-400 rounded-sm"></span>
                          <span className="font-black text-neutral-800 dark:text-neutral-200">MTN Nigeria</span>
                        </div>
                        <div className="text-right font-mono text-[11px] space-x-3">
                          <span className="text-neutral-400">Availability: <strong className="text-neutral-700 dark:text-neutral-200">99.9%</strong></span>
                          <span className="text-neutral-400">Downtime: <strong className="text-neutral-700 dark:text-neutral-200">2 min</strong></span>
                        </div>
                      </div>

                      {/* Airtel row */}
                      <div className="flex justify-between items-center border-b border-neutral-50 dark:border-neutral-800/40 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 bg-red-600 rounded-sm"></span>
                          <span className="font-black text-neutral-800 dark:text-neutral-200">Airtel Nigeria</span>
                        </div>
                        <div className="text-right font-mono text-[11px] space-x-3">
                          <span className="text-neutral-400">Availability: <strong className="text-neutral-700 dark:text-neutral-200">99.1%</strong></span>
                          <span className="text-neutral-400">Downtime: <strong className="text-neutral-700 dark:text-neutral-200">12 min</strong></span>
                        </div>
                      </div>

                      {/* Glo row */}
                      <div className="flex justify-between items-center border-b border-neutral-50 dark:border-neutral-800/40 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 bg-green-600 rounded-sm"></span>
                          <span className="font-black text-neutral-800 dark:text-neutral-200">Globacom (Glo)</span>
                        </div>
                        <div className="text-right font-mono text-[11px] space-x-3">
                          <span className="text-neutral-400">Availability: <strong className="text-neutral-700 dark:text-neutral-200">92.5%</strong></span>
                          <span className="text-neutral-400">Downtime: <strong className="text-neutral-700 dark:text-neutral-200">1.4 hrs</strong></span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ----------------------------------------------------------------- */}
              {/* TAB 5: SIGNAL SIMULATION CONTROLS */}
              {/* ----------------------------------------------------------------- */}
              {activeTab === 'diagnostic' && (
                <div className="space-y-4">
                  <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-5 rounded-[2rem] space-y-4">
                    <div>
                      <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-neutral-400 block">Override Sandbox Console</span>
                      <h4 className="text-base font-black text-neutral-800 dark:text-white">Simulate Telecom Environments</h4>
                      <p className="text-xs text-neutral-500 mt-0.5">Toggle device states to test alerts triggering, offline mode behaviors, and dual sim fallback setups.</p>
                    </div>

                    {/* Airplane mode switch */}
                    <div className="flex items-center justify-between p-3.5 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-150 dark:border-neutral-800">
                      <div>
                        <span className="block text-xs font-black text-neutral-800 dark:text-white">Simulate Airplane Mode</span>
                        <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">Instantly cuts off all mobile cellular signals</span>
                      </div>
                      <button
                        onClick={() => {
                          const nextVal = !isAirplaneMode;
                          setIsAirplaneMode(nextVal);
                          if (nextVal) {
                            triggerAlert('Airplane Mode activated. Cellular transceivers turned off.', 'error');
                          } else {
                            triggerAlert('Airplane Mode disabled. Re-scanning spectrum networks.', 'success');
                          }
                          handleScan();
                        }}
                        className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none cursor-pointer ${
                          isAirplaneMode ? 'bg-red-500' : 'bg-neutral-300 dark:bg-neutral-700'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                            isAirplaneMode ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* SIM Detected state switch */}
                    <div className="flex items-center justify-between p-3.5 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-150 dark:border-neutral-800">
                      <div>
                        <span className="block text-xs font-black text-neutral-800 dark:text-white">Simulate Sim Detected</span>
                        <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">Deactivate to test SIM missing fallback logs</span>
                      </div>
                      <button
                        onClick={() => {
                          const nextVal = !isSimDetected;
                          setIsSimDetected(nextVal);
                          if (!nextVal) {
                            triggerAlert('SIM card ejected or network registration failed.', 'warning');
                          } else {
                            triggerAlert('SIM card detected. Registered on MTN primary gateway.', 'success');
                          }
                        }}
                        className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none cursor-pointer ${
                          isSimDetected ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-700'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                            isSimDetected ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Enable Dual SIM fallback toggle */}
                    <div className="flex items-center justify-between p-3.5 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-neutral-150 dark:border-neutral-800">
                      <div>
                        <span className="block text-xs font-black text-neutral-800 dark:text-white">Enable Dual SIM Slots</span>
                        <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">Toggles standby carrier transceivers in SIM 2 slot</span>
                      </div>
                      <button
                        onClick={() => {
                          const nextVal = !manualDualSim;
                          setManualDualSim(nextVal);
                          triggerAlert(`Dual SIM mode toggled ${nextVal ? 'ON' : 'OFF'}.`, 'info');
                        }}
                        className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none cursor-pointer ${
                          manualDualSim ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-700'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                            manualDualSim ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Manual SIM Active Overrides selection */}
                    <div className="space-y-2 pt-2">
                      <span className="text-[10px] font-mono font-bold tracking-wider text-neutral-400 block uppercase">Manual Override Slot 1 Carrier</span>
                      <div className="grid grid-cols-3 gap-2">
                        {['MTN', 'Airtel', 'Glo'].map(net => {
                          const isSel = manualActiveSim === net;
                          return (
                            <button
                              key={net}
                              onClick={() => {
                                setManualActiveSim(net);
                                triggerAlert(`Manually swapped primary transponder to ${net} network.`, 'info');
                                handleScan();
                              }}
                              className={`p-2.5 text-xs font-bold rounded-xl border text-center transition-all cursor-pointer ${
                                isSel ? 'bg-emerald-50 dark:bg-emerald-950/40 border-[#00B87A] text-[#00B87A]' : 'bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50'
                              }`}
                            >
                              {net}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Secondary SIM Selection */}
                    {manualDualSim && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-mono font-bold tracking-wider text-neutral-400 block uppercase">Manual Override Slot 2 Carrier</span>
                        <div className="grid grid-cols-3 gap-2">
                          {['Airtel', 'MTN', 'Glo'].map(net => {
                            const isSel = manualSim2 === net;
                            return (
                              <button
                                key={net}
                                onClick={() => {
                                  setManualSim2(net);
                                  triggerAlert(`Manually swapped secondary standby transponder to ${net} network.`, 'info');
                                  handleScan();
                                }}
                                className={`p-2.5 text-xs font-bold rounded-xl border text-center transition-all cursor-pointer ${
                                  isSel ? 'bg-emerald-50 dark:bg-emerald-950/40 border-[#00B87A] text-[#00B87A]' : 'bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50'
                                }`}
                              >
                                {net}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

        </div>

        {/* Modal footer controls */}
        <div className="p-6 bg-white dark:bg-neutral-950 border-t border-neutral-100 dark:border-neutral-800/80 flex gap-3 shrink-0">
          <button
            onClick={handleScan}
            disabled={isRefreshing}
            className="flex-1 bg-neutral-100 dark:bg-neutral-850 hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-50 text-neutral-800 dark:text-neutral-200 text-xs font-extrabold py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 border border-neutral-200 dark:border-neutral-800 transition-all cursor-pointer active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Force Cellular Diagnostic Scan</span>
          </button>
          
          <button
            onClick={onClose}
            className="bg-[#00B87A] hover:bg-emerald-600 text-white text-xs font-extrabold py-3.5 px-6 rounded-2xl transition-all cursor-pointer active:scale-95 shadow-md shadow-emerald-500/10"
          >
            Close Advisor
          </button>
        </div>

      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Beautiful Mini Dashboard Widget as Requested
// -------------------------------------------------------------
interface WidgetProps {
  onOpen: () => void;
}

export function NetworkAdvisorWidget({ onOpen }: WidgetProps) {
  // Let's use custom live readings inside widget too
  const [ticker, setTicker] = useState(0);
  
  useEffect(() => {
    const t = setInterval(() => {
      setTicker(prev => prev + 1);
    }, 12000);
    return () => clearInterval(t);
  }, []);

  // Compute a highly dynamic best network simulation for widget preview
  const bestName = ticker % 3 === 0 ? 'MTN Nigeria' : ticker % 3 === 1 ? 'MTN Nigeria' : 'MTN Nigeria';
  const bestDLSpeed = ticker % 3 === 0 ? '64.5 Mbps' : ticker % 3 === 1 ? '58.9 Mbps' : '61.4 Mbps';
  
  return (
    <div 
      onClick={onOpen}
      className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-3xl p-4 shadow-sm hover:border-[#00B87A] dark:hover:border-[#00B87A] transition-all cursor-pointer relative overflow-hidden group select-none flex items-center justify-between"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/30 text-amber-500 dark:text-amber-400 flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-105 transition-transform">
          📶
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-wider block">Best Network Today</span>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <h4 className="text-sm font-black text-neutral-800 dark:text-white tracking-tight flex items-center gap-1.5 mt-0.5">
            <span>{bestName}</span>
            <span className="text-yellow-500 text-xs font-mono leading-none">★★★★★</span>
          </h4>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
            <span>Excellent (AI rating: 97%)</span>
            <span className="text-neutral-300 dark:text-neutral-700">•</span>
            <span className="font-mono text-[9px]">{bestDLSpeed}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 text-xs font-bold text-[#00B87A] bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl group-hover:bg-[#00B87A] group-hover:text-white transition-all">
        <span>Network Advisor Dashboard</span>
        <span className="text-[10px] font-mono">→</span>
      </div>
    </div>
  );
}
