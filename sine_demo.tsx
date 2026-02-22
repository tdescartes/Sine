import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, Share2, Scissors, 
  Monitor, Chrome, Code, Terminal, 
  Settings, Check, Copy, Clock,
  ChevronRight, MoreVertical, Maximize,
  Volume2, Shield, Zap, Plus, Video,
  Layers, HardDrive, Search, Trash2,
  ArrowLeft, Square, MousePointer2, Mic,
  Camera, X, GripHorizontal, Settings2,
  MessageSquare, Sparkles, ExternalLink,
  Users, Bell, Globe, Smile, Send,
  Lock, Eye, Calendar, Link as LinkIcon,
  Folder, Hash, LayoutGrid, ChevronDown
} from 'lucide-react';

const App = () => {
  const [view, setView] = useState('dashboard'); // 'dashboard', 'recording', 'player'
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isCopied, setIsCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('scenes');
  
  // New States for Features
  const [showShareModal, setShowShareModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false); // Manual Trim Mode
  
  // Recording State
  const [recordingSource, setRecordingSource] = useState('screen_cam');
  const [micActive, setMicActive] = useState(true);
  const [camActive, setCamActive] = useState(true);

  // Mock Data
  const videoMetadata = {
    title: "Quarterly Engineering Sync — Frontend Architecture",
    author: "Alex Rivers",
    date: "Feb 18, 2026",
    duration: 125.5,
    trimEnd: 123.8,
    viewCount: "1.2k",
    cta: { label: "View PR #402", url: "https://github.com", time: 45 },
    markers: [
      { time: 0, label: "Initial Context", icon: <Monitor size={14} /> },
      { time: 18, label: "Auth Flow Refactor", icon: <Code size={14} /> },
      { time: 54, label: "Performance Audit", icon: <Chrome size={14} /> },
      { time: 92, label: "CI/CD Pipeline Updates", icon: <Terminal size={14} /> },
    ],
    transcript: [
      { time: 0, text: "Hey everyone, today we're looking at the frontend architecture..." },
      { time: 18, text: "The auth flow was significantly slowed down by the old middleware." },
      { time: 54, text: "I ran a Chrome Lighthouse audit and found some heavy rendering blocks." }
    ],
    reactions: [
      { time: 12.5, emoji: "🚀" },
      { time: 12.8, emoji: "🚀" },
      { time: 13.2, emoji: "🔥" },
      { time: 55.0, emoji: "💡" },
      { time: 55.5, emoji: "💡" },
      { time: 94, emoji: "🙌" }
    ],
    comments: [
      { id: 1, time: 22, author: "JD", text: "Wait, did we check the memory leak on this specific middleware?", likes: 4 },
      { id: 2, time: 58, author: "ML", text: "The lighthouse score improvement is insane. Great job!", likes: 12 }
    ]
  };

  useEffect(() => {
    let interval;
    if (isPlaying && view === 'player') {
      interval = setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= videoMetadata.trimEnd) {
            setIsPlaying(false);
            return videoMetadata.trimEnd;
          }
          return prev + 0.1;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, view]);

  const handleCopy = () => {
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const progress = (currentTime / videoMetadata.duration) * 100;

  // --- COMPONENT: SIDEBAR (For Dashboard) ---
  const Sidebar = () => (
    <div className="w-64 border-r border-white/5 bg-[#050506] flex flex-col hidden lg:flex">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-8">
            <div className="w-6 h-6 bg-white rounded-sm flex items-center justify-center">
              <div className="w-3 h-3 bg-black transform rotate-45"></div>
            </div>
            <span className="text-lg font-bold tracking-[0.2em] text-white uppercase italic">Sine</span>
        </div>
        
        <div className="space-y-6">
            <div>
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-2">Library</h3>
                <nav className="space-y-1">
                    <button className="w-full flex items-center gap-3 px-2 py-2 text-xs font-medium text-white bg-white/5 rounded-md">
                        <LayoutGrid size={14} /> All Recordings
                    </button>
                    <button className="w-full flex items-center gap-3 px-2 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-md transition-colors">
                        <StarIcon size={14} /> Favorites
                    </button>
                    <button className="w-full flex items-center gap-3 px-2 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-md transition-colors">
                        <Folder size={14} /> Archived
                    </button>
                </nav>
            </div>

            <div>
                <div className="flex items-center justify-between px-2 mb-3">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Spaces</h3>
                    <Plus size={12} className="text-slate-500 hover:text-white cursor-pointer" />
                </div>
                <nav className="space-y-1">
                    <button className="w-full flex items-center gap-3 px-2 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-md transition-colors">
                        <Hash size={14} className="text-indigo-400" /> Engineering
                    </button>
                    <button className="w-full flex items-center gap-3 px-2 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-md transition-colors">
                        <Hash size={14} className="text-purple-400" /> Product Design
                    </button>
                    <button className="w-full flex items-center gap-3 px-2 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-md transition-colors">
                        <Hash size={14} className="text-green-400" /> All Hands
                    </button>
                </nav>
            </div>
        </div>
      </div>

      <div className="mt-auto p-6 border-t border-white/5">
        <button className="w-full flex items-center gap-3 text-xs font-medium text-slate-400 hover:text-white transition-colors">
            <Trash2 size={14} /> Trash
        </button>
      </div>
    </div>
  );

  // --- COMPONENT: SHARE MODAL ---
  const ShareModal = () => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-[#0c0c0e] border border-white/10 w-full max-w-md rounded-lg shadow-2xl p-6 relative">
            <button onClick={() => setShowShareModal(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white">
                <X size={16} />
            </button>
            
            <div className="mb-6">
                <h3 className="text-lg font-bold text-white mb-1">Share Session</h3>
                <p className="text-xs text-slate-400">Manage access levels for <span className="text-indigo-400 font-mono">Session_092</span></p>
            </div>

            {/* Access Level Tabs */}
            <div className="flex bg-white/5 p-1 rounded-md mb-6">
                <button className="flex-1 text-xs font-bold py-2 bg-black/50 text-white shadow-sm rounded-sm">Access</button>
                <button className="flex-1 text-xs font-bold py-2 text-slate-500 hover:text-slate-300">Embed</button>
            </div>

            <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between p-3 border border-white/5 rounded-md bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-full"><Globe size={16} /></div>
                        <div>
                            <div className="text-xs font-bold text-white">Public Access</div>
                            <div className="text-[10px] text-slate-500">Anyone with the link can view</div>
                        </div>
                    </div>
                    <div className="w-8 h-4 bg-indigo-500 rounded-full relative cursor-pointer"><div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full"></div></div>
                </div>

                <div className="flex items-center justify-between p-3 border border-white/5 rounded-md bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-800 text-slate-400 rounded-full"><Lock size={16} /></div>
                        <div>
                            <div className="text-xs font-bold text-white">Password Protection</div>
                            <div className="text-[10px] text-slate-500">Require code to view</div>
                        </div>
                    </div>
                    <div className="w-8 h-4 bg-slate-700 rounded-full relative cursor-pointer"><div className="absolute left-0.5 top-0.5 w-3 h-3 bg-slate-400 rounded-full"></div></div>
                </div>

                <div className="flex items-center justify-between p-3 border border-white/5 rounded-md bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-800 text-slate-400 rounded-full"><Calendar size={16} /></div>
                        <div>
                            <div className="text-xs font-bold text-white">Expiration</div>
                            <div className="text-[10px] text-slate-500">Link expires in 7 days</div>
                        </div>
                    </div>
                    <div className="w-8 h-4 bg-slate-700 rounded-full relative cursor-pointer"><div className="absolute left-0.5 top-0.5 w-3 h-3 bg-slate-400 rounded-full"></div></div>
                </div>
            </div>

            <div className="flex gap-3">
                <button className="flex-1 bg-white text-black font-bold text-xs py-3 rounded-sm hover:bg-slate-200 transition-colors uppercase tracking-widest">
                    Copy Link
                </button>
                <button className="px-4 border border-white/10 text-white rounded-sm hover:bg-white/5">
                    <Settings size={16} />
                </button>
            </div>
        </div>
    </div>
  );

  // --- VIEW: DASHBOARD (Updated with Sidebar) ---
  const DashboardView = () => (
    <div className="min-h-screen bg-[#050506] flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <nav className="flex items-center justify-between px-8 h-16 border-b border-white/5">
            <div className="flex items-center gap-4 lg:hidden">
                <div className="w-6 h-6 bg-white rounded-sm flex items-center justify-center">
                    <div className="w-3 h-3 bg-black transform rotate-45"></div>
                </div>
            </div>
            {/* Search Bar */}
            <div className="flex-1 max-w-xl">
               <div className="relative group">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-white transition-colors" />
                  <input type="text" placeholder="Search sessions by title, transcript, or tag..." className="bg-[#0c0c0e] border border-white/5 rounded-md pl-9 pr-4 py-2 text-xs w-full focus:outline-none focus:border-white/20 transition-all text-white placeholder:text-slate-600" />
               </div>
            </div>
            
            <div className="flex items-center gap-6 ml-8">
               <button className="text-slate-500 hover:text-white"><Bell size={18} /></button>
               <div className="flex items-center gap-2 pl-6 border-l border-white/5">
                   <div className="text-right hidden md:block">
                       <div className="text-xs font-bold text-white">Alex Rivers</div>
                       <div className="text-[10px] text-slate-500">Pro Plan</div>
                   </div>
                   <button className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-indigo-500/20">AR</button>
               </div>
            </div>
        </nav>

        <main className="flex-1 w-full px-8 py-10 overflow-y-auto">
            <div className="flex items-end justify-between mb-10">
               <div>
                  <h2 className="text-3xl font-bold text-white tracking-tight mb-2">My Library</h2>
                  <div className="flex items-center gap-4">
                    <p className="text-slate-500 text-xs font-medium uppercase tracking-widest flex items-center gap-2">
                        <Hash size={12} className="text-indigo-400" /> Engineering Space
                    </p>
                  </div>
               </div>
               
               <div className="flex gap-3">
                  <div className="bg-[#0c0c0e] border border-white/5 p-1 flex rounded-md">
                      <button 
                        onClick={() => setRecordingSource('screen_cam')}
                        className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all rounded-sm ${recordingSource === 'screen_cam' ? 'bg-white text-black' : 'text-slate-500 hover:text-slate-300'}`}
                      >Screen + Cam</button>
                      <button 
                        onClick={() => setRecordingSource('screen')}
                        className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all rounded-sm ${recordingSource === 'screen' ? 'bg-white text-black' : 'text-slate-500 hover:text-slate-300'}`}
                      >Screen Only</button>
                  </div>
                  <button 
                    onClick={() => setView('recording')}
                    className="bg-indigo-600 text-white px-6 py-2 flex items-center gap-2 font-black text-xs uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20 rounded-md"
                  >
                      <Video size={16} />
                      New Session
                  </button>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div key={item} className="bg-[#0c0c0e] border border-white/5 rounded-lg group cursor-pointer hover:border-white/20 transition-all overflow-hidden flex flex-col">
                   <div className="aspect-video bg-black/40 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                      <div className="absolute bottom-3 left-3 flex gap-1 z-10">
                          <span className="bg-black/80 border border-white/10 px-1.5 py-0.5 rounded-sm text-[9px] font-mono text-white">02:05</span>
                      </div>
                      
                      {/* Hover Actions */}
                      <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                         <button className="p-1.5 bg-black/80 border border-white/10 text-white rounded-sm hover:bg-white hover:text-black transition-colors"><LinkIcon size={12} /></button>
                         <button className="p-1.5 bg-black/80 border border-white/10 text-white rounded-sm hover:bg-white hover:text-black transition-colors"><StarIcon size={12} /></button>
                      </div>

                      <button 
                        onClick={() => setView('player')}
                        className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[1px]"
                      >
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                           <Play size={18} fill="currentColor" className="ml-0.5" />
                        </div>
                      </button>
                   </div>
                   <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="text-white font-bold text-xs mb-1 leading-snug group-hover:text-indigo-400 transition-colors">Session Protocol #{820 + item}</h4>
                        <p className="text-slate-500 text-[10px] font-medium">Feb {14 + item}, 2026</p>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
                         <div className="flex items-center gap-2">
                             <div className="flex -space-x-1.5">
                                <div className="w-4 h-4 rounded-full bg-slate-700 border border-[#0c0c0e]"></div>
                                <div className="w-4 h-4 rounded-full bg-slate-600 border border-[#0c0c0e]"></div>
                             </div>
                             <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">3 Views</span>
                         </div>
                         <button className="text-slate-600 hover:text-white"><MoreVertical size={14}/></button>
                      </div>
                   </div>
                </div>
              ))}
            </div>
        </main>
      </div>
    </div>
  );

  // --- VIEW: RECORDING ---
  const RecordingView = () => {
    return (
      <div className="min-h-screen bg-[#050506] flex flex-col items-center justify-center p-12 overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500 rounded-full filter blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-500 rounded-full filter blur-[120px] animate-pulse delay-700"></div>
          </div>

          <div className="w-full max-w-4xl space-y-12 relative z-10">
             <div className="flex flex-col items-center text-center space-y-6">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3 bg-red-600/10 border border-red-600/30 px-4 py-2 text-red-500">
                      <div className="w-2 h-2 bg-red-600 rounded-full animate-ping"></div>
                      <span className="text-[10px] font-black uppercase tracking-[0.3em]">Recording Active</span>
                  </div>
                  <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 text-slate-400">
                      <Sparkles size={12} className="text-indigo-400" />
                      <span className="text-[10px] font-black uppercase tracking-[0.3em]">AI TRANSCRIPT: STREAMING</span>
                  </div>
                </div>

                <h2 className="text-5xl font-bold text-white tracking-tighter leading-tight">
                  Capturing Workspace <br/> <span className="text-indigo-500 italic uppercase">Session_092</span>
                </h2>
                
                <div className="bg-[#0c0c0e] border border-white/5 p-4 w-full max-w-lg text-left">
                    <p className="text-[10px] font-mono text-indigo-400 uppercase mb-2">Live Transcript Snippet:</p>
                    <p className="text-[11px] text-slate-400 font-medium">"...so when we optimize the AV1 fragments here, the buffer size decreases significantly in the..."</p>
                </div>
             </div>

             <div className="grid grid-cols-4 gap-1">
                <div className="bg-[#0c0c0e]/50 backdrop-blur-md border border-white/5 p-6 flex flex-col items-center gap-3">
                    <Monitor size={20} className="text-slate-600" />
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Source</div>
                    <div className="text-[11px] text-white font-mono">Main (4K)</div>
                </div>
                <div className="bg-[#0c0c0e]/50 backdrop-blur-md border border-white/5 p-6 flex flex-col items-center gap-3">
                    <Mic size={20} className={micActive ? "text-indigo-400" : "text-slate-700"} />
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Voice</div>
                    <div className="text-[11px] text-white font-mono">{micActive ? "Isolated" : "Muted"}</div>
                </div>
                <div className="bg-[#0c0c0e]/50 backdrop-blur-md border border-white/5 p-6 flex flex-col items-center gap-3">
                    <Camera size={20} className={camActive ? "text-indigo-400" : "text-slate-700"} />
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">FaceCam</div>
                    <div className="text-[11px] text-white font-mono">{camActive ? "1080p60" : "Disabled"}</div>
                </div>
                <div className="bg-[#0c0c0e]/50 backdrop-blur-md border border-white/5 p-6 flex flex-col items-center gap-3">
                    <Zap size={20} className="text-slate-600" />
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Protocol</div>
                    <div className="text-[11px] text-white font-mono">QUIC/MoQ</div>
                </div>
             </div>
          </div>

          <div className="fixed bottom-12 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl h-20 bg-[#0c0c0e] border border-white/10 flex items-center justify-between px-10 z-[100] shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
              <div className="flex items-center gap-8">
                 <div className="flex items-center gap-3 pr-8 border-r border-white/10 text-white">
                    <div className="w-4 h-4 bg-red-600"></div>
                    <span className="text-xl font-mono tabular-nums tracking-tighter">03:42:12</span>
                 </div>
              </div>

              <div className="flex items-center gap-6">
                  <div className="flex gap-2">
                      <button className="p-3 border bg-white/5 border-white/10 text-slate-400 hover:text-white transition-colors"><Mic size={18} /></button>
                      <button className="p-3 border bg-white/5 border-white/10 text-slate-400 hover:text-white transition-colors"><Camera size={18} /></button>
                      <button className="p-3 border bg-white/5 border-white/10 text-slate-400 hover:text-white transition-colors"><Settings2 size={18} /></button>
                  </div>
                  <div className="h-8 w-px bg-white/10 mx-2"></div>
                  <button 
                    onClick={() => { setView('player'); setCurrentTime(0); }}
                    className="bg-white text-black h-12 px-10 font-black text-xs uppercase tracking-widest transition-all shadow-lg"
                  >
                      Finish & Auto-Trim
                  </button>
              </div>
          </div>
      </div>
    );
  };

  // --- VIEW: PLAYER ---
  const PlayerView = () => {
    const [activeReactions, setActiveReactions] = useState([]);
    
    useEffect(() => {
        const reactionsAtThisTime = videoMetadata.reactions.filter(r => 
            Math.abs(r.time - currentTime) < 0.2
        );
        if (reactionsAtThisTime.length > 0) {
            setActiveReactions(prev => [...prev, ...reactionsAtThisTime.map(r => ({...r, id: Math.random()}))]);
            setTimeout(() => {
                setActiveReactions(prev => prev.slice(reactionsAtThisTime.length));
            }, 2000);
        }
    }, [currentTime]);

    return (
      <div className="min-h-screen bg-[#050506] flex flex-col">
        {showShareModal && <ShareModal />}
        
        <nav className="flex items-center justify-between px-6 h-16 border-b border-white/5 bg-[#050506] sticky top-0 z-50">
          <div className="flex items-center gap-6">
            <button onClick={() => setView('dashboard')} className="p-2 -ml-2 text-slate-500 hover:text-white transition-colors"><ArrowLeft size={18} /></button>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-white rounded-sm flex items-center justify-center">
                <div className="w-2.5 h-2.5 bg-black transform rotate-45"></div>
              </div>
              <span className="text-sm font-bold tracking-[0.2em] text-white uppercase italic">Sine</span>
            </div>
            <div className="h-4 w-px bg-white/10"></div>
            <div className="flex gap-4 text-xs font-medium uppercase tracking-widest text-slate-500">
              <button className="text-white">Player</button>
              <button className="hover:text-white transition-colors flex items-center gap-2">
                  Insights <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="p-2 text-slate-400 hover:text-white transition-colors"><Settings size={18} /></button>
            <button 
                onClick={() => setShowShareModal(true)}
                className="bg-white text-black px-4 py-1.5 rounded-sm font-bold text-xs uppercase tracking-tighter hover:bg-slate-200 transition-all active:scale-95"
            >
              <Share2 size={14} className="inline mr-2"/> Share Video
            </button>
          </div>
        </nav>

        <main className="max-w-[1600px] mx-auto px-6 py-8 grid grid-cols-12 gap-8 w-full">
          <div className="col-span-12 lg:col-span-9 space-y-6">
            <div className="relative aspect-video bg-black rounded-sm overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/5 group">
              <div className="absolute inset-0 bg-[#0c0c0e] flex items-center justify-center">
                 <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#1e1e24_1px,transparent_1px)] [background-size:20px_20px]"></div>
                 <div className="relative z-10 flex flex-col items-center gap-4 text-center">
                    <button onClick={() => setIsPlaying(!isPlaying)} className="w-16 h-16 bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all">
                       {isPlaying ? <Pause size={28} className="text-white" /> : <Play size={28} className="text-white ml-1" />}
                    </button>
                    <p className="text-[9px] text-slate-500 font-mono tracking-[0.3em] uppercase">Session Playback // Sine AV1</p>
                 </div>
              </div>

              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {activeReactions.map(r => (
                  <div key={r.id} className="absolute bottom-0 text-3xl animate-reaction-float" style={{ left: `${20 + Math.random() * 60}%` }}>{r.emoji}</div>
                ))}
              </div>

              {currentTime > videoMetadata.cta.time && currentTime < videoMetadata.cta.time + 10 && (
                  <div className="absolute top-8 left-1/2 -translate-x-1/2 animate-in fade-in zoom-in duration-300">
                      <a href={videoMetadata.cta.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 bg-indigo-600 text-white px-6 py-3 font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-indigo-500 transition-colors border border-indigo-400">
                          <ExternalLink size={14} /> {videoMetadata.cta.label}
                      </a>
                  </div>
              )}

              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/60 to-transparent p-6">
                
                {/* Visual Trim Editor Mode vs Standard Timeline */}
                {isEditing ? (
                    <div className="h-16 bg-black/50 border border-white/10 mb-4 rounded-md relative flex items-center px-4 cursor-col-resize">
                        <div className="absolute inset-x-0 h-8 bg-indigo-500/20"></div>
                        <div className="absolute left-0 top-0 bottom-0 w-[95%] border-l-4 border-indigo-500 bg-indigo-500/10"></div>
                        <div className="absolute right-0 top-0 bottom-0 w-[5%] bg-black/80 border-l border-white/20"></div>
                        <span className="absolute left-4 text-[10px] font-mono text-indigo-400">Start: 00:00</span>
                        <span className="absolute right-12 text-[10px] font-mono text-red-400">Trim: -1.5s</span>
                    </div>
                ) : (
                    <div className="relative h-1 bg-white/10 mb-6 cursor-pointer group/timeline">
                        <div className="absolute top-0 left-0 h-full bg-white z-10" style={{ width: `${progress}%` }}></div>
                        <div className="absolute top-[-2px] inset-x-0 flex opacity-30">
                            {videoMetadata.reactions.map((r, i) => (
                                <div key={i} className="absolute w-0.5 h-1.5 bg-indigo-500" style={{ left: `${(r.time / videoMetadata.duration) * 100}%` }}></div>
                            ))}
                        </div>
                        {videoMetadata.comments.map((c, i) => (
                            <div key={i} className="absolute -top-1 w-2 h-2 bg-indigo-400 border border-black z-30 transform -translate-x-1/2" style={{ left: `${(c.time / videoMetadata.duration) * 100}%` }} title={c.text}></div>
                        ))}
                        <div className="absolute top-0 right-0 h-full bg-red-500/20 border-l border-red-500/50" style={{ width: `${((videoMetadata.duration - videoMetadata.trimEnd) / videoMetadata.duration) * 100}%` }}></div>
                    </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4 text-white">
                      <button onClick={() => setIsPlaying(!isPlaying)}>{isPlaying ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" />}</button>
                      <button className="text-slate-400 hover:text-white transition-colors"><Volume2 size={18} /></button>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 tracking-tighter uppercase">
                      <span className="text-white">{Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(0).padStart(2, '0')}</span>
                      <span className="mx-2">/</span>
                      {Math.floor(videoMetadata.trimEnd / 60)}:{(videoMetadata.trimEnd % 60).toFixed(0).padStart(2, '0')}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md border border-white/5 p-1">
                      {["🚀", "🔥", "💡", "🙌", "💯"].map(emoji => (
                          <button key={emoji} className="w-8 h-8 hover:bg-white/10 flex items-center justify-center transition-colors text-lg">
                            {emoji}
                          </button>
                      ))}
                      <div className="w-px h-4 bg-white/10 mx-1"></div>
                      <button className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-white">Comment</button>
                  </div>

                  <div className="flex items-center gap-3">
                     <button 
                        onClick={() => setIsEditing(!isEditing)}
                        className={`p-1.5 transition-colors ${isEditing ? 'text-indigo-400 bg-indigo-500/20' : 'text-slate-500 hover:bg-white/10'}`}
                     >
                        <Scissors size={14}/>
                     </button>
                     <button className="p-1.5 hover:bg-white/10 transition-colors text-slate-500"><Maximize size={14}/></button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-start justify-between border-b border-white/5 pb-8">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold text-white tracking-tight">{videoMetadata.title}</h1>
                <div className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-widest text-slate-500">
                  <span>{videoMetadata.author}</span>
                  <span className="w-0.5 h-0.5 bg-slate-700 rounded-full"></span>
                  <span className="text-indigo-400">{videoMetadata.viewCount} Views</span>
                </div>
              </div>
              <div className="flex gap-2">
                  <button className="px-4 py-2 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-all">Download Protocol</button>
                  <button className="p-2 border border-white/10 hover:bg-white/5 text-slate-400"><MoreVertical size={20} /></button>
              </div>
            </div>

            <div className="space-y-6 py-4">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Recent Interactions</h3>
                {videoMetadata.comments.map(comment => (
                    <div key={comment.id} className="group relative flex gap-4 p-4 border border-white/5 bg-[#0c0c0e]/30 hover:bg-[#0c0c0e] transition-colors">
                        <div className="w-8 h-8 bg-slate-800 flex items-center justify-center text-[10px] font-bold text-white">{comment.author}</div>
                        <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono text-indigo-400">{Math.floor(comment.time / 60)}:{(comment.time % 60).toFixed(0).padStart(2, '0')}</span>
                                <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">{comment.likes} Likes</span>
                            </div>
                            <p className="text-sm text-slate-300 leading-relaxed">{comment.text}</p>
                        </div>
                    </div>
                ))}
                
                <div className="flex gap-4 items-center p-4 border border-indigo-500/20 bg-indigo-500/5">
                    <div className="w-8 h-8 bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white shadow-lg">AR</div>
                    <input 
                        type="text" 
                        placeholder={`Leave a comment at ${Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(0).padStart(2, '0')}...`}
                        className="flex-1 bg-transparent border-none text-xs text-white focus:outline-none placeholder:text-slate-600"
                    />
                    <button className="text-indigo-400 hover:text-indigo-300"><Send size={16} /></button>
                </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-3 space-y-6">
            <div className="bg-[#0c0c0e] border border-white/5 rounded-sm p-1">
              <div className="flex p-1 gap-1">
                  {['scenes', 'transcript', 'team'].map(tab => (
                      <button 
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-[#18181b] text-white' : 'text-slate-500'}`}
                      >{tab}</button>
                  ))}
              </div>
              
              <div className="p-3">
                  {activeTab === 'scenes' && (
                      <div className="space-y-1">
                          {videoMetadata.markers.map((marker, i) => (
                              <button key={i} onClick={() => setCurrentTime(marker.time)} className={`w-full group flex items-center gap-4 p-3 border transition-all ${Math.floor(currentTime) === Math.floor(marker.time) ? 'bg-white text-black border-white' : 'bg-transparent border-transparent hover:bg-white/5 text-slate-400'}`}>
                                  <span className="text-[10px] font-mono opacity-50">{Math.floor(marker.time / 60)}:{(marker.time % 60).toFixed(0).padStart(2, '0')}</span>
                                  <div className="flex-1 text-left text-xs font-bold uppercase tracking-tight">{marker.label}</div>
                              </button>
                          ))}
                      </div>
                  )}
                  {activeTab === 'transcript' && (
                      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                          {videoMetadata.transcript.map((line, i) => (
                              <div key={i} className={`p-2 transition-opacity ${currentTime < line.time ? 'opacity-30' : 'opacity-100'}`}>
                                  <div className="text-[9px] font-mono text-indigo-400 mb-1">{line.time}s</div>
                                  <div className="text-[11px] text-slate-300 leading-relaxed font-medium">{line.text}</div>
                              </div>
                          ))}
                      </div>
                  )}
                  {activeTab === 'team' && (
                      <div className="space-y-4 p-2">
                          <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold">JD</div>
                              <div className="flex-1">
                                  <div className="text-[11px] font-bold text-white uppercase">John Doe</div>
                                  <div className="text-[9px] text-slate-500 uppercase">Watched 3 times</div>
                              </div>
                          </div>
                      </div>
                  )}
              </div>
            </div>
          </div>
        </main>

        <style>{`
            @keyframes reaction-float {
                0% { transform: translateY(0) scale(0.5); opacity: 0; }
                20% { opacity: 1; transform: translateY(-50px) scale(1.2); }
                100% { transform: translateY(-300px) scale(1); opacity: 0; }
            }
            .animate-reaction-float {
                animation: reaction-float 2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
            }
            .custom-scrollbar::-webkit-scrollbar {
                width: 2px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
                background: transparent;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
                background: #1e1e24;
            }
        `}</style>
      </div>
    );
  };

  // Icon Placeholder helper for Sidebar
  const StarIcon = ({size}) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
  );

  switch (view) {
    case 'recording': return <RecordingView />;
    case 'player': return <PlayerView />;
    default: return <DashboardView />;
  }
};

export default App;