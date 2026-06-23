import * as React from 'react';
import { useState, useEffect, useRef, Component } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  MapPin, 
  Globe, 
  ArrowRight, 
  Compass, 
  Palette, 
  Home, 
  Hammer,
  Instagram,
  Facebook,
  Linkedin,
  Loader2,
  ChevronRight,
  Send,
  Phone,
  Mail,
  Award,
  Users,
  Clock,
  Sparkles,
  LogOut,
  Pin,
  Play,
  User as UserIcon,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  Trash2,
  Download,
  Printer,
  Share2,
  Rotate3d,
  Image as ImageIcon,
  Upload,
  Layers,
  LayoutDashboard,
  Settings,
  MessageSquare,
  FileText,
  Video,
  Quote,
  X,
  Pause,
  Volume2,
  VolumeX,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  UserCheck,
  ClipboardList,
  ExternalLink,
  Eye,
  MoreVertical,
  Filter,
  Search,
  Calendar,
  UserPlus,
  ShieldCheck,
  Coins,
  Briefcase
} from 'lucide-react';
import { 
  auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, 
  doc, getDoc, setDoc, collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, limit, deleteDoc, updateDoc,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile,
  storage, ref, uploadBytes, getDownloadURL
} from './firebase';
import ThreeDViewer from './components/ThreeDViewer';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
    scrollToEnquiry: () => void;
  }
}

async function robustFetch(input: RequestInfo | URL, init?: RequestInit, maxAttempts = 5): Promise<Response> {
  let attempt = 0;
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  
  while (attempt < maxAttempts) {
    try {
      const res = await fetch(input, init);
      const isHtml = res.headers.get("content-type")?.includes("text/html");
      
      // If we got a Server Error (5xx) or an HTML page on an expected JSON API endpoint, retry
      if (res.status >= 500 || (isHtml && String(input).includes("/api/"))) {
        attempt++;
        if (attempt < maxAttempts) {
          const waitTime = Math.pow(2, attempt) * 200 + Math.floor(Math.random() * 150);
          console.log(`[CLIENT FETCH RETRY] HTML/Error response on ${String(input)} (status: ${res.status}). Attempt ${attempt}/${maxAttempts}. Retrying in ${waitTime}ms...`);
          await delay(waitTime);
          continue;
        }
      }
      return res;
    } catch (err: any) {
      attempt++;
      if (attempt < maxAttempts) {
        const waitTime = Math.pow(2, attempt) * 200 + Math.floor(Math.random() * 150);
        console.log(`[CLIENT FETCH RETRY] Network failure on ${String(input)} (attempt ${attempt}/${maxAttempts}). Retrying in ${waitTime}ms...`);
        await delay(waitTime);
        continue;
      }
      throw err;
    }
  }
  return fetch(input, init); // final fallback
}

interface LandingPageConfig {
  hero_bg: string;
  philosophy_img: string;
  service1_img: string;
  service2_img: string;
  service3_img: string;
  portfolio_video: string;
}

interface PortfolioProject {
  id?: string;
  image: string;
  title: string;
  category: string;
  location: string;
  area: string;
  description: string;
  gallery: string[];
}

async function getCompanyDetails(companyName: string) {
  try {
    const res = await robustFetch("/api/gemini/company-details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName }),
    });
    if (!res.ok) throw new Error("Server error");
    const data = await res.json();
    if (data.success && data.text) {
      return { text: data.text, sources: [] };
    }
    throw new Error(data.message || "Failed to generate company overview");
  } catch (error: any) {
    console.log("Search fallback activated:", error);
    // Fallback if API key is restricted
    return { 
      text: "RR Inside Out Creation Private Limited is a premier design and creation firm dedicated to transforming spaces from the inside out. We specialize in holistic architectural and interior solutions that blend functionality with artistic expression. Founded on the principle that spaces should be as unique as the individuals who inhabit them, we specialize in crafting bespoke environments that transcend the ordinary.", 
      sources: [] 
    };
  }
}

const AIChatbot = ({ user }: { user: any }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      const q = query(
        collection(db, 'chats'),
        where('uid', '==', user.uid),
        orderBy('createdAt', 'asc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => doc.data() as { role: 'user' | 'model', text: string });
        setMessages(msgs);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'chats');
      });
      return () => unsubscribe();
    }
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !user) return;

    const userMsg = input.trim();
    setInput('');
    setIsTyping(true);

    try {
      await addDoc(collection(db, 'chats'), {
        uid: user.uid,
        role: 'user',
        text: userMsg,
        createdAt: serverTimestamp()
      });

      const res = await robustFetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages,
          userMsg: userMsg
        })
      });

      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      if (!data.success || !data.text) {
        throw new Error(data.message || "Failed to generate chat response");
      }

      await addDoc(collection(db, 'chats'), {
        uid: user.uid,
        role: 'model',
        text: data.text,
        createdAt: serverTimestamp()
      });
    } catch (error: any) {
      console.error("Chat error:", error);
      const errorMsg = error.message?.includes('403') 
        ? "I'm sorry, I'm having trouble connecting to my design database right now. Please try again in a moment."
        : "I'm sorry, I encountered an error. Please try again.";
      
      await addDoc(collection(db, 'chats'), {
        uid: user.uid,
        role: 'model',
        text: errorMsg,
        createdAt: serverTimestamp()
      });
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-[#5A5A40] text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all z-[90]"
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-8 w-[350px] md:w-[400px] h-[500px] bg-white rounded-2xl shadow-2xl border border-zinc-100 flex flex-col overflow-hidden z-[90]"
          >
            <div className="p-4 bg-zinc-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#5A5A40] rounded-lg flex items-center justify-center font-bold">RR</div>
                <div>
                  <p className="text-xs font-bold">Design Consultant</p>
                  <p className="text-[10px] text-zinc-400">Online</p>
                </div>
              </div>
              <Sparkles size={16} className="text-[#5A5A40]" />
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50">
              {messages.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-xs text-zinc-400 font-light italic">Start a conversation with our AI design expert.</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                    msg.role === 'user' 
                      ? 'bg-[#5A5A40] text-white rounded-tr-none' 
                      : 'bg-white text-zinc-700 border border-zinc-100 rounded-tl-none shadow-sm'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-zinc-100 shadow-sm">
                    <Loader2 className="animate-spin text-zinc-400" size={16} />
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-zinc-100 bg-white">
              {!user ? (
                <p className="text-[10px] text-center text-zinc-400 uppercase tracking-widest font-bold">Please login to chat</p>
              ) : (
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={input} 
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Type your message..."
                    className="flex-1 bg-zinc-50 border border-zinc-200 px-4 py-2 rounded-full text-sm outline-none focus:border-[#5A5A40] transition-all"
                  />
                  <button 
                    onClick={handleSend}
                    className="w-10 h-10 bg-zinc-900 text-white rounded-full flex items-center justify-center hover:bg-[#5A5A40] transition-all"
                  >
                    <Send size={16} />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const StartWithDesign = ({ isOpen, onClose, user, onBookConsultation, onOpenAuth }: { isOpen: boolean, onClose: () => void, user: any, onBookConsultation: () => void, onOpenAuth: () => void }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    projectType: '',
    budget: '',
    materialPreference: '',
    theme: '',
    requirements: ''
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedBrief, setGeneratedBrief] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!user) {
      onOpenAuth();
      return;
    }
    setIsGenerating(true);
    setError(null);
    try {
      const res = await robustFetch("/api/gemini/design-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectType: formData.projectType,
          budget: formData.budget,
          materialPreference: formData.materialPreference,
          theme: formData.theme,
          requirements: formData.requirements
        })
      });

      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      if (!data.success || !data.text) {
        throw new Error(data.message || "Failed to generate design brief");
      }

      const brief = JSON.parse(data.text.trim());
      setGeneratedBrief(brief);
      
      await addDoc(collection(db, 'design_briefs'), {
        uid: user.uid,
        formData,
        aiBrief: brief,
        createdAt: serverTimestamp()
      });

      setStep(3);
    } catch (error: any) {
      console.error("Brief generation error:", error);
      if (error.message?.includes('403')) {
        setError("Permission denied. Please ensure your API key is correctly configured.");
      } else {
        setError("Failed to generate brief. Please try again.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoginError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      if (error.code === 'auth/popup-blocked') {
        setLoginError("Popup blocked. Please allow popups.");
      } else if (error.code === 'auth/popup-closed-by-user') {
        setLoginError("Sign-in cancelled.");
      } else if (error.code === 'auth/cancelled-popup-request') {
        setLoginError("Sign-in request cancelled.");
      } else {
        setLoginError("Login failed. Please try again.");
        console.error("Login error:", error);
      }
      setTimeout(() => setLoginError(null), 5000);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-900/90 backdrop-blur-md"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 40 }}
            className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#5A5A40] rounded-xl flex items-center justify-center text-white shadow-lg">
                  <Palette size={24} />
                </div>
                <div>
                  <h3 className="serif text-2xl">Start with Design</h3>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">AI-Powered Design Briefing</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-zinc-200 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 md:p-12">
              {!user ? (
                <div className="text-center py-20">
                  <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-8 text-zinc-300">
                    <UserIcon size={40} />
                  </div>
                  <h4 className="serif text-3xl mb-4">Authentication Required</h4>
                  <p className="text-zinc-500 mb-8 max-w-sm mx-auto">Please login with your Google account to use our AI design features and save your briefs.</p>
                  
                  {loginError && (
                    <p className="text-red-500 text-[10px] uppercase tracking-widest font-bold mb-4">{loginError}</p>
                  )}

                  <button 
                    onClick={handleLogin}
                    className="px-10 py-4 bg-zinc-900 text-white rounded-md text-xs uppercase tracking-widest font-bold hover:bg-[#5A5A40] transition-all shadow-xl"
                  >
                    Login to Continue
                  </button>
                </div>
              ) : (
                <>
                  {step === 1 && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-10">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-4">
                          <label className="text-[11px] uppercase tracking-widest text-zinc-400 font-bold">Project Type</label>
                          <div className="grid grid-cols-2 gap-3">
                            {['Residential', 'Commercial', 'Hospitality', 'Retail'].map(type => (
                              <button 
                                key={type}
                                onClick={() => setFormData({...formData, projectType: type})}
                                className={`py-4 rounded-xl border-2 text-xs font-bold transition-all ${
                                  formData.projectType === type ? 'border-[#5A5A40] bg-[#5A5A40]/5 text-[#5A5A40]' : 'border-zinc-100 hover:border-zinc-200 text-zinc-500'
                                }`}
                              >
                                {type}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-4">
                          <label className="text-[11px] uppercase tracking-widest text-zinc-400 font-bold">Budget Range</label>
                          <div className="grid grid-cols-2 gap-3">
                            {['10L - 25L', '25L - 50L', '50L - 1Cr', '1Cr+'].map(range => (
                              <button 
                                key={range}
                                onClick={() => setFormData({...formData, budget: range})}
                                className={`py-4 rounded-xl border-2 text-xs font-bold transition-all ${
                                  formData.budget === range ? 'border-[#5A5A40] bg-[#5A5A40]/5 text-[#5A5A40]' : 'border-zinc-100 hover:border-zinc-200 text-zinc-500'
                                }`}
                              >
                                {range}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button 
                          disabled={!formData.projectType || !formData.budget}
                          onClick={() => setStep(2)}
                          className="px-12 py-4 bg-zinc-900 text-white rounded-md text-xs uppercase tracking-widest font-bold hover:bg-[#5A5A40] transition-all disabled:opacity-50"
                        >
                          Next Step
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-10">
                      <div className="space-y-8">
                        <div className="space-y-4">
                          <label className="text-[11px] uppercase tracking-widest text-zinc-400 font-bold">Design Theme</label>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                              { id: 'Minimalist', img: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&q=80&w=300' },
                              { id: 'Classical', img: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&q=80&w=300' },
                              { id: 'Industrial', img: 'https://images.unsplash.com/photo-1600607687940-c52af096999c?auto=format&fit=crop&q=80&w=300' },
                              { id: 'Bohemian', img: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&q=80&w=300' }
                            ].map(theme => (
                              <button 
                                key={theme.id}
                                onClick={() => setFormData({...formData, theme: theme.id})}
                                className={`relative aspect-square rounded-xl overflow-hidden border-4 transition-all ${
                                  formData.theme === theme.id ? 'border-[#5A5A40]' : 'border-transparent'
                                }`}
                              >
                                <img src={theme.img} alt={theme.id} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                  <span className="text-white text-[10px] uppercase tracking-widest font-bold">{theme.id}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-4">
                          <label className="text-[11px] uppercase tracking-widest text-zinc-400 font-bold">Specific Requirements</label>
                          <textarea 
                            value={formData.requirements}
                            onChange={(e) => setFormData({...formData, requirements: e.target.value})}
                            rows={4}
                            className="w-full px-6 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:border-[#5A5A40] focus:bg-white transition-all text-sm"
                            placeholder="Describe your vision, specific rooms, or must-have features..."
                          />
                        </div>
                      </div>
                      {error && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-[10px] uppercase tracking-widest font-bold text-center">
                          {error}
                        </div>
                      )}

                      <div className="flex justify-between">
                        <button onClick={() => setStep(1)} className="px-8 py-4 text-zinc-400 text-xs uppercase tracking-widest font-bold hover:text-zinc-900 transition-all">Back</button>
                        <button 
                          disabled={isGenerating || !formData.theme}
                          onClick={handleGenerate}
                          className="px-12 py-4 bg-[#5A5A40] text-white rounded-md text-xs uppercase tracking-widest font-bold hover:bg-zinc-900 transition-all flex items-center gap-3"
                        >
                          {isGenerating ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                          Generate Brief
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {step === 3 && generatedBrief && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-10">
                      <div className="bg-zinc-900 rounded-3xl p-10 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-[#5A5A40]/20 blur-[100px] rounded-full" />
                        <div className="relative z-10">
                          <h4 className="serif text-4xl mb-6">{generatedBrief.title}</h4>
                          <p className="text-white/60 font-light leading-relaxed mb-10 max-w-2xl">{generatedBrief.concept}</p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            <div className="space-y-6">
                              <h5 className="text-[10px] uppercase tracking-widest text-[#5A5A40] font-bold">Key Features</h5>
                              <ul className="space-y-4">
                                {generatedBrief.keyFeatures.map((f: string, i: number) => (
                                  <li key={i} className="flex items-center gap-3 text-sm font-light text-white/80">
                                    <CheckCircle2 size={16} className="text-[#5A5A40]" />
                                    {f}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="space-y-6">
                              <h5 className="text-[10px] uppercase tracking-widest text-[#5A5A40] font-bold">Color Palette</h5>
                              <div className="flex gap-3">
                                {generatedBrief.colorPalette.map((c: string, i: number) => (
                                  <div key={i} className="group relative">
                                    <div className="w-12 h-12 rounded-full border border-white/10 shadow-lg" style={{ backgroundColor: c }} />
                                    <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[8px] opacity-0 group-hover:opacity-100 transition-opacity">{c}</span>
                                  </div>
                                ))}
                              </div>
                              <h5 className="text-[10px] uppercase tracking-widest text-[#5A5A40] font-bold mt-8">Recommended Materials</h5>
                              <div className="flex flex-wrap gap-2">
                                {generatedBrief.recommendedMaterials.map((m: string, i: number) => (
                                  <span key={i} className="px-4 py-2 bg-white/5 rounded-full text-[10px] font-bold border border-white/10">{m}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap justify-center gap-6">
                        <button className="flex items-center gap-3 px-8 py-4 bg-zinc-900 text-white rounded-md text-xs uppercase tracking-widest font-bold hover:bg-[#5A5A40] transition-all">
                          <Download size={16} /> Download PDF
                        </button>
                        <button className="flex items-center gap-3 px-8 py-4 border border-zinc-200 text-zinc-900 rounded-md text-xs uppercase tracking-widest font-bold hover:bg-zinc-50 transition-all">
                          <Printer size={16} /> Print Brief
                        </button>
                        <button className="flex items-center gap-3 px-8 py-4 border border-zinc-200 text-zinc-900 rounded-md text-xs uppercase tracking-widest font-bold hover:bg-zinc-50 transition-all">
                          <Share2 size={16} /> Share
                        </button>
                      </div>

                      <div className="text-center pt-10 border-t border-zinc-100">
                        <p className="text-zinc-400 text-xs mb-6">Ready to bring this vision to life?</p>
                        <button 
                          onClick={() => { onClose(); onBookConsultation(); }}
                          className="px-12 py-5 bg-[#5A5A40] text-white rounded-md text-xs uppercase tracking-widest font-bold hover:bg-zinc-900 transition-all shadow-xl"
                        >
                          Book Consultation
                        </button>
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};


const ContactVerification = ({ contact, onVerified, onCancel }: { contact: string, onVerified: () => void, onCancel: () => void }) => {
  const [otp, setOtp] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = async () => {
    setIsSending(true);
    setError('');
    try {
      const response = await robustFetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact }),
      });
      
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !contentType.includes("application/json")) {
        setError("Failed to send verification code. Server returned an invalid response.");
        return;
      }
      
      const data = await response.json();
      if (!data.success) {
        setError(data.message || "Failed to send verification code.");
      }
    } catch (err) {
      setError('Failed to send OTP.');
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    setIsVerifying(true);
    setError('');
    try {
      const response = await robustFetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact, otp }),
      });
      
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !contentType.includes("application/json")) {
        setError("Failed to verify code. Server returned an invalid response.");
        return;
      }
      
      const data = await response.json();
      if (data.success) {
        onVerified();
      } else {
        setError(data.message || "Invalid verification code.");
      }
    } catch (err) {
      setError('Failed to verify OTP.');
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    handleSendOtp();
  }, []);

  return (
    <div className="space-y-6 py-4">
      <div className="text-center">
        <div className="w-16 h-16 bg-[#5A5A40]/10 text-[#5A5A40] rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldCheck size={32} />
        </div>
        <h3 className="serif text-2xl mb-2">Verify Your Contact</h3>
        <p className="text-zinc-500 text-sm">We've sent a 6-digit verification code to <span className="font-bold text-zinc-900">{contact}</span></p>
      </div>

      <div className="space-y-4">
        <div className="flex justify-center gap-2">
          <input 
            type="text"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            className="w-full max-w-[200px] px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg text-center text-2xl tracking-[0.5em] font-bold focus:border-[#5A5A40] outline-none transition-all"
            placeholder="000000"
          />
        </div>
        {error && <p className="text-red-500 text-[10px] uppercase tracking-widest font-bold text-center">{error}</p>}
        
        <div className="flex flex-col gap-3 mt-8">
          <button 
            onClick={handleVerifyOtp}
            disabled={isVerifying || otp.length !== 6}
            className="w-full py-4 bg-zinc-900 text-white rounded-lg font-bold uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:bg-[#5A5A40] transition-all disabled:opacity-50"
          >
            {isVerifying ? <Loader2 className="animate-spin" size={18} /> : "Verify & Submit"}
          </button>
          <button 
            onClick={onCancel}
            className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 hover:text-zinc-900 transition-colors"
          >
            Cancel
          </button>
        </div>
        
        <p className="text-center text-[10px] text-zinc-400 uppercase tracking-widest">
          Didn't receive the code? <button onClick={handleSendOtp} disabled={isSending} className="text-[#5A5A40] font-bold hover:underline">Resend</button>
        </p>
      </div>
    </div>
  );
};

const AI3DVisualizer = ({ isOpen, onClose, user, onOpenAuth }: { isOpen: boolean, onClose: () => void, user: any, onOpenAuth: () => void }) => {
  const [step, setStep] = useState(1);
  const [layout, setLayout] = useState<string | null>(null);
  const [theme, setTheme] = useState('Modern Luxury');
  const [finish, setFinish] = useState('Premium Wood & Marble');
  const [budget, setBudget] = useState('Luxury');
  const [details, setDetails] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('3d');

  const themes = [
    { name: 'Modern Luxury', image: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&q=80&w=400' },
    { name: 'Classical Elegance', image: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&q=80&w=400' },
    { name: 'Industrial Chic', image: 'https://images.unsplash.com/photo-1536376074432-a228d0a59cf4?auto=format&fit=crop&q=80&w=400' },
    { name: 'Bohemian Retreat', image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=400' },
    { name: 'Minimalist Zen', image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=400' },
    { name: 'Art Deco', image: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&q=80&w=400' }
  ];
  const finishes = [
    { name: 'Premium Wood & Marble', image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=400' },
    { name: 'Metallic & Glass', image: 'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&q=80&w=400' },
    { name: 'Stone & Concrete', image: 'https://images.unsplash.com/photo-1516455590571-18256e5bb9ff?auto=format&fit=crop&q=80&w=400' },
    { name: 'Velvet & Gold Accents', image: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&q=80&w=400' }
  ];
  const budgets = ['Premium', 'Luxury', 'Ultra-Luxury'];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLayout(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleGenerate = async () => {
    if (!layout) return;
    setIsGenerating(true);
    setError(null);

    try {
      const res = await robustFetch("/api/gemini/visualize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          layoutBase64: layout,
          theme,
          finish
        })
      });

      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      if (!data.success || !data.imageBase64) {
        throw new Error(data.message || "Failed to generate visualization");
      }

      setGeneratedImage(data.imageBase64);
      setStep(3);
    } catch (err: any) {
      console.error(err);
      setError("An error occurred during visualization. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(formData.email)) {
      setError("Please enter a valid email address.");
      return;
    }
    await handleVerified();
  };

  const handleVerified = async () => {
    try {
      // Save to Firestore
      await addDoc(collection(db, 'visualizations'), {
        uid: user.uid,
        ...formData,
        theme,
        finish,
        budget,
        details,
        layout: layout, // Base64 for now, ideally upload to storage
        generatedImage: generatedImage,
        createdAt: serverTimestamp()
      });

      // Also notify server
      await robustFetch('/api/visualizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          projectType: '3D Visualization',
          theme,
          budget,
          details
        })
      });

      setIsSubmitted(true);
      setShowVerification(false);
    } catch (err) {
      console.error(err);
      setError("Failed to submit. Please try again.");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-900/90 backdrop-blur-md"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 40 }}
            className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center text-white shadow-lg">
                  <Layers size={24} />
                </div>
                <div>
                  <h3 className="serif text-2xl">AI 3D Visualizer</h3>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Transform Your Layout into Reality</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-zinc-200 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 md:p-12">
              {!user ? (
                <div className="text-center py-20">
                  <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-8 text-zinc-300">
                    <UserIcon size={40} />
                  </div>
                  <h4 className="serif text-3xl mb-4">Authentication Required</h4>
                  <p className="text-zinc-500 mb-8 max-w-sm mx-auto">Please login to use our AI 3D visualization tool.</p>
                  <button 
                    onClick={onOpenAuth}
                    className="px-10 py-4 bg-zinc-900 text-white rounded-md text-xs uppercase tracking-widest font-bold hover:bg-[#5A5A40] transition-all shadow-xl"
                  >
                    Login to Continue
                  </button>
                </div>
              ) : (
                <div className="max-w-4xl mx-auto">
                  {step === 1 && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
                      <div className="text-center">
                        <h4 className="serif text-4xl mb-4">Upload Your Layout</h4>
                        <p className="text-zinc-500">Upload a floor plan, sketch, or image of your room to begin.</p>
                      </div>

                      <div className="relative group">
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleFileUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className={`border-2 border-dashed rounded-3xl p-16 text-center transition-all ${layout ? 'border-[#5A5A40] bg-zinc-50' : 'border-zinc-200 group-hover:border-zinc-400'}`}>
                          {layout ? (
                            <div className="space-y-4">
                              <img src={layout} alt="Layout Preview" className="max-h-64 mx-auto rounded-xl shadow-lg" />
                              <p className="text-[#5A5A40] font-bold text-xs uppercase tracking-widest">Layout Uploaded Successfully</p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-400 group-hover:scale-110 transition-transform">
                                <Upload size={32} />
                              </div>
                              <p className="text-zinc-400">Click or drag and drop your file here</p>
                              <p className="text-[10px] text-zinc-300 uppercase tracking-widest">PNG, JPG up to 10MB</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-center">
                        <button 
                          disabled={!layout}
                          onClick={() => setStep(2)}
                          className={`px-12 py-5 rounded-md text-xs uppercase tracking-widest font-bold transition-all shadow-xl ${layout ? 'bg-zinc-900 text-white hover:bg-[#5A5A40]' : 'bg-zinc-100 text-zinc-300 cursor-not-allowed'}`}
                        >
                          Next: Choose Style
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-12">
                      <div className="grid md:grid-cols-2 gap-12">
                        <div className="space-y-8">
                          <div>
                            <label className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-6 block">Design Theme</label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                              {themes.map(t => (
                                <button
                                  key={t.name}
                                  onClick={() => setTheme(t.name)}
                                  className={`group relative aspect-square rounded-2xl overflow-hidden border-2 transition-all ${theme === t.name ? 'border-[#5A5A40] ring-4 ring-[#5A5A40]/10' : 'border-transparent hover:border-zinc-200'}`}
                                >
                                  <img src={t.image} alt={t.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" referrerPolicy="no-referrer" />
                                  <div className={`absolute inset-0 flex items-end p-3 transition-colors ${theme === t.name ? 'bg-zinc-900/40' : 'bg-black/20 group-hover:bg-black/40'}`}>
                                    <p className="text-[10px] font-bold text-white uppercase tracking-wider">{t.name}</p>
                                  </div>
                                  {theme === t.name && (
                                    <div className="absolute top-2 right-2 w-5 h-5 bg-[#5A5A40] rounded-full flex items-center justify-center text-white">
                                      <CheckCircle2 size={12} />
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-6 block">Material Finish</label>
                            <div className="grid grid-cols-2 gap-4">
                              {finishes.map(f => (
                                <button
                                  key={f.name}
                                  onClick={() => setFinish(f.name)}
                                  className={`group relative h-24 rounded-2xl overflow-hidden border-2 transition-all ${finish === f.name ? 'border-[#5A5A40] ring-4 ring-[#5A5A40]/10' : 'border-transparent hover:border-zinc-200'}`}
                                >
                                  <img src={f.image} alt={f.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" referrerPolicy="no-referrer" />
                                  <div className={`absolute inset-0 flex items-center justify-center p-3 transition-colors ${finish === f.name ? 'bg-zinc-900/40' : 'bg-black/20 group-hover:bg-black/40'}`}>
                                    <p className="text-[10px] font-bold text-white uppercase tracking-wider text-center">{f.name}</p>
                                  </div>
                                  {finish === f.name && (
                                    <div className="absolute top-2 right-2 w-5 h-5 bg-[#5A5A40] rounded-full flex items-center justify-center text-white">
                                      <CheckCircle2 size={12} />
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-8">
                          <div>
                            <label className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-4 block">Budget Range</label>
                            <div className="flex gap-3">
                              {budgets.map(b => (
                                <button
                                  key={b}
                                  onClick={() => setBudget(b)}
                                  className={`flex-1 p-4 text-center rounded-xl border transition-all ${budget === b ? 'border-zinc-900 bg-zinc-900 text-white shadow-lg' : 'border-zinc-100 hover:border-zinc-300'}`}
                                >
                                  <p className="text-xs font-bold">{b}</p>
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-4 block">Additional Details</label>
                            <textarea 
                              value={details}
                              onChange={(e) => setDetails(e.target.value)}
                              placeholder="Describe any specific requirements or preferences..."
                              className="w-full p-6 bg-zinc-50 border border-zinc-100 rounded-2xl h-40 focus:outline-none focus:border-zinc-900 transition-colors text-sm"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-8 border-t border-zinc-100">
                        <button onClick={() => setStep(1)} className="text-zinc-400 text-xs uppercase tracking-widest font-bold hover:text-zinc-900">Back</button>
                        <button 
                          onClick={handleGenerate}
                          disabled={isGenerating}
                          className="px-12 py-5 bg-zinc-900 text-white rounded-md text-xs uppercase tracking-widest font-bold hover:bg-[#5A5A40] transition-all shadow-xl flex items-center gap-3"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="animate-spin" size={16} />
                              Generating Visualization...
                            </>
                          ) : (
                            <>
                              <Sparkles size={16} />
                              Generate 3D View
                            </>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {step === 3 && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-12">
                      <div className="text-center">
                        <h4 className="serif text-4xl mb-4">Your 3D Visualization</h4>
                        <p className="text-zinc-500">A customized vision for your space based on your layout and preferences.</p>
                      </div>

                      {/* Studio Interactive View Toggles */}
                      <div className="flex justify-center">
                        <div className="inline-flex p-1.5 bg-zinc-100 rounded-2xl border border-zinc-200/50 shadow-sm">
                          <button 
                            onClick={() => setViewMode('3d')}
                            className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 flex items-center gap-2 ${
                              viewMode === '3d' 
                                ? "bg-zinc-900 text-white shadow-xl" 
                                : "text-zinc-500 hover:text-zinc-900"
                            }`}
                          >
                            <Rotate3d size={13} />
                            Interactive 3D Sandbox
                          </button>
                          <button 
                            onClick={() => setViewMode('2d')}
                            className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 flex items-center gap-2 ${
                              viewMode === '2d' 
                                ? "bg-zinc-900 text-white shadow-xl" 
                                : "text-zinc-500 hover:text-zinc-900"
                            }`}
                          >
                            <ImageIcon size={13} />
                            2D Luxury Render
                          </button>
                        </div>
                      </div>

                      {/* View Canvas Container */}
                      {viewMode === '3d' ? (
                        <ThreeDViewer theme={theme} finish={finish} budget={budget} />
                      ) : (
                        <div className="relative rounded-3xl overflow-hidden shadow-2xl group border border-zinc-100">
                          <img 
                            src={generatedImage!} 
                            alt="Generated Visualization" 
                            className="w-full aspect-video object-cover pointer-events-none select-none"
                            onContextMenu={(e) => e.preventDefault()}
                          />
                          {/* Watermark */}
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20 rotate-[-30deg]">
                            <p className="text-white text-6xl font-bold uppercase tracking-[1em]">RR Inside Out</p>
                          </div>
                          <div className="absolute bottom-8 right-8 bg-white/90 backdrop-blur-md px-6 py-3 rounded-full shadow-lg flex items-center gap-3">
                            <div className="w-8 h-8 bg-zinc-900 rounded flex items-center justify-center text-white font-bold text-xs">RR</div>
                            <p className="text-zinc-900 text-[10px] uppercase tracking-widest font-bold">RR Inside Out Creation</p>
                          </div>
                          
                          {/* Protection Overlay */}
                          <div className="absolute inset-0 bg-transparent z-20" />
                        </div>
                      )}

                      {/* Informational Section: Explaining the 3D Generation Process Flow */}
                      <div className="bg-zinc-900 text-zinc-100 rounded-3xl p-8 md:p-12 border border-zinc-800 shadow-xl overflow-hidden relative">
                        {/* Abstract background graphics */}
                        <div className="absolute -right-16 -top-16 w-64 h-64 bg-[#5A5A40]/10 rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-zinc-800/20 rounded-full blur-3xl pointer-events-none" />

                        <div className="relative z-10">
                          <div className="flex items-center gap-3.5 mb-6">
                            <div className="w-10 h-10 bg-[#5A5A40]/30 border border-[#5A5A40]/50 rounded-xl flex items-center justify-center text-white">
                              <Sparkles size={18} className="text-amber-300 animate-pulse" />
                            </div>
                            <div>
                              <h5 className="serif text-xl md:text-2xl text-white">How 3D Model Generation Works</h5>
                              <p className="text-[10px] uppercase tracking-widest text-[#A8A890] font-bold">Step-by-Step Production Roadmap</p>
                            </div>
                          </div>

                          <p className="text-zinc-400 text-xs md:text-sm leading-relaxed mb-10 max-w-3xl">
                            In a live production setting, transforming a custom sketch or layout into a navigable 1:1 scale 3D space is achieved through an automated cloud spatial pipeline. Here is the architecture we utilize to integrate this capability on your platform:
                          </p>

                          <div className="grid md:grid-cols-4 gap-6 relative">
                            {/* Horizontal connect lines on desktop */}
                            <div className="hidden md:block absolute top-7 left-12 right-12 h-0.5 bg-gradient-to-r from-zinc-800 via-[#5A5A40]/30 to-zinc-800 z-0" />

                            <div className="relative z-10 flex flex-col items-start bg-zinc-950/40 p-5 rounded-2xl border border-zinc-800/60 hover:border-[#5A5A40]/40 transition-colors">
                              <div className="w-10 h-10 bg-zinc-900 border border-zinc-750 rounded-xl flex items-center justify-center text-[#A8A890] mb-4 shadow">
                                <FileText size={16} />
                              </div>
                              <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold mb-1">STEP 01</span>
                              <h6 className="text-xs font-bold text-white mb-2">Upload Layout</h6>
                              <p className="text-zinc-400 text-[11px] leading-relaxed">
                                Client uploads a 2D floorplan, handmade pencil sketch, or CAD elevation layout via the secure drag-and-drop workspace uploader.
                              </p>
                            </div>

                            <div className="relative z-10 flex flex-col items-start bg-zinc-950/40 p-5 rounded-2xl border border-zinc-800/60 hover:border-[#5A5A40]/40 transition-colors">
                              <div className="w-10 h-10 bg-zinc-900 border border-zinc-750 rounded-xl flex items-center justify-center text-[#A8A890] mb-4 shadow">
                                <Compass size={16} />
                              </div>
                              <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold mb-1">STEP 02</span>
                              <h6 className="text-xs font-bold text-white mb-2">Spatial Analysis</h6>
                              <p className="text-zinc-400 text-[11px] leading-relaxed">
                                Gemini Vision API parses structural coordinate nodes, identifying door/window frames, load barriers, and ceiling bounding volumes.
                              </p>
                            </div>

                            <div className="relative z-10 flex flex-col items-start bg-zinc-950/40 p-5 rounded-2xl border border-zinc-800/60 hover:border-[#5A5A40]/40 transition-colors">
                              <div className="w-10 h-10 bg-zinc-900 border border-zinc-750 rounded-xl flex items-center justify-center text-[#A8A890] mb-4 shadow">
                                <Layers size={16} />
                              </div>
                              <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold mb-1">STEP 03</span>
                              <h6 className="text-xs font-bold text-white mb-2">Mesh Synthesis</h6>
                              <p className="text-zinc-400 text-[11px] leading-relaxed">
                                API requests to generative models (e.g., Tripo3D, Meshy) convert visual geometry into an asset pack containing standard <strong className="text-zinc-200">.gltf / .obj</strong> formats.
                              </p>
                            </div>

                            <div className="relative z-10 flex flex-col items-start bg-zinc-950/40 p-5 rounded-2xl border border-zinc-800/60 hover:border-[#5A5A40]/40 transition-colors">
                              <div className="w-10 h-10 bg-zinc-900 border border-zinc-750 rounded-xl flex items-center justify-center text-[#A8A890] mb-4 shadow">
                                <Rotate3d size={16} />
                              </div>
                              <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold mb-1">STEP 04</span>
                              <h6 className="text-xs font-bold text-white mb-2">Interactive Display</h6>
                              <p className="text-zinc-400 text-[11px] leading-relaxed">
                                Three.js or Google’s glTF orbit-viewer initializes client-side, enabling full pitch/orbit camera control, layout walk-throughs, and finish customization.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {isSubmitted ? (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="bg-emerald-50 rounded-3xl p-16 text-center border border-emerald-100"
                        >
                          <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center text-white mx-auto mb-8 shadow-lg shadow-emerald-200">
                            <CheckCircle2 size={40} />
                          </div>
                          <h5 className="serif text-4xl text-emerald-900 mb-4">Request Received!</h5>
                          <p className="text-emerald-700 max-w-md mx-auto leading-relaxed">
                            Thank you for your interest. Our design consultants have received your visualization and will contact you within 24 hours to discuss your project.
                          </p>
                          <button 
                            onClick={onClose}
                            className="mt-10 px-8 py-3 bg-emerald-600 text-white rounded-md text-[10px] uppercase tracking-widest font-bold hover:bg-emerald-700 transition-all"
                          >
                            Close Studio
                          </button>
                        </motion.div>
                      ) : showVerification ? (
                        <div className="bg-zinc-50 rounded-3xl p-12">
                          <ContactVerification 
                            contact={formData.email} 
                            onVerified={handleVerified} 
                            onCancel={() => setShowVerification(false)} 
                          />
                        </div>
                      ) : (
                        <div className="bg-zinc-50 rounded-3xl p-12">
                          <div className="text-center mb-10">
                            <h5 className="serif text-2xl mb-2">Save This Design</h5>
                            <p className="text-zinc-500 text-sm">Enter your details to receive this visualization and a professional consultation.</p>
                          </div>

                          <form onSubmit={handleSubmit} className="grid md:grid-cols-3 gap-6">
                            <input 
                              required
                              type="text"
                              placeholder="Your Name"
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              className="w-full p-4 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-900 transition-colors"
                            />
                            <input 
                              required
                              type="email"
                              placeholder="Email Address"
                              value={formData.email}
                              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                              className="w-full p-4 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-900 transition-colors"
                            />
                            <input 
                              required
                              type="tel"
                              placeholder="Phone Number"
                              value={formData.phone}
                              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                              className="w-full p-4 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-900 transition-colors"
                            />
                            <div className="md:col-span-3 flex justify-center mt-4">
                              <button 
                                type="submit"
                                className="px-12 py-5 bg-zinc-900 text-white rounded-md text-xs uppercase tracking-widest font-bold hover:bg-[#5A5A40] transition-all shadow-xl"
                              >
                                Submit & Save Design
                              </button>
                            </div>
                          </form>
                          {error && <p className="text-red-500 text-center mt-4 text-xs uppercase tracking-widest font-bold">{error}</p>}
                        </div>
                      )}

                      <div className="flex justify-center">
                        <button onClick={() => setStep(2)} className="text-zinc-400 text-xs uppercase tracking-widest font-bold hover:text-zinc-900">Back to Styles</button>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const AuthModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showVerification, setShowVerification] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        role: user.email === "kumawatshanu22@gmail.com" ? 'admin' : 'client',
        lastLogin: serverTimestamp()
      }, { merge: true });
      
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onClose();
    } catch (err: any) {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) {
      setError("All fields are required.");
      return;
    }
    await handleVerified();
  };

  const handleVerified = async () => {
    setLoading(true);
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });
      
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: name,
        role: 'client',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      });
      
      onClose();
    } catch (err: any) {
      setError(err.message);
      setShowVerification(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-900/80 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden p-8 md:p-10"
          >
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 p-2 hover:bg-zinc-100 rounded-full transition-colors"
            >
              <X size={20} />
            </button>

            {showVerification ? (
              <ContactVerification 
                contact={email} 
                onVerified={handleVerified} 
                onCancel={() => setShowVerification(false)} 
              />
            ) : (
              <>
                <div className="text-center mb-8">
                  <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center text-white mx-auto mb-4">
                    <UserIcon size={24} />
                  </div>
                  <h3 className="serif text-2xl mb-2">{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h3>
                  <p className="text-zinc-500 text-sm">
                    {mode === 'login' ? 'Enter your credentials to access your account' : 'Join RR Inside Out for a bespoke design experience'}
                  </p>
                </div>

                <div className="space-y-4">
                  <button 
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full py-3 px-4 border border-zinc-200 rounded-lg flex items-center justify-center gap-3 hover:bg-zinc-50 transition-all text-sm font-bold text-zinc-700"
                  >
                    <Globe size={18} className="text-blue-500" />
                    Continue with Google
                  </button>

                  <div className="relative py-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-zinc-100"></div>
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold">
                      <span className="bg-white px-4 text-zinc-400">Or continue with email</span>
                    </div>
                  </div>

                  <form onSubmit={mode === 'login' ? handleEmailLogin : handleSignUpStart} className="space-y-4">
                    {mode === 'signup' && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Full Name</label>
                        <input 
                          required
                          type="text" 
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:border-[#5A5A40] focus:bg-white outline-none transition-all text-sm"
                          placeholder="John Doe"
                        />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Email Address</label>
                      <input 
                        required
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:border-[#5A5A40] focus:bg-white outline-none transition-all text-sm"
                        placeholder="name@example.com"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Password</label>
                      <input 
                        required
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:border-[#5A5A40] focus:bg-white outline-none transition-all text-sm"
                        placeholder="••••••••"
                      />
                    </div>

                    {error && <p className="text-red-500 text-[10px] uppercase tracking-widest font-bold text-center">{error}</p>}

                    <button 
                      type="submit"
                      disabled={loading}
                      className="w-full py-4 bg-zinc-900 text-white rounded-lg font-bold uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:bg-[#5A5A40] transition-all shadow-lg"
                    >
                      {loading ? <Loader2 className="animate-spin" size={18} /> : (mode === 'login' ? 'Login' : 'Sign Up')}
                    </button>
                  </form>

                  <div className="text-center pt-4">
                    <button 
                      onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                      className="text-[11px] uppercase tracking-widest font-bold text-zinc-400 hover:text-zinc-900 transition-colors"
                    >
                      {mode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Login"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const Navbar = ({ onEnquire, onStartDesign, onStartVisualizer, user, onOpenAdmin, onOpenAuth, onOpenReferral, onOpenVendor, onOpenCareers }: { onEnquire: () => void, onStartDesign: () => void, onStartVisualizer: () => void, user: any, onOpenAdmin: () => void, onOpenAuth: () => void, onOpenReferral: () => void, onOpenVendor: () => void, onOpenCareers: () => void }) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const linkClass = `transition-all duration-350 hover:-translate-y-[1px] py-1 text-[9px] xl:text-[10px] font-sans font-semibold uppercase tracking-[0.14em] xl:tracking-[0.2em] flex items-center gap-1 cursor-pointer bg-transparent border-0 outline-none select-none ${
    scrolled ? "text-zinc-500 hover:text-zinc-950" : "text-white/70 hover:text-white"
  }`;

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ease-out px-4 xl:px-16 ${
      scrolled 
        ? "py-3.5 champagne-blur shadow-lg/5 border-b border-zinc-200/40" 
        : "py-7 bg-transparent border-b border-transparent"
    }`}>
      <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4">
        {/* Logo Section Column - Flex-1 and min-w responsive to guarantee no overlap */}
        <div className="flex-1 flex items-center justify-start shrink-0 min-w-0 md:min-w-[270px] lg:min-w-[310px]">
          <div className="cursor-pointer group flex items-center" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <RRBrandLogo scrolled={scrolled} className="h-10 md:h-[46px] lg:h-[48px] transition-all duration-300 transform group-hover:scale-[1.01]" />
          </div>
        </div>

        {/* Navigation Links Column - Balanced Middle Space */}
        <div className="hidden lg:flex gap-2.5 xl:gap-5 items-center justify-center flex-initial mx-2 shrink-0">
          <a href="#" className={linkClass}>Home</a>
          <a href="#about" className={linkClass}>About</a>
          <a href="#services" className={linkClass}>Services</a>
          <a href="#projects" className={linkClass}>Portfolio</a>
          
          <button 
            onClick={onStartVisualizer} 
            className={linkClass}
          >
            <Sparkles size={11} className={`${scrolled ? "text-[#5A5A40]" : "text-[#d1d1b5]"} transition-all`} />
            AI Visualizer
          </button>
          
          <button 
            onClick={onOpenReferral}
            className={`${linkClass} hover:text-emerald-500`}
          >
            <Coins size={11} className={`${scrolled ? "text-emerald-600" : "text-emerald-450"} transition-all`} />
            Refer & Earn
          </button>
 
          <button 
            onClick={onOpenVendor}
            className={`${linkClass} hover:text-amber-500`}
          >
            <UserPlus size={11} className={`${scrolled ? "text-amber-600" : "text-amber-450"} transition-all`} />
            Vendor Hub
          </button>
 
          <button 
            onClick={onOpenCareers}
            className={`${linkClass} hover:text-indigo-500`}
          >
            <Briefcase size={11} className={`${scrolled ? "text-indigo-600" : "text-indigo-400"} transition-all`} />
            Careers
          </button>
 
          <a href="#contact" className={linkClass}>Contact</a>
        </div>
 
        {/* Actions Section Column - Flex-1 and min-w responsive to guarantee symmetry */}
        <div className="flex-1 flex items-center justify-end shrink-0 min-w-0 md:min-w-[210px] lg:min-w-[250px] gap-2 md:gap-4">
          
          <div className="flex items-center gap-2">
            <button 
              onClick={onEnquire}
              className={`px-5 py-2.5 text-[9px] uppercase tracking-widest font-bold rounded-sm transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
                scrolled 
                  ? "bg-zinc-900 text-white hover:bg-[#5A5A40] shadow-md shadow-zinc-900/10" 
                  : "bg-white text-zinc-900 hover:bg-[#5A5A40] hover:text-white border border-white/25"
              }`}
            >
              Get Estimate
            </button>
          </div>

          {user ? (
            <div className="relative">
              <button 
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className={`w-9 h-9 rounded-full overflow-hidden border transition-all flex items-center justify-center bg-zinc-50 ${
                  scrolled ? "border-zinc-200 hover:border-[#5A5A40]" : "border-white/20 hover:border-white"
                }`}
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                ) : (
                  <UserIcon size={16} className="text-zinc-400" />
                )}
              </button>
              <AnimatePresence>
                {isUserMenuOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-zinc-100 py-2 z-[60]"
                  >
                    <div className="px-4 py-2 border-b border-zinc-50">
                      <p className="text-xs font-bold text-zinc-900 truncate">{user.displayName}</p>
                      <p className="text-[10px] text-zinc-400 truncate">{user.email}</p>
                    </div>
                    {user.email === "kumawatshanu22@gmail.com" && (
                      <button 
                        onClick={() => {
                          onOpenAdmin();
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50 flex items-center gap-2 transition-colors"
                      >
                        <LayoutDashboard size={14} />
                        Admin Dashboard
                      </button>
                    )}
                    <button 
                      onClick={() => signOut(auth)}
                      className="w-full px-4 py-2 text-left text-xs text-red-500 hover:bg-red-50 flex items-center gap-2 transition-colors"
                    >
                      <LogOut size={14} />
                      Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <button 
              onClick={onOpenAuth}
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-all ${
                scrolled ? "bg-zinc-100 text-zinc-600 hover:bg-zinc-200" : "bg-white/10 text-white hover:bg-white/20 border border-white/10"
              }`}
              title="Login"
            >
              <UserIcon size={15} />
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

const EnquiryModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    projectType: 'Luxury Interior Design',
    projectScale: '3BHK',
    estimatedArea: '',
    budgetRange: '25-50L',
    timeline: '1-3 Months',
    location: '',
    details: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVerification, setShowVerification] = useState(false);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateEmail(formData.email)) {
      setError("Please enter a valid email address.");
      return;
    }

    await handleVerified();
  };

  const handleVerified = async () => {
    setIsSubmitting(true);
    try {
      const response = await robustFetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await response.json();
      if (result.success) {
        await addDoc(collection(db, 'enquiries'), {
          ...formData,
          createdAt: serverTimestamp()
        });
        setIsSubmitted(true);
        setTimeout(() => {
          onClose();
          setIsSubmitted(false);
          setShowVerification(false);
          setFormData({
            name: '',
            email: '',
            phone: '',
            projectType: 'Luxury Interior Design',
            projectScale: '3BHK',
            estimatedArea: '',
            budgetRange: '25-50L',
            timeline: '1-3 Months',
            location: '',
            details: ''
          });
        }, 3000);
      }
    } catch (error) {
      console.error("Submission error:", error);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-900/80 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="flex flex-col md:flex-row h-full">
              <div className="hidden md:block w-1/3 bg-[#5A5A40] p-10 text-white">
                <h3 className="serif text-3xl mb-6">Let's Talk</h3>
                <p className="text-white/70 text-sm font-light leading-relaxed mb-10">
                  Transform your space with India's leading luxury interior design firm.
                </p>
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                      <Phone size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest opacity-50">Call Us</p>
                      <p className="text-[11px] font-bold">+91 80059 87790</p>
                      <p className="text-[11px] font-bold">+91 86192 22683</p>
                      <p className="text-[11px] font-bold">+91 77019 96418</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                      <Mail size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest opacity-50">Email Us</p>
                      <p className="text-sm font-bold">rrinsideoutcreation@gmail.com</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-1 p-10 md:p-12">
                <button 
                  onClick={onClose}
                  className="absolute top-6 right-6 p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>

                {isSubmitted ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mx-auto mb-8">
                      <CheckCircle2 size={40} />
                    </div>
                    <h3 className="serif text-3xl mb-4">Request Sent</h3>
                    <p className="text-zinc-500 font-light">
                      Our design experts will contact you within 24 hours to discuss your project.
                    </p>
                  </div>
                ) : showVerification ? (
                  <ContactVerification 
                    contact={formData.email} 
                    onVerified={handleVerified} 
                    onCancel={() => setShowVerification(false)} 
                  />
                ) : (
                  <>
                    <h3 className="serif text-3xl mb-2">Enquire Now</h3>
                    <p className="text-zinc-400 text-sm font-light mb-8">Fill the form below to get a bespoke design consultation.</p>

                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Full Name</label>
                        <input 
                          required
                          type="text" 
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:border-[#5A5A40] focus:bg-white outline-none transition-all text-sm"
                          placeholder="Your Name"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Email</label>
                          <input 
                            required
                            type="email" 
                            value={formData.email}
                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:border-[#5A5A40] focus:bg-white outline-none transition-all text-sm"
                            placeholder="Email Address"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Phone</label>
                          <input 
                            required
                            type="tel" 
                            value={formData.phone}
                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:border-[#5A5A40] focus:bg-white outline-none transition-all text-sm"
                            placeholder="Phone Number"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Service Required</label>
                          <select 
                            value={formData.projectType}
                            onChange={(e) => setFormData({...formData, projectType: e.target.value})}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:border-[#5A5A40] focus:bg-white outline-none transition-all text-sm"
                          >
                            <option>Luxury Interior Design</option>
                            <option>Architectural Services</option>
                            <option>Turnkey Solutions</option>
                            <option>Bespoke Furniture</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Project Scale</label>
                          <select 
                            value={formData.projectScale}
                            onChange={(e) => setFormData({...formData, projectScale: e.target.value})}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:border-[#5A5A40] focus:bg-white outline-none transition-all text-sm"
                          >
                            <option>2BHK Apartment</option>
                            <option>3BHK Apartment</option>
                            <option>4BHK+ / Penthouse</option>
                            <option>Independent Villa</option>
                            <option>Commercial Space</option>
                            <option>Boutique Office</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Estimated Area (sq.ft)</label>
                          <input 
                            required
                            type="number" 
                            value={formData.estimatedArea}
                            onChange={(e) => setFormData({...formData, estimatedArea: e.target.value})}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:border-[#5A5A40] focus:bg-white outline-none transition-all text-sm"
                            placeholder="e.g. 1800"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Budget Range</label>
                          <select 
                            value={formData.budgetRange}
                            onChange={(e) => setFormData({...formData, budgetRange: e.target.value})}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:border-[#5A5A40] focus:bg-white outline-none transition-all text-sm"
                          >
                            <option>Under 10 Lacs</option>
                            <option>10 - 25 Lacs</option>
                            <option>25 - 50 Lacs</option>
                            <option>50 Lacs - 1 Cr</option>
                            <option>1 Cr +</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Timeline</label>
                          <select 
                            value={formData.timeline}
                            onChange={(e) => setFormData({...formData, timeline: e.target.value})}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:border-[#5A5A40] focus:bg-white outline-none transition-all text-sm"
                          >
                            <option>Immediate</option>
                            <option>1 - 3 Months</option>
                            <option>3 - 6 Months</option>
                            <option>Planning Stage</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Project Location</label>
                          <input 
                            required
                            type="text" 
                            value={formData.location}
                            onChange={(e) => setFormData({...formData, location: e.target.value})}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:border-[#5A5A40] focus:bg-white outline-none transition-all text-sm"
                            placeholder="e.g. DLF Phase 5, Gurgaon"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Additional Details</label>
                        <textarea 
                          required
                          rows={3}
                          value={formData.details}
                          onChange={(e) => setFormData({...formData, details: e.target.value})}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:border-[#5A5A40] focus:bg-white outline-none transition-all text-sm resize-none"
                          placeholder="Tell us more about your requirements..."
                        />
                      </div>

                      {error && <p className="text-red-500 text-[10px] uppercase tracking-widest font-bold mb-4">{error}</p>}

                      <button 
                        disabled={isSubmitting}
                        className="w-full py-4 bg-zinc-900 text-white rounded-lg font-bold uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:bg-[#5A5A40] transition-all disabled:opacity-50 shadow-lg"
                      >
                        {isSubmitting ? (
                          <Loader2 className="animate-spin" size={18} />
                        ) : (
                          <>
                            Send Message
                            <Send size={14} />
                          </>
                        )}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const ReferralModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [formData, setFormData] = useState({
    referrerName: '',
    referrerEmail: '',
    referrerPhone: '',
    referrerUpi: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    projectType: 'Luxury Interior Design',
    location: '',
    details: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateEmail(formData.referrerEmail)) {
      setError("Please enter a valid email address for yourself.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await robustFetch('/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await response.json();
      if (result.success) {
        await addDoc(collection(db, 'referrals'), {
          ...formData,
          createdAt: serverTimestamp()
        });
        setIsSubmitted(true);
        setTimeout(() => {
          onClose();
          setIsSubmitted(false);
          setFormData({
            referrerName: '',
            referrerEmail: '',
            referrerPhone: '',
            referrerUpi: '',
            clientName: '',
            clientEmail: '',
            clientPhone: '',
            projectType: 'Luxury Interior Design',
            location: '',
            details: ''
          });
        }, 3500);
      } else {
        setError(result.message || "Failed to submit referral. Please try again.");
      }
    } catch (error) {
      console.error("Referral submit error:", error);
      setError("Something went wrong. Please check your network and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-900/80 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            <div className="flex flex-col md:flex-row h-full">
              {/* Left Column Side Banner */}
              <div className="md:w-1/3 bg-[#5A5A40] p-10 text-white flex flex-col justify-between">
                <div>
                  <h3 className="serif text-3xl mb-6 leading-tight">Elite <br />Circle</h3>
                  <p className="text-white/70 text-xs font-light leading-relaxed mb-6">
                    Refer clients to RR Inside Out and unlock up to <span className="font-bold text-white">₹1,00,000</span> reward for every converted contract. No limits on referrals.
                  </p>
                  <div className="border-t border-white/20 pt-6 space-y-4 text-[11px] font-light text-white/85">
                    <p className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 shrink-0" />
                      100% Transparent Tracking
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 shrink-0" />
                      Direct UPI or Bank Transfer
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 shrink-0" />
                      Discreet & Professional Contact
                    </p>
                  </div>
                </div>
                
                <div className="hidden md:block mt-8 pt-6 border-t border-white/15">
                  <p className="text-[9px] uppercase tracking-wider text-white/50">Support Desk</p>
                  <p className="text-[10px] font-bold text-white/80">rrinsideoutcreation@gmail.com</p>
                </div>
              </div>

              {/* Right Column Form */}
              <div className="flex-1 p-8 md:p-10 relative">
                <button 
                  onClick={onClose}
                  className="absolute top-6 right-6 p-2 hover:bg-zinc-100 rounded-full transition-colors z-10 cursor-pointer"
                >
                  <X size={20} />
                </button>

                {isSubmitted ? (
                  <div className="text-center py-12 flex flex-col items-center justify-center min-h-[400px]">
                    <motion.div 
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 15 }}
                      className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mb-8"
                    >
                      <CheckCircle2 size={40} />
                    </motion.div>
                    <h3 className="serif text-3xl text-zinc-900 mb-4">Referral Recorded</h3>
                    <p className="text-zinc-500 font-light text-sm max-w-sm mx-auto leading-relaxed">
                      Thank you for your valuable referral! We have registered this in our system and will contact the client with extreme decorum. You will be updated immediately.
                    </p>
                  </div>
                ) : (
                  <div>
                    <h3 className="serif text-3xl text-zinc-900 mb-1">Elite Referral</h3>
                    <p className="text-zinc-400 text-sm font-light mb-6">Enter details of the referrer (you) and the design prospect.</p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                      {/* Section 1: Referrer Details */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-[#5A5A40]/10 text-[#5A5A40] text-[10px] font-bold flex items-center justify-center">1</span>
                          <h4 className="text-[10px] uppercase tracking-widest font-bold text-zinc-800">Your Details (Referrer)</h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase tracking-widest text-[#5A5A40]/80 font-bold">Your Full Name</label>
                            <input 
                              required
                              type="text" 
                              value={formData.referrerName}
                              onChange={(e) => setFormData({...formData, referrerName: e.target.value})}
                              className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:border-[#5A5A40] focus:bg-white outline-none transition-all text-sm"
                              placeholder="Your Name"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase tracking-widest text-[#5A5A40]/80 font-bold">Your Email Address</label>
                            <input 
                              required
                              type="email" 
                              value={formData.referrerEmail}
                              onChange={(e) => setFormData({...formData, referrerEmail: e.target.value})}
                              className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:border-[#5A5A40] focus:bg-white outline-none transition-all text-sm"
                              placeholder="Your Email"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase tracking-widest text-[#5A5A40]/80 font-bold">Your Phone Number</label>
                            <input 
                              required
                              type="tel" 
                              value={formData.referrerPhone}
                              onChange={(e) => setFormData({...formData, referrerPhone: e.target.value})}
                              className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:border-[#5A5A40] focus:bg-white outline-none transition-all text-sm"
                              placeholder="Your Mobile Number"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase tracking-widest text-[#5A5A40]/80 font-bold flex items-center gap-1">
                              UPI ID / Payout Details <span className="text-[8px] font-normal text-zinc-400">(Optional)</span>
                            </label>
                            <input 
                              type="text" 
                              value={formData.referrerUpi}
                              onChange={(e) => setFormData({...formData, referrerUpi: e.target.value})}
                              className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:border-[#5A5A40] focus:bg-white outline-none transition-all text-sm"
                              placeholder="e.g. googlepay@upi"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Lead/Client Details */}
                      <div className="space-y-4 pt-2 border-t border-zinc-100">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-[#5A5A40]/10 text-[#5A5A40] text-[10px] font-bold flex items-center justify-center">2</span>
                          <h4 className="text-[10px] uppercase tracking-widest font-bold text-zinc-800">Person You Are Referring</h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase tracking-widest text-[#5A5A40]/80 font-bold">Client Full Name</label>
                            <input 
                              required
                              type="text" 
                              value={formData.clientName}
                              onChange={(e) => setFormData({...formData, clientName: e.target.value})}
                              className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:border-[#5A5A40] focus:bg-white outline-none transition-all text-sm"
                              placeholder="Client's Name"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase tracking-widest text-[#5A5A40]/80 font-bold">Client Phone Number</label>
                            <input 
                              required
                              type="tel" 
                              value={formData.clientPhone}
                              onChange={(e) => setFormData({...formData, clientPhone: e.target.value})}
                              className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:border-[#5A5A40] focus:bg-white outline-none transition-all text-sm"
                              placeholder="Client's Mobile Number"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase tracking-widest text-[#5A5A40]/80 font-bold">Client Email <span className="text-[8px] font-normal text-zinc-400">(Optional)</span></label>
                            <input 
                              type="email" 
                              value={formData.clientEmail}
                              onChange={(e) => setFormData({...formData, clientEmail: e.target.value})}
                              className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:border-[#5A5A40] focus:bg-white outline-none transition-all text-sm"
                              placeholder="Client's Email Address"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase tracking-widest text-[#5A5A40]/80 font-bold">Interested Service</label>
                            <select 
                              value={formData.projectType}
                              onChange={(e) => setFormData({...formData, projectType: e.target.value})}
                              className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:border-[#5A5A40] focus:bg-white outline-none transition-all text-sm"
                            >
                              <option>Luxury Interior Design</option>
                              <option>Architectural Services</option>
                              <option>Turnkey Office / Commercial Space</option>
                              <option>Independent Villa Creation</option>
                              <option>Bespoke Furniture Suite</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase tracking-widest text-[#5A5A40]/80 font-bold">Project Location <span className="text-[8px] font-normal text-zinc-400">(Area or City)</span></label>
                            <input 
                              required
                              type="text" 
                              value={formData.location}
                              onChange={(e) => setFormData({...formData, location: e.target.value})}
                              className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:border-[#5A5A40] focus:bg-white outline-none transition-all text-sm"
                              placeholder="e.g. DLF Sector 42, Gurugram"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase tracking-widest text-[#5A5A40]/80 font-bold">Context / Insights <span className="text-[8px] font-normal text-zinc-400">(Optional advice)</span></label>
                          <textarea 
                            rows={2}
                            value={formData.details}
                            onChange={(e) => setFormData({...formData, details: e.target.value})}
                            className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:border-[#5A5A40] focus:bg-white outline-none transition-all text-sm resize-none"
                            placeholder="e.g. They just bought a duplex, prefers calls in evening."
                          />
                        </div>
                      </div>

                      {error && <p className="text-red-500 text-[10px] uppercase tracking-widest font-bold">{error}</p>}

                      <button 
                        disabled={isSubmitting}
                        type="submit"
                        className="w-full py-4 bg-zinc-950 text-white rounded-lg font-bold uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:bg-[#5A5A40] transition-colors disabled:opacity-50 shadow-lg cursor-pointer"
                      >
                        {isSubmitting ? (
                          <Loader2 className="animate-spin" size={18} />
                        ) : (
                          <>
                            Submit Referral Application
                            <Send size={13} />
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const CareersModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    jobId: 'general',
    jobTitle: 'General / Spontaneous Application',
    name: '',
    email: '',
    phone: '',
    experience: '',
    portfolioUrl: '',
    resumeUrl: '',
    coverLetter: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const q = query(collection(db, 'jobs'), where('active', '==', true), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setJobs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => {
      console.warn("Could not query sorted active jobs: attempting simple fetch:", err);
      const unsubFallback = onSnapshot(collection(db, 'jobs'), (snap) => {
        const allJobs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setJobs(allJobs.filter((j: any) => j.active !== false));
        setLoading(false);
      });
      return () => unsubFallback();
    });
    return () => unsubscribe();
  }, [isOpen]);

  const handleApplyClick = (job: any) => {
    setSelectedJob(job);
    setFormData(prev => ({
      ...prev,
      jobId: job.id,
      jobTitle: job.title
    }));
  };

  const handleFile = async (file: File) => {
    const maxSize = 15 * 1024 * 1024; // 15MB
    if (file.size > maxSize) {
      setUploadError("File size is too large (max 15MB).");
      return;
    }

    setResumeUploading(true);
    setUploadError(null);
    try {
      const url = await uploadToServer(file);
      setFormData(prev => ({ ...prev, resumeUrl: url }));
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || "Failed to upload document.");
    } finally {
      setResumeUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim()) {
      setError("Please fill out all required fields.");
      return;
    }

    if (!formData.resumeUrl) {
      setError("Please upload your resume to complete your application.");
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'job_applications'), {
        ...formData,
        status: 'Pending',
        createdAt: serverTimestamp()
      });
      setIsSubmitted(true);
    } catch (err: any) {
      console.error(err);
      setError("Submission failed. Please check connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-zinc-950/40 champagne-blur"
          />

          {/* Modal Container */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-6xl bg-[#FAF8F3] rounded-[2rem] shadow-2xl overflow-hidden border border-zinc-200/50 z-10 flex flex-col max-h-[90vh]"
          >
            {/* Header banner */}
            <div className="bg-zinc-900 px-8 py-10 md:p-12 text-white relative overflow-hidden shrink-0">
              <div className="relative z-10">
                <p className="text-[#DFBA73] text-[9px] uppercase tracking-[0.3em] font-extrabold mb-3">Join our boutique firm</p>
                <h2 className="serif text-3xl md:text-4xl">Careers at <span className="italic">RR Inside Out</span></h2>
                <p className="text-zinc-400 text-xs mt-2 max-w-2xl font-light">
                  We are always seeking sophisticated design innovators and project execution leaders who strive for bespoke luxury creation. Browse active vacancies below or submit a general dossier.
                </p>
              </div>
              <button 
                onClick={onClose}
                className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-20"
              >
                <X size={18} />
              </button>
            </div>

            {/* Split Grid */}
            <div className="flex-1 overflow-y-auto p-6 md:p-10">
              {isSubmitted ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-20 px-6 max-w-md mx-auto"
                >
                  <div className="w-16 h-16 bg-[#5A5A40]/10 text-[#5A5A40] rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 className="serif text-2xl text-zinc-900 mb-3">Application Received</h3>
                  <p className="text-zinc-500 text-sm font-light leading-relaxed">
                    Thank you, <strong className="font-semibold text-zinc-900">{formData.name}</strong>, for expressing interest in joining RR Inside Out. Our team will review your credentials and contact you directly.
                  </p>
                  <button 
                    onClick={() => {
                      setIsSubmitted(false);
                      setFormData({
                        jobId: 'general',
                        jobTitle: 'General / Spontaneous Application',
                        name: '',
                        email: '',
                        phone: '',
                        experience: '',
                        portfolioUrl: '',
                        resumeUrl: '',
                        coverLetter: ''
                      });
                      setSelectedJob(null);
                      onClose();
                    }}
                    className="mt-8 px-8 py-3.5 bg-zinc-900 text-white text-[10px] uppercase tracking-widest font-bold rounded-full hover:bg-[#5A5A40] transition-colors"
                  >
                    Back to Platform
                  </button>
                </motion.div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  {/* Left: Job vacancy listings */}
                  <div className="lg:col-span-5 h-full space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-[#5A5A40] mb-3">Active Job Openings</h3>
                    {loading ? (
                      <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#5A5A40]" size={24} /></div>
                    ) : jobs.length === 0 ? (
                      <div className="p-6 bg-white border border-zinc-200 rounded-2xl text-center space-y-1">
                        <p className="text-xs text-zinc-500 font-medium">No current vacancies posted</p>
                        <p className="text-[10px] text-zinc-400 font-light leading-normal">
                          We are always open to stellar talent. Feel free to fill out our Spontaneous Application in the right form!
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                        {jobs.map((job) => (
                          <div 
                            key={job.id} 
                            onClick={() => handleApplyClick(job)}
                            className={`p-4 rounded-xl border transition-all cursor-pointer text-left ${
                              formData.jobId === job.id 
                                ? 'bg-[#5A5A40]/10 border-[#5A5A40] shadow-md' 
                                : 'bg-white border-zinc-200/60 hover:border-zinc-300'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <h4 className="font-bold text-sm text-zinc-900 font-sans">{job.title}</h4>
                                <p className="text-[10px] text-[#5A5A40] uppercase tracking-widest font-bold mt-0.5">{job.department} • {job.location}</p>
                              </div>
                              <span className="text-[10px] shrink-0 font-medium px-2 py-0.5 bg-zinc-100 rounded text-zinc-600">{job.type}</span>
                            </div>
                            <p className="text-[11px] text-zinc-500 line-clamp-2 mt-2 font-light">{job.description}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* General Spontaneous Application selection */}
                    <div 
                      onClick={() => {
                        setSelectedJob(null);
                        setFormData(prev => ({
                          ...prev,
                          jobId: 'general',
                          jobTitle: 'General / Spontaneous Application'
                        }));
                      }}
                      className={`p-4 rounded-xl border transition-all cursor-pointer text-left ${
                        formData.jobId === 'general' 
                          ? 'bg-zinc-900 text-white border-zinc-900 shadow-md' 
                          : 'bg-zinc-100 border-zinc-200/60 hover:border-zinc-300'
                      }`}
                    >
                      <h4 className={`font-bold text-sm font-sans ${formData.jobId === 'general' ? 'text-[#DFBA73]' : 'text-zinc-800'}`}>General / Spontaneous Application</h4>
                      <p className={`text-[10px] uppercase tracking-widest font-bold mt-0.5 ${formData.jobId === 'general' ? 'text-zinc-300' : 'text-zinc-500'}`}>Any Specialty</p>
                      <p className={`text-[11px] mt-2 font-light ${formData.jobId === 'general' ? 'text-zinc-400' : 'text-zinc-550'}`}>
                        Don't see a perfect match? Submit your resume here and specify your desired luxury design domain. We constantly review our portfolio banks.
                      </p>
                    </div>
                  </div>

                  {/* Right: Apply form */}
                  <div className="lg:col-span-7 bg-white p-6 md:p-8 rounded-3xl border border-zinc-100 shadow-md">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-[#5A5A40] mb-4">
                      Application Dossier: <span className="font-sans italic text-zinc-900">{formData.jobTitle}</span>
                    </h3>

                    {error && (
                      <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs font-semibold rounded-lg flex items-center gap-2">
                        <AlertCircle size={14} />
                        {error}
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">Full Name *</label>
                          <input 
                            type="text" 
                            required
                            placeholder="Shanu Kumawat"
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-lg text-sm focus:outline-none focus:border-[#5A5A40]/50"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">Email *</label>
                          <input 
                            type="email" 
                            required
                            placeholder="name@domain.com"
                            value={formData.email}
                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-lg text-sm focus:outline-none focus:border-[#5A5A40]/50"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">Phone Number *</label>
                          <input 
                            type="tel" 
                            required
                            placeholder="+91 XXXXX XXXXX"
                            value={formData.phone}
                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-lg text-sm focus:outline-none focus:border-[#5A5A40]/50"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">Years of Experience</label>
                          <input 
                            type="text" 
                            placeholder="e.g. 5 Years in Luxury Residential"
                            value={formData.experience}
                            onChange={(e) => setFormData({...formData, experience: e.target.value})}
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-lg text-sm focus:outline-none focus:border-[#5A5A40]/50"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">Portfolio Link (Optional)</label>
                        <input 
                          type="url" 
                          placeholder="e.g. behance.net/portfolio"
                          value={formData.portfolioUrl}
                          onChange={(e) => setFormData({...formData, portfolioUrl: e.target.value})}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-lg text-sm focus:outline-none focus:border-[#5A5A40]/50"
                        />
                      </div>

                      {/* PDF/Word Resume upload */}
                      <div>
                        <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1.5">Resume / Curriculum Vitae *</label>
                        {formData.resumeUrl ? (
                          <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-[#5A5A40]/10 text-[#5A5A40] rounded-lg flex items-center justify-center">
                                <FileText size={20} />
                              </div>
                              <div className="text-left">
                                <p className="text-xs font-bold text-zinc-800">Resume Uploaded</p>
                                <a href={formData.resumeUrl} target="_blank" rel="noreferrer" className="text-[10px] text-[#5A5A40] underline font-semibold">View File Dossier</a>
                              </div>
                            </div>
                            <button 
                              type="button"
                              onClick={() => setFormData({...formData, resumeUrl: ''})}
                              className="text-xs text-red-500 font-bold hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        ) : !auth.currentUser ? (
                          <div className="border border-zinc-200 bg-zinc-50/50 rounded-xl p-5 text-center flex flex-col items-center justify-center">
                            <Upload className="text-zinc-400 mb-2" size={24} />
                            <p className="text-xs font-bold text-zinc-800">Authentication Required</p>
                            <p className="text-[10px] text-zinc-500 mt-1 max-w-[280px] mx-auto mb-3 leading-relaxed">
                              To securely upload resumes and prevent spam, please authenticate with your Google Account.
                            </p>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await signInWithPopup(auth, googleProvider);
                                } catch (e) {
                                  console.error("Sign-in popup error", e);
                                }
                              }}
                              className="px-4 py-2 bg-zinc-900 hover:bg-[#5A5A40] text-white text-[10px] uppercase font-bold tracking-widest rounded-lg transition-colors cursor-pointer"
                            >
                              Sign In with Google
                            </button>
                          </div>
                        ) : (
                          <div 
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                              dragActive ? 'border-[#5A5A40] bg-[#5A5A40]/5' : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50'
                            }`}
                          >
                            <input 
                              type="file" 
                              id="resume-upload"
                              className="hidden" 
                              onChange={onFileChange}
                              accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            />
                            <label htmlFor="resume-upload" className="cursor-pointer space-y-2 block">
                              {resumeUploading ? (
                                <div className="py-4"><Loader2 className="animate-spin mx-auto text-[#5A5A40]" size={24} /></div>
                              ) : (
                                <>
                                  <Upload className="mx-auto text-zinc-300" size={28} />
                                  <p className="text-xs font-bold text-zinc-750">Drag & Drop Resume in PDF/DOC</p>
                                  <p className="text-[10px] text-zinc-400">or click to browse local storage</p>
                                </>
                              )}
                            </label>
                          </div>
                        )}
                        {uploadError && <p className="text-[10px] text-red-500 font-bold mt-1 text-left">{uploadError}</p>}
                      </div>

                      <div>
                        <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">Cover Note / Remarks</label>
                        <textarea 
                          rows={3}
                          placeholder="Tell us a little bit about what drives your designs..."
                          value={formData.coverLetter}
                          onChange={(e) => setFormData({...formData, coverLetter: e.target.value})}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-lg text-sm focus:outline-none focus:border-[#5A5A40]/50"
                        />
                      </div>

                      <button 
                        type="submit"
                        disabled={isSubmitting || resumeUploading}
                        className="w-full py-4 bg-zinc-900 hover:bg-[#5A5A40] disabled:bg-zinc-300 font-bold text-white text-[10px] uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="animate-spin" size={14} />
                            Submitting...
                          </>
                        ) : (
                          "Submit Dossier"
                        )}
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const VendorModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [formData, setFormData] = useState({
    businessName: '',
    contactPerson: '',
    email: '',
    phone: '',
    specialty: 'Carpentry & Custom Millwork',
    experience: '3-5 Years',
    pastProjects: '',
    details: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateEmail(formData.email)) {
      setError("Please enter a valid business email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await robustFetch('/api/vendor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await response.json();
      if (result.success) {
        await addDoc(collection(db, 'vendors'), {
          ...formData,
          createdAt: serverTimestamp()
        });
        setIsSubmitted(true);
        setTimeout(() => {
          onClose();
          setIsSubmitted(false);
          setFormData({
            businessName: '',
            contactPerson: '',
            email: '',
            phone: '',
            specialty: 'Carpentry & Custom Millwork',
            experience: '3-5 Years',
            pastProjects: '',
            details: ''
          });
        }, 3500);
      } else {
        setError(result.message || "Failed to submit registration. Please try again.");
      }
    } catch (err: any) {
      console.error("Vendor registration submit error:", err);
      setError("Something went wrong. Please check your network and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-900/80 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            <div className="flex flex-col md:flex-row h-full">
              {/* Left Column Side Banner */}
              <div className="md:w-1/3 bg-[#5A5A40] p-10 text-white flex flex-col justify-between">
                <div>
                  <h3 className="serif text-3xl mb-6 leading-tight">Vendor <br />Onboarding</h3>
                  <p className="text-white/70 text-xs font-light leading-relaxed mb-6">
                    Join our premier vendor ecosystem. We partner with India's best craftsmen, premium material suppliers, and specialized contractors to build luxury spaces.
                  </p>
                  <div className="border-t border-white/20 pt-6 space-y-4 text-[11px] font-light text-white/85">
                    <p className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 shrink-0" />
                      Premium Project Pipelines
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 shrink-0" />
                      Timely Escrows & Payments
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 shrink-0" />
                      Collaborative Design Environment
                    </p>
                  </div>
                </div>
                
                <div className="hidden md:block mt-8 pt-6 border-t border-white/15">
                  <p className="text-[9px] uppercase tracking-wider text-white/50">Vetting Desk</p>
                  <p className="text-[10px] font-bold text-white/80">rrinsideoutcreation@gmail.com</p>
                </div>
              </div>

              {/* Right Column Form */}
              <div className="flex-1 p-8 md:p-10 relative">
                <button 
                  onClick={onClose}
                  className="absolute top-6 right-6 p-2 hover:bg-zinc-100 rounded-full transition-colors z-10 cursor-pointer"
                >
                  <X size={20} />
                </button>

                {isSubmitted ? (
                  <div className="text-center py-12 flex flex-col items-center justify-center min-h-[400px]">
                    <motion.div 
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 15 }}
                      className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mb-8"
                    >
                      <CheckCircle2 size={40} />
                    </motion.div>
                    <h3 className="serif text-3xl text-zinc-900 mb-4">Application Shared</h3>
                    <p className="text-zinc-500 font-light text-sm max-w-sm mx-auto leading-relaxed">
                      Thank you for scaling with RR Inside Out. Your profile has been shared with our lead architects and project procurement desk. We will reach back to discuss synergy.
                    </p>
                  </div>
                ) : (
                  <div>
                    <h3 className="serif text-3xl text-zinc-900 mb-1">Empower our Spaces</h3>
                    <p className="text-zinc-400 text-sm font-light mb-6">Enter details of your business, specialty, and contact coordinates.</p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase tracking-widest text-[#5A5A40]/80 font-bold">Business / Company Name</label>
                            <input 
                              required
                              type="text" 
                              value={formData.businessName}
                              onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                              className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:border-[#5A5A40] focus:bg-white outline-none transition-all text-sm animate-none"
                              placeholder="Company Name"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase tracking-widest text-[#5A5A40]/80 font-bold">Contact Person Name</label>
                            <input 
                              required
                              type="text" 
                              value={formData.contactPerson}
                              onChange={(e) => setFormData({...formData, contactPerson: e.target.value})}
                              className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:border-[#5A5A40] focus:bg-white outline-none transition-all text-sm animate-none"
                              placeholder="Name & Title"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase tracking-widest text-[#5A5A40]/80 font-bold">Business Email Address</label>
                            <input 
                              required
                              type="email" 
                              value={formData.email}
                              onChange={(e) => setFormData({...formData, email: e.target.value})}
                              className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:border-[#5A5A40] focus:bg-white outline-none transition-all text-sm animate-none"
                              placeholder="name@company.com"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase tracking-widest text-[#5A5A40]/80 font-bold">Business Phone Number</label>
                            <input 
                              required
                              type="tel" 
                              value={formData.phone}
                              onChange={(e) => setFormData({...formData, phone: e.target.value})}
                              className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:border-[#5A5A40] focus:bg-white outline-none transition-all text-sm animate-none"
                              placeholder="Phone Number"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase tracking-widest text-[#5A5A40]/80 font-bold">Your Specialty / Code of Work</label>
                            <select 
                              value={formData.specialty}
                              onChange={(e) => setFormData({...formData, specialty: e.target.value})}
                              className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:border-[#5A5A40] focus:bg-white outline-none transition-all text-sm animate-none"
                            >
                              <option>Carpentry & Custom Millwork</option>
                              <option>Civil, Marble & Flooring Work</option>
                              <option>Painting, Wallpapers & Polishing</option>
                              <option>Ceiling & Gypsum Partition Boarding</option>
                              <option>HVAC, Electrical & Custom Automation</option>
                              <option>Bespoke Furniture Manufacturer</option>
                              <option>Glass, Mirror & Steel Metal Detailing</option>
                              <option>Material Supplier (Upholstery, Tiles, Stone)</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase tracking-widest text-[#5A5A40]/80 font-bold">Years of Industry Practice</label>
                            <select 
                              value={formData.experience}
                              onChange={(e) => setFormData({...formData, experience: e.target.value})}
                              className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:border-[#5A5A40] focus:bg-white outline-none transition-all text-sm"
                            >
                              <option>1-3 Years</option>
                              <option>3-5 Years</option>
                              <option>5-10 Years</option>
                              <option>10+ Years (Highly Experienced)</option>
                            </select>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase tracking-widest text-[#5A5A40]/80 font-bold">Past Prestigious Projects Done</label>
                          <input 
                            type="text" 
                            value={formData.pastProjects}
                            onChange={(e) => setFormData({...formData, pastProjects: e.target.value})}
                            className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:border-[#5A5A40] focus:bg-white outline-none transition-all text-sm"
                            placeholder="e.g. Trump Towers Mumbai, luxury penthouse flooring"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase tracking-widest text-[#5A5A40]/80 font-bold">Machinery, Labour capacity or details <span className="text-[8px] font-normal text-zinc-400">(Optional)</span></label>
                          <textarea 
                            rows={2}
                            value={formData.details}
                            onChange={(e) => setFormData({...formData, details: e.target.value})}
                            className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:border-[#5A5A40] focus:bg-white outline-none transition-all text-sm resize-none"
                            placeholder="e.g. We have own 5000 sq ft workshop with computerized woodcutting saw machines."
                          />
                        </div>
                      </div>

                      {error && <p className="text-red-500 text-[10px] uppercase tracking-widest font-bold">{error}</p>}

                      <button 
                        disabled={isSubmitting}
                        type="submit"
                        className="w-full py-4 bg-zinc-950 text-white rounded-lg font-bold uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 hover:bg-[#5A5A40] transition-colors disabled:opacity-50 shadow-lg cursor-pointer animate-none"
                      >
                        {isSubmitting ? (
                          <Loader2 className="animate-spin" size={18} />
                        ) : (
                          <>
                            Submit Onboarding Application
                            <Send size={13} />
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    (this as any).state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    const self = this as any;
    if (self.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsedError = JSON.parse(self.state.error?.message || "");
        if (parsedError.error) errorMessage = `Database Error: ${parsedError.error}`;
      } catch (e) {
        // Not a JSON error
      }
      return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
          <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl text-center">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <X size={32} />
            </div>
            <h2 className="serif text-2xl mb-4">Application Error</h2>
            <p className="text-zinc-500 text-sm mb-8">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-zinc-900 text-white rounded-md text-xs uppercase tracking-widest font-bold hover:bg-[#5A5A40] transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return self.props.children;
  }
}


interface ProjectDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: PortfolioProject | null;
}

const ProjectDetailsModal = ({ isOpen, onClose, project }: ProjectDetailsModalProps) => {
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setActiveImage(0);
    }
  }, [isOpen, project]);

  if (!project) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-900/95 backdrop-blur-md"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="relative w-full max-w-6xl bg-[#FAF8F3] rounded-none border border-zinc-200/60 shadow-2xl overflow-hidden flex flex-col md:flex-row h-[95vh] md:h-[85vh]"
          >
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 z-20 p-3 bg-zinc-950/90 hover:bg-zinc-900 border border-white/5 text-white rounded-none transition-colors hidden md:block"
            >
              <X size={18} />
            </button>
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 z-20 p-3 bg-zinc-950/90 hover:bg-zinc-900 border border-white/5 text-white rounded-none transition-colors md:hidden"
            >
              <X size={18} />
            </button>

            {/* Image Gallery */}
            <div className="flex-1 relative bg-zinc-950 h-1/2 md:h-auto group/gallery overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.img 
                  key={activeImage}
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  src={project.gallery[activeImage] || project.image}
                  className="w-full h-full object-cover select-none"
                  referrerPolicy="no-referrer"
                />
              </AnimatePresence>
              
              <div className="absolute inset-0 bg-black/15 pointer-events-none" />
              <div className="absolute inset-0 cinematic-scrim opacity-45 pointer-events-none" />

              <div className="absolute inset-0 flex items-center justify-between p-6 opacity-0 group-hover/gallery:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImage((prev) => (prev - 1 + project.gallery.length) % project.gallery.length);
                  }}
                  className="p-3 bg-zinc-950/80 border border-white/10 text-white hover:bg-[#5A5A40] transition-all rounded-none"
                >
                  <ChevronDown size={18} className="rotate-90" />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImage((prev) => (prev + 1) % project.gallery.length);
                  }}
                  className="p-3 bg-zinc-950/80 border border-white/10 text-white hover:bg-[#5A5A40] transition-all rounded-none"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="absolute bottom-8 left-10 right-10 flex items-center justify-between z-10">
                <span className="font-mono text-[9px] tracking-widest text-white/50 bg-black/40 px-3 py-1.5 backdrop-blur-sm border border-white/5">
                  SCENE {activeImage + 1} OF {project.gallery.length || 1}
                </span>
                <div className="flex gap-2.5 px-4 py-2.5 bg-black/40 backdrop-blur-sm border border-white/5">
                  {project.gallery.map((_, i) => (
                    <button 
                      key={i}
                      onClick={() => setActiveImage(i)}
                      className={`w-6 h-[2px] transition-all duration-300 ${activeImage === i ? 'bg-[#5A5A40]' : 'bg-white/20'}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Details Section */}
            <div className="w-full md:w-[440px] p-8 md:p-12 overflow-y-auto bg-white flex flex-col justify-between border-l border-zinc-200/50">
              <div className="space-y-10">
                <div>
                  <div className="flex items-center gap-2.5 mb-3">
                    <span className="w-6 h-[1px] bg-[#5A5A40]" />
                    <p className="text-[9px] uppercase tracking-[0.3em] text-[#5A5A40] font-bold">{project.category}</p>
                  </div>
                  <h3 className="serif text-3xl text-zinc-950 font-light leading-tight tracking-tight">{project.title}</h3>
                  
                  <div className="grid grid-cols-2 gap-6 border-y border-zinc-100 py-6 mt-8">
                    <div>
                      <p className="text-[8px] uppercase tracking-[0.2em] text-zinc-400 font-bold mb-1">Estate Location</p>
                      <p className="text-xs font-bold text-zinc-800">{project.location}</p>
                    </div>
                    <div>
                      <p className="text-[8px] uppercase tracking-[0.2em] text-zinc-400 font-bold mb-1">Curation Area</p>
                      <p className="text-xs font-bold text-zinc-800">{project.area}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <p className="text-zinc-500 text-xs md:text-sm font-light leading-relaxed text-pretty">
                    {project.description}
                  </p>
                  
                  {/* Miniature Image Thumbnails */}
                  <div className="grid grid-cols-3 gap-2 py-2">
                    {project.gallery.map((img, i) => (
                      <button 
                        key={i}
                        onClick={() => setActiveImage(i)}
                        className={`aspect-square rounded-none overflow-hidden p-0.5 border transition-all ${
                          activeImage === i ? 'border-[#5A5A40] bg-zinc-100' : 'border-zinc-200 bg-transparent'
                        }`}
                      >
                        <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-8 mt-8 border-t border-zinc-100">
                <button 
                  onClick={() => {
                    onClose();
                    (window as any).scrollToEnquiry?.();
                  }}
                  className="w-full py-5 bg-zinc-950 text-white rounded-none text-[9px] uppercase tracking-[0.2em] font-bold hover:bg-[#5A5A40] transition-all flex items-center justify-center gap-3 active:translate-y-[1px]"
                >
                  Acquire Design Consult 
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const getInstagramEmbedUrl = (url: string): string | null => {
  if (!url) return null;
  const match = url.match(/(?:instagram\.com\/(?:p|reel|tv)\/)([a-zA-Z0-9_-]+)/i);
  if (match && match[1]) {
    return `https://www.instagram.com/reel/${match[1]}/embed/`;
  }
  return null;
};

const InteractiveVideoPlayer = ({ src }: { src: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [hasError, setHasError] = useState(false);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(err => console.log("Playback error:", err));
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black group">
      {hasError ? (
        <div className="text-center p-8 text-zinc-400 max-w-xs flex flex-col items-center">
          <Video size={36} className="text-zinc-655 mb-3" />
          <p className="text-xs font-semibold text-white mb-2">Streaming Interrupted</p>
          <p className="text-[10px] text-zinc-400 leading-relaxed mb-4">
            Direct streaming was blocked by the browser. You can still open the direct URL.
          </p>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] uppercase tracking-widest font-bold rounded-full transition-all"
          >
            Open Video Source
          </a>
        </div>
      ) : (
        <>
          <video 
            ref={videoRef}
            src={src} 
            className="w-full h-full object-cover cursor-pointer"
            autoPlay
            loop
            muted={isMuted}
            playsInline
            crossOrigin="anonymous"
            onClick={togglePlay}
            onError={() => {
              console.warn("Direct video load failed:", src);
              setHasError(true);
            }}
          />
          
          {/* Centered Big Play/Pause Button Overlay on Hover */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white border border-white/10 pointer-events-auto transition-transform hover:scale-110 active:scale-95 shadow-2xl"
            >
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
            </button>
          </div>

          {/* Quick Control Overlays */}
          <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between pointer-events-none select-none z-10">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                toggleMute();
              }}
              className="pointer-events-auto w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white border border-white/10 hover:bg-[#5A5A40] transition-colors shadow-lg"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>

            <span className="text-[10px] text-white/50 tracking-widest uppercase bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full font-mono">
              Live Stream
            </span>
          </div>
        </>
      )}
    </div>
  );
};

const InstagramEmbedPlayer = ({ videoUrl }: { videoUrl: string }) => {
  const embedUrl = getInstagramEmbedUrl(videoUrl);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  useEffect(() => {
    setIframeLoaded(false);
    const timer = setTimeout(() => {
      setIframeLoaded(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, [videoUrl]);

  if (!embedUrl) {
    return (
      <div className="text-center p-8 text-zinc-400 max-w-xs flex flex-col items-center">
        <Instagram size={36} className="text-zinc-650 mb-3" />
        <p className="text-xs font-semibold text-white mb-2">Invalid Link</p>
        <p className="text-[10px] text-zinc-405 leading-relaxed">
          Please provide a standard Instagram reel, post, or video URL.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative flex flex-col pt-16 pb-2 px-3">
      {!iframeLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 z-10 text-center px-6">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent border-[#5A5A40] animate-spin mb-4" />
          <p className="text-xs font-semibold text-zinc-300">Establishing Frame Stream...</p>
          <p className="text-[9px] text-zinc-500 mt-2 max-w-[240px] leading-relaxed">
            Connecting securely with Instagram servers.
          </p>
        </div>
      )}
      <iframe 
        src={embedUrl}
        className="w-full h-full border-0 rounded-3xl bg-zinc-950 overflow-hidden"
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
        onLoad={() => setIframeLoaded(true)}
      />
    </div>
  );
};

const InstagramReels = ({ onOpenAdmin }: { onOpenAdmin: () => void }) => {
  const [reels, setReels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReel, setSelectedReel] = useState<any | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'reels'), orderBy('pinned', 'desc'), orderBy('createdAt', 'desc'), limit(4));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reelsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReels(reelsData);
      setLoading(false);
    }, (error) => {
      console.error("Reels fetch error:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Default mock data if empty
  const displayReels = reels.length > 0 ? reels : [
    { id: '1', videoUrl: 'https://www.instagram.com/reel/DVVCHtNEV1n/', title: 'Luxury Interior Showcase', pinned: true },
    { id: '2', videoUrl: 'https://www.instagram.com/reel/DV200ZmEc2E/', title: 'Modern Living Room Design', pinned: false },
    { id: '3', videoUrl: 'https://www.instagram.com/reel/DUsBZPYkdNN/', title: 'Bespoke Furniture Craftsmanship', pinned: false },
    { id: '4', videoUrl: 'https://www.instagram.com/reel/DGJNsZJhg4d/', title: 'Architectural Excellence', pinned: false },
  ];

  const renderMedia = (reel: any, index: number) => {
    const isInstagram = reel.videoUrl.includes('instagram.com');
    
    if (isInstagram) {
      // Map index to a premium cinematic interior MP4 to bypass iframe sandbox blocking
      const ambientVideos = [
        "https://assets.mixkit.co/videos/preview/mixkit-luxury-interior-design-of-a-living-room-34502-large.mp4",
        "https://assets.mixkit.co/videos/preview/mixkit-modern-apartment-with-elegant-minimalist-interior-43093-large.mp4",
        "https://assets.mixkit.co/videos/preview/mixkit-dining-room-of-a-luxury-holiday-home-34505-large.mp4",
        "https://assets.mixkit.co/videos/preview/mixkit-bright-minimalist-apartment-interior-with-plants-43091-large.mp4"
      ];
      const fallbackImages = [
        "https://images.unsplash.com/photo-1616486029423-aaa4789e8c9a?auto=format&fit=crop&q=80&w=600",
        "https://images.unsplash.com/photo-1617806118233-18e1db208586?auto=format&fit=crop&q=80&w=600",
        "https://images.unsplash.com/photo-1618219908412-a29a1bb7b86e?auto=format&fit=crop&q=80&w=600",
        "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&q=80&w=600"
      ];
      
      const ambientUrl = ambientVideos[index % ambientVideos.length];
      const fallbackUrl = fallbackImages[index % fallbackImages.length];

      return (
        <div className="w-full h-full relative">
          <SafeVideoPlayer 
            src={ambientUrl} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 pointer-events-none"
            autoPlay={true}
            loop={true}
            muted={true}
            playsInline={true}
            fallbackImage={fallbackUrl}
          />
          <div className="absolute inset-0 bg-black/10 group-hover:bg-black/35 transition-all duration-500 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 transform group-hover:scale-110 transition-transform duration-500 shadow-xl">
              <Play size={20} fill="currentColor" className="ml-0.5" />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full h-full relative">
        <SafeVideoPlayer 
          src={reel.videoUrl} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 pointer-events-none"
          autoPlay={true}
          loop={true}
          muted={true}
          playsInline={true}
        />
        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/35 transition-all duration-500 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 transform group-hover:scale-110 transition-transform duration-500 shadow-xl">
            <Play size={20} fill="currentColor" className="ml-0.5" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="py-32 px-6 md:px-12 bg-white">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#5A5A40] font-bold mb-6">Social Feed</p>
            <h2 className="serif text-5xl md:text-6xl text-zinc-900">Latest from <span className="italic">Instagram</span></h2>
          </div>
          <div className="flex items-center gap-4">
            <a 
              href="https://www.instagram.com/inout.creation/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-8 py-4 bg-zinc-900 text-white rounded-full text-[10px] uppercase tracking-widest font-bold hover:bg-[#5A5A40] transition-all shadow-lg"
            >
              <Instagram size={16} />
              Follow @RRInsideOut
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {displayReels.map((reel, i) => (
            <motion.a 
              href={reel.videoUrl}
              onClick={(e) => {
                e.preventDefault();
                setSelectedReel(reel);
              }}
              key={reel.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="group relative aspect-[9/16] bg-zinc-100 rounded-[2.5rem] overflow-hidden shadow-2xl block cursor-pointer border border-zinc-200/20"
            >
              {renderMedia(reel, i)}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-8">
                <p className="text-white font-bold text-sm mb-2">{reel.title}</p>
                <div className="flex items-center gap-2 text-white/80 text-[10px] uppercase tracking-widest font-bold">
                  <Play size={12} fill="currentColor" />
                  Play Live on Site
                </div>
              </div>
              <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between pointer-events-none group-hover:opacity-0 transition-opacity duration-300">
                <div className="px-3 py-1 bg-black/40 backdrop-blur-md rounded-full text-[10px] font-medium text-white flex items-center gap-2 border border-white/10">
                  <Instagram size={11} className="text-[#5A5A40]" />
                  <span>Interactive Reel</span>
                </div>
              </div>
              {reel.pinned && (
                <div className="absolute top-6 right-6 w-10 h-10 bg-white/95 backdrop-blur-md rounded-full flex items-center justify-center text-[#5A5A40] shadow-lg z-10 group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                  <Pin size={16} className="rotate-45" />
                </div>
              )}
            </motion.a>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selectedReel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop with elegant fade and blur */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedReel(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            ></motion.div>

            {/* Modal Body with spring transition physics */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="relative w-full max-w-md bg-zinc-950 rounded-[2.5rem] overflow-hidden shadow-2xl border border-zinc-800 flex flex-col aspect-[9/16] max-h-[85vh] z-10"
            >
              {/* Header inside modal */}
              <div className="absolute top-6 left-6 right-6 z-20 flex justify-between items-center bg-black/55 backdrop-blur-md rounded-full px-5 py-2 border border-white/10">
                <span className="text-white text-xs font-bold tracking-wide truncate max-w-[200px]">{selectedReel.title || "Selected Reel"}</span>
                <button 
                  onClick={() => setSelectedReel(null)}
                  className="p-1.5 hover:bg-white/10 rounded-full text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Main Embed / Player Box */}
              <div className="flex-1 w-full h-full relative overflow-hidden bg-black flex items-center justify-center">
                {(() => {
                  const isInstagram = selectedReel.videoUrl.includes('instagram.com');
                  
                  if (isInstagram) {
                    return <InstagramEmbedPlayer videoUrl={selectedReel.videoUrl} />;
                  } else {
                    return <InteractiveVideoPlayer src={selectedReel.videoUrl} />;
                  }
                })()}
              </div>

              {/* Action and detail bar */}
              <div className="p-6 bg-zinc-900/95 border-t border-zinc-800 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <p className="text-zinc-450 text-[10px] uppercase tracking-widest font-bold">Interactive Stream</p>
                    <p className="text-white text-xs font-semibold mt-1">{selectedReel.title || "Cinematic Showcase"}</p>
                  </div>
                  <a 
                    href={selectedReel.videoUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-[#5A5A40] text-white rounded-full text-[10px] uppercase tracking-widest font-bold transition-all shadow-md"
                  >
                    <Instagram size={12} />
                    Open Source <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
};

const Testimonials = () => {
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const q = query(collection(db, 'testimonials'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTestimonials(data);
      setLoading(false);
    }, (error) => {
      console.error("Testimonials fetch error:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const defaultTestimonials = [
    {
      name: "Vikram Malhotra",
      role: "Luxury Homeowner, DLF Phase 5, Gurgaon",
      text: "RR Inside Out transformed our penthouse in Gurgaon into an absolute sanctuary. Vikram and his team have an unparalleled eye for detail. The blend of modern minimalism with traditional luxury is exactly what we envisioned for our home.",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200"
    },
    {
      name: "Priyanka Sharma",
      role: "Art Curator, Vasant Vihar, Delhi",
      text: "As an art curator, my standards for design are extremely high. The team at RR Inside Out created a space that isn't just a house, but a curated experience. Their use of materials from local artisans in Delhi-NCR added a soul to the project.",
      image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200"
    },
    {
      name: "Aditya Verma",
      role: "Tech Entrepreneur, Cyber City, Gurgaon",
      text: "Designing my tech-enabled home office in Gurgaon was a complex brief. RR Inside Out handled it with sheer brilliance. They integrated cutting-edge home automation while maintaining the warmth of a luxury living space. Highly recommended!",
      image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200"
    }
  ];

  const displayTestimonials = testimonials.length > 0 ? testimonials : defaultTestimonials;

  useEffect(() => {
    if (displayTestimonials.length === 0) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % displayTestimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [displayTestimonials.length]);

  if (loading && testimonials.length === 0) return null;

  return (
    <section className="py-32 px-6 md:px-12 bg-zinc-50 overflow-hidden">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8">
          <div className="max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#5A5A40] font-bold mb-6">Testimonials</p>
            <h2 className="serif text-5xl md:text-6xl text-zinc-900">What Our <span className="italic">Clients Say</span></h2>
          </div>
          <p className="text-zinc-400 max-w-xs text-sm font-light">
            Real experiences from selective design collectors and residents who placed their trust in our custom digital-spatial creations.
          </p>
        </div>
        
        <div className="relative max-w-4xl mx-auto h-[450px] md:h-[350px]">
          <AnimatePresence mode="wait">
            <motion.div 
              key={currentIndex}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
              className="absolute inset-0 bg-white p-10 md:p-16 rounded-[3rem] shadow-xl border border-zinc-100 flex flex-col md:flex-row items-center gap-8 md:gap-12"
            >
              <div className="w-32 h-32 md:w-48 md:h-48 rounded-full overflow-hidden shrink-0 border-4 border-zinc-50 shadow-lg">
                <img 
                  src={displayTestimonials[currentIndex]?.image || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200"} 
                  alt={displayTestimonials[currentIndex]?.name} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer" 
                />
              </div>
              <div className="flex-1 text-center md:text-left">
                <div className="flex justify-center md:justify-start gap-1 mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Sparkles key={i} size={16} className="text-[#5A5A40] fill-[#5A5A40]" />
                  ))}
                </div>
                <p className="text-zinc-600 italic text-xl md:text-2xl leading-relaxed mb-8 font-light">
                  "{displayTestimonials[currentIndex]?.text}"
                </p>
                <div>
                  <p className="font-bold text-lg text-zinc-900">{displayTestimonials[currentIndex]?.name}</p>
                  <p className="text-[10px] uppercase tracking-widest text-[#5A5A40] font-bold mt-1">{displayTestimonials[currentIndex]?.role}</p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
        
        <div className="flex justify-center gap-3 mt-12">
          {displayTestimonials.map((_, i) => (
            <button 
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${currentIndex === i ? 'w-8 bg-[#5A5A40]' : 'bg-zinc-300'}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

const ServiceCard = ({ image, title, description, onClick }: { image: string, title: string, description: string, onClick: () => void }) => (
  <motion.div 
    whileHover={{ y: -8 }}
    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    className="group bg-white rounded-none overflow-hidden border border-zinc-200/50 p-3 shadow-none hover:shadow-xl hover:border-zinc-300 transition-all duration-500"
  >
    <div className="aspect-[4/3] overflow-hidden relative bg-zinc-900">
      <img 
        src={image} 
        alt={title} 
        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-1000 ease-out"
        referrerPolicy="no-referrer"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
    </div>
    <div className="p-6 pt-8 space-y-4">
      <div className="flex justify-between items-baseline">
        <h3 className="serif text-2xl text-zinc-950 font-light">{title}</h3>
        <span className="w-1.5 h-1.5 rounded-full bg-[#5A5A40]/60" />
      </div>
      <p className="text-zinc-650 text-xs md:text-sm leading-relaxed font-light min-h-[48px]">
        {description}
      </p>
      <div className="pt-2">
        <button 
          onClick={onClick}
          className="text-[9px] uppercase tracking-[0.25em] font-bold text-[#5A5A40] inline-flex items-center gap-3 group/btn hover:text-zinc-950 transition-colors"
        >
          Explore Concept 
          <span className="w-6 h-[1px] bg-[#5A5A40] group-hover/btn:w-9 transition-all duration-300" />
        </button>
      </div>
    </div>
  </motion.div>
);

// Helper upload function to send files to the secure Node.js backend
const uploadToServer = async (file: File): Promise<string> => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("No active credentials found. Please sign in to perform uploads.");

  // Dual-channel optimization: Try direct browser-to-Firebase Storage upload first to bypass Express file-size proxy timeouts.
  try {
    const cleanFileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
    const fileRef = ref(storage, `uploads/${cleanFileName}`);
    const snapshot = await uploadBytes(fileRef, file);
    const downloadUrl = await getDownloadURL(snapshot.ref);
    console.log("[CLIENT STORAGE SUCCESS] Uploaded file directly from browser to Firebase Storage:", downloadUrl);
    return downloadUrl;
  } catch (clientErr: any) {
    console.warn("[CLIENT STORAGE WARNING] Client-direct storage upload skipped or blocked by rules. Falling back to secure server proxy.", clientErr?.message || clientErr);
  }

  // Backup flow: Proxy the file upload through the Express backend container
  const formData = new FormData();
  formData.append("file", file);

  const res = await robustFetch("/api/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });

  const contentType = res.headers.get("content-type") || "";
  if (!res.ok) {
    if (contentType.includes("application/json")) {
      const jq = await res.json().catch(() => ({ success: false, message: "Server returned an invalid JSON error." }));
      throw new Error(jq.message || `Upload failed (Status: ${res.status})`);
    } else {
      throw new Error(`Upload failed. The server returned an HTML response status ${res.status}. This usually indicates a container proxy limitation. Please ensure your cloud environment is healthy.`);
    }
  }

  if (!contentType.includes("application/json")) {
    throw new Error("Invalid server response received. The backend returned HTML instead of JSON. Please verify your internet connection or try again.");
  }

  const jq = await res.json();
  if (!jq.success) {
    throw new Error(jq.message || "Upload failed");
  }
  return jq.url; 
};

const ImageUploadButton = ({ onUploaded, label = "Upload Image", accept = "image/*" }: { onUploaded: (url: string) => void, label?: string, accept?: string }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = async (file: File) => {
    // Basic media format/size audit & protection
    const isVideo = file.type.startsWith("video/") || file.name.endsWith(".mp4") || file.name.endsWith(".mov") || file.name.endsWith(".webm");
    const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024; // 100MB for videos, 10MB for images

    if (file.size > maxSize) {
      setError(`File is too large. Safe limit: ${isVideo ? "100MB video" : "10MB image"}`);
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const url = await uploadToServer(file);
      onUploaded(url);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="flex flex-col items-start gap-1 shrink-0">
      <label 
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`relative flex items-center justify-center gap-2 px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] cursor-pointer transition-all active:translate-y-[1px] select-none rounded-none border ${
          dragActive 
            ? "bg-[#5A5A40] text-white border-[#5A5A40] scale-[0.98]" 
            : "bg-zinc-950 text-white hover:bg-[#5A5A40] border-zinc-800"
        }`}
      >
        {uploading ? (
          <>
            <Loader2 className="animate-spin text-white" size={12} />
            <span>Uploading...</span>
          </>
        ) : (
          <>
            <Upload size={12} />
            <span>{dragActive ? "Drop File Here" : label}</span>
          </>
        )}
        <input type="file" onChange={onChange} accept={accept} className="hidden" disabled={uploading} />
      </label>
      {error && <span className="text-[9px] text-red-500 font-semibold tracking-wide">{error}</span>}
    </div>
  );
};

const RRBrandLogo = ({ scrolled = false, className = "h-11 md:h-12" }: { scrolled?: boolean, className?: string }) => {
  const textColor = scrolled ? "text-zinc-900" : "text-white";

  return (
    <div className="flex items-center gap-3 md:gap-4 select-none">
      {/* High-fidelity Vector Gold Monogram */}
      <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="goldGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#DFBA73" />
            <stop offset="50%" stopColor="#C5A880" />
            <stop offset="100%" stopColor="#9E7D46" />
          </linearGradient>
        </defs>
        {/* First R (Left) with transparent cutout */}
        <path d="M25 20 H45 C55 20, 55 40, 45 40 H30 V80 H25 V20 Z M30 30 H42 C48 30, 48 35, 42 35 H30 V30 Z" fill="url(#goldGrad2)" fillRule="evenodd" />
        
        {/* Horizontal slashes cutting through first R */}
        <rect x="12" y="36" width="24" height="2" transform="rotate(-15, 12, 36)" fill="url(#goldGrad2)" />
        <rect x="12" y="42" width="24" height="2" transform="rotate(-15, 12, 42)" fill="url(#goldGrad2)" />

        {/* Second R (Right overlapping) with transparent cutout */}
        <path d="M43 32 H63 C73 32, 73 52, 63 52 H48 V80 H43 V32 Z M48 40 H60 C66 40, 66 45, 60 45 H48 V40 Z" fill="url(#goldGrad2)" fillRule="evenodd" />
        
        {/* Slanted R tail going right option */}
        <path d="M52 52 L68 80 H74 L58 52 H52 Z" fill="url(#goldGrad2)" />

        {/* Diagonal accents next to second R tail */}
        <rect x="67" y="65" width="20" height="2" transform="rotate(-40, 67, 65)" fill="url(#goldGrad2)" />
        <rect x="72" y="70" width="20" height="2" transform="rotate(-40, 72, 70)" fill="url(#goldGrad2)" />
        <rect x="77" y="75" width="20" height="2" transform="rotate(-40, 77, 75)" fill="url(#goldGrad2)" />
      </svg>
      
      <div className="flex flex-col">
        <span className={`serif text-base md:text-lg lg:text-xl tracking-[0.05em] transition-colors duration-300 leading-none font-bold uppercase ${textColor}`}>
          RR INSIDE <span className="text-[#5A5A40] font-black">OUT</span> <span className="font-black">CREATION</span>
        </span>
        <span className="text-[7.5px] md:text-[8px] uppercase tracking-[0.38em] font-extrabold text-[#8e8d78] mt-1.5 leading-none">
          PVT. LTD.
        </span>
      </div>
    </div>
  );
};

const MagicCursor = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [trail, setTrail] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
      setIsVisible(true);
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  useEffect(() => {
    let animationFrameId: number;
    const updateTrail = () => {
      setTrail((prev) => {
        const dx = position.x - prev.x;
        const dy = position.y - prev.y;
        return {
          x: prev.x + dx * 0.15,
          y: prev.y + dy * 0.15,
        };
      });
      animationFrameId = requestAnimationFrame(updateTrail);
    };
    animationFrameId = requestAnimationFrame(updateTrail);
    return () => cancelAnimationFrame(animationFrameId);
  }, [position]);

  useEffect(() => {
    const handleHoverStart = () => setIsHovered(true);
    const handleHoverEnd = () => setIsHovered(false);

    const interactiveElements = document.querySelectorAll('a, button, select, input, textarea, [role="button"], .group, [onclick]');
    interactiveElements.forEach((el) => {
      el.addEventListener('mouseenter', handleHoverStart);
      el.addEventListener('mouseleave', handleHoverEnd);
    });

    return () => {
      interactiveElements.forEach((el) => {
        el.removeEventListener('mouseenter', handleHoverStart);
        el.removeEventListener('mouseleave', handleHoverEnd);
      });
    };
  }, []);

  if (!isVisible) return null;

  return (
    <>
      <div 
        className="fixed pointer-events-none z-[9999] w-2 h-2 bg-[#5A5A40] rounded-full -translate-x-1/2 -translate-y-1/2 hidden md:block transition-transform duration-75"
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
      />
      <div 
        className={`fixed pointer-events-none z-[9998] rounded-full border border-[#5A5A40]/40 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 hidden md:block ${
          isHovered ? 'w-16 h-16 bg-[#5A5A40]/10 border-[#5A5A40] scale-110' : 'w-10 h-10'
        }`}
        style={{ left: `${trail.x}px`, top: `${trail.y}px` }}
      />
    </>
  );
};

const TiltCard = ({ children, className = "" }: { children: React.ReactNode, className?: string, key?: any }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const card = cardRef.current;
    const box = card.getBoundingClientRect();
    const x = e.clientX - box.left;
    const y = e.clientY - box.top;
    const centerX = box.width / 2;
    const centerY = box.height / 2;
    
    const rX = ((y - centerY) / centerY) * -8;
    const rY = ((x - centerX) / centerX) * 8;
    
    setRotateX(rX);
    setRotateY(rY);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ rotateX, rotateY }}
      transition={{ type: "spring", stiffness: 350, damping: 28 }}
      style={{ transformStyle: "preserve-3d" }}
      className={`perspective-[1000px] ${className}`}
    >
      <div style={{ transform: "translateZ(20px)", transformStyle: "preserve-3d" }} className="h-full w-full">
        {children}
      </div>
    </motion.div>
  );
};

const InfiniteDesignTicker = () => {
  const tickerItems = [
    "MINIMAL MODERN",
    "BESPOKE ARCHITECTURE",
    "CURATED LIVING ENVELOPES",
    "DETAILED CRAFTSMANSHIP",
    "CONTEMPORARY INTERIORS",
    "DISTINCTIVE AESTHETIC",
    "SHAPING SPACES BEYOND IMAGINATION"
  ];

  return (
    <div className="py-7 bg-zinc-950 text-white overflow-hidden flex whitespace-nowrap border-y border-white/5 select-none font-sans">
      <div className="flex animate-marquee gap-12 text-[10px] md:text-xs uppercase tracking-[0.4em] font-bold text-zinc-300">
        {Array.from({ length: 4 }).map((_, i) => (
          <React.Fragment key={i}>
            {tickerItems.map((item, idx) => (
              <span key={idx} className="flex items-center gap-12 font-medium">
                {item}
                <span className="w-1.5 h-1.5 bg-[#5A5A40] rounded-full" />
              </span>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

const SafeVideoPlayer = ({ 
  src, 
  className = "", 
  autoPlay = false, 
  muted = false, 
  loop = false, 
  playsInline = false, 
  controls = false,
  fallbackImage = "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&q=80&w=1200",
  ...props 
}: { 
  src: string; 
  className?: string; 
  autoPlay?: boolean; 
  muted?: boolean; 
  loop?: boolean; 
  playsInline?: boolean; 
  controls?: boolean;
  fallbackImage?: string;
  [key: string]: any;
}) => {
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setHasError(false);
    if (videoRef.current) {
      videoRef.current.load();
      if (autoPlay) {
        videoRef.current.play().catch((e) => {
          console.log("Autoplay was prevented by browser, playing muted:", e);
          if (videoRef.current) videoRef.current.muted = true;
        });
      }
    }
  }, [src, autoPlay]);

  if (hasError || !src) {
    return (
      <img 
        src={fallbackImage} 
        alt="Interior Showcase" 
        className={`${className} object-cover`}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <video
      {...props}
      ref={videoRef}
      src={src}
      className={className}
      autoPlay={autoPlay}
      muted={muted}
      loop={loop}
      playsInline={playsInline}
      controls={controls}
      crossOrigin="anonymous"
      onError={() => {
        console.warn(`Failed to play video directly from ${src}, using fallback static image.`);
        setHasError(true);
      }}
    />
  );
};

const AdminDashboard = ({ onClose, user }: { onClose: () => void, user: any }) => {
  const [activeTab, setActiveTab] = useState<'enquiries' | 'visualizations' | 'users' | 'design_briefs' | 'reels' | 'testimonials' | 'audit_logs' | 'configs' | 'portfolio_projects' | 'referrals' | 'vendors' | 'jobs'>('enquiries');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [careerSubTab, setCareerSubTab] = useState<'listings' | 'applications'>('listings');
  const [applications, setApplications] = useState<any[]>([]);
  const [isAddingJob, setIsAddingJob] = useState(false);
  const [newJob, setNewJob] = useState({
    title: '',
    department: 'Design',
    experience: '2-4 Years',
    location: 'Gurgaon',
    type: 'Full-time',
    description: '',
    salary: 'Market Standard',
    active: true
  });
  const [editingProject, setEditingProject] = useState<any | null>(null);
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [isAddingTestimonial, setIsAddingTestimonial] = useState(false);
  const [newTestimonial, setNewTestimonial] = useState({
    name: '',
    role: '',
    text: '',
    image: '',
    location: 'Gurgaon'
  });
  const [newReel, setNewReel] = useState({
    videoUrl: '', // Changed from url to videoUrl to match model
    title: '',
    pinned: false
  });
  const [isAddingReel, setIsAddingReel] = useState(false);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProject, setNewProject] = useState<PortfolioProject>({
    image: '',
    title: '',
    category: 'Luxury Residential',
    location: '',
    area: '',
    description: '',
    gallery: []
  });

  const [editingConfig, setEditingConfig] = useState<LandingPageConfig | null>(null);

  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void> | void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const handleAddJob = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, 'jobs'), {
        ...newJob,
        createdAt: serverTimestamp()
      });
      await logAuditAction('CREATE', 'jobs', docRef.id, `Created job posting: ${newJob.title}`);
      setIsAddingJob(false);
      setNewJob({
        title: '',
        department: 'Design',
        experience: '2-4 Years',
        location: 'Gurgaon',
        type: 'Full-time',
        description: '',
        salary: 'Market Standard',
        active: true
      });
    } catch (error) {
      console.error("Error adding job opening:", error);
    }
  };

  const handleAddReel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, 'reels'), {
        ...newReel,
        createdAt: serverTimestamp()
      });
      await logAuditAction('CREATE', 'reels', docRef.id, `Added new reel: ${newReel.title}`);
      setIsAddingReel(false);
      setNewReel({ videoUrl: '', title: '', pinned: false });
    } catch (error) {
      console.error("Error adding reel:", error);
    }
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, 'portfolio_projects'), {
        ...newProject,
        createdAt: serverTimestamp()
      });
      await logAuditAction('CREATE', 'portfolio_projects', docRef.id, `Added new project: ${newProject.title}`);
      setIsAddingProject(false);
      setNewProject({
        image: '',
        title: '',
        category: 'Luxury Residential',
        location: '',
        area: '',
        description: '',
        gallery: []
      });
    } catch (error) {
      console.error("Error adding project:", error);
    }
  };

  const seedGurgaonProjects = async () => {
    try {
      const projectsToSeed = [
        {
          image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=1200",
          title: "The DLF Kings Court Villa",
          category: "Luxury Residential",
          location: "DLF Phase 1, Gurgaon",
          area: "9,500 sq.ft",
          description: "A majestic modern villa featuring bespoke hand-carved stone claddings, triple-height ceilings, a private glass elevator, and custom Italian marble flooring. Each bedroom is curated with a personalized lighting layout and custom veneer wood paneling, reflecting Indian warmth with European minimal elegance.",
          gallery: [
            "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1617806118233-18e1db208586?auto=format&fit=crop&q=80&w=1200"
          ]
        },
        {
          image: "https://images.unsplash.com/photo-1600607687940-c52af096999c?auto=format&fit=crop&q=80&w=1200",
          title: "The Camellias Sky Penthouse",
          category: "Luxury Interior",
          location: "Golf Course Road, Gurgaon",
          area: "6,800 sq.ft",
          description: "A premium high-floor sanctuary overlooking the Aravallis. This ultra-luxury apartment was designed with curated metal accents, custom acoustical plaster, hidden motorized bar consoles, and a bespoke art vestibule. Floor-to-ceiling glass paneling integrates the interior with a panoramic reflexology terrace.",
          gallery: [
            "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1616486029423-aaa4789e8c9a?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1618219908412-a29a1bb7b86e?auto=format&fit=crop&q=80&w=1200"
          ]
        },
        {
          image: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1200",
          title: "Cyber Hub Innovation Chambers",
          category: "Corporate Workspace",
          location: "DLF CyberCity, Gurgaon",
          area: "24,000 sq.ft",
          description: "An avant-garde corporate headquarter combining smart automation, biophilic green zones, and double-glazed acoustics. Crafted for a high-performing global team, it features soundproof collaboration pods, a dedicated gourmet espresso bar, customized ergonomic work bays, and ambient architectural lighting.",
          gallery: [
            "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1531834215091-62544e4569ce?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1556761175-4b46a572b186?auto=format&fit=crop&q=80&w=1200"
          ]
        },
        {
          image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=1200",
          title: "The Grand Aravalli Resort",
          category: "Commercial Work",
          location: "Sohna Road, Gurgaon",
          area: "45,000 sq.ft",
          description: "A luxury lifestyle boutique hotel featuring majestic arches, custom terrazzo paving, and premium indoor wellness pavilions. Incorporating hand-loomed Indian silk fabrics and local stone carvings with a clean contemporary canvas, this space defines elite business and hospitality in Gurgaon.",
          gallery: [
            "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&q=80&w=1200",
            "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&q=80&w=1200"
          ]
        }
      ];

      for (const p of projectsToSeed) {
        const docRef = await addDoc(collection(db, 'portfolio_projects'), {
          ...p,
          createdAt: serverTimestamp()
        });
        await logAuditAction('CREATE', 'portfolio_projects', docRef.id, `Seeded high-end Gurgaon project: ${p.title}`);
      }
    } catch (error) {
      console.error("Error seeding projects:", error);
    }
  };

  const handleEditProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;
    try {
      await updateDoc(doc(db, 'portfolio_projects', editingProject.id), {
        title: editingProject.title || '',
        category: editingProject.category || 'Luxury Residential',
        location: editingProject.location || '',
        area: editingProject.area || '',
        image: editingProject.image || '',
        description: editingProject.description || '',
        gallery: editingProject.gallery || []
      });
      await logAuditAction('UPDATE', 'portfolio_projects', editingProject.id, `Updated portfolio project: ${editingProject.title}`);
      setIsEditingProject(false);
      setEditingProject(null);
    } catch (error) {
      console.error("Error updating project:", error);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConfig) return;
    try {
      await setDoc(doc(db, 'configs', 'landing_page'), {
        ...editingConfig,
        updatedAt: serverTimestamp()
      });
      await logAuditAction('UPDATE', 'configs', 'landing_page', `Updated landing page images`);
      alert("Landing page configuration updated successfully!");
    } catch (error) {
      console.error("Error saving config:", error);
      alert("Failed to update landing page configuration.");
    }
  };

  const logAuditAction = async (action: string, targetCollection: string, targetId: string, details: string) => {
    try {
      await addDoc(collection(db, 'audit_logs'), {
        adminId: user?.uid,
        adminEmail: user?.email,
        action,
        targetCollection,
        targetId,
        details,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error logging audit action:", error);
    }
  };

  useEffect(() => {
    setLoading(true);
    if (activeTab === 'configs') {
      const unsub = onSnapshot(doc(db, 'configs', 'landing_page'), (snapshot) => {
        if (snapshot.exists()) {
          const configData = snapshot.data() as LandingPageConfig;
          setData([ { id: snapshot.id, ...configData } ]);
          setEditingConfig(configData);
        } else {
          // Initialize defaults if not present
          const defaults = {
            hero_bg: "https://images.unsplash.com/photo-1620626011761-9963d7b69763?auto=format&fit=crop&q=80&w=2000",
            philosophy_img: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&q=80&w=1200",
            service1_img: "https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?auto=format&fit=crop&q=80&w=1200",
            service2_img: "https://images.unsplash.com/photo-1600607687940-c52af096999c?auto=format&fit=crop&q=80&w=1200",
            service3_img: "https://images.unsplash.com/photo-1600607687644-c7171bb3e299?auto=format&fit=crop&q=80&w=1200",
            portfolio_video: "https://assets.mixkit.co/videos/preview/mixkit-luxury-interior-design-of-a-living-room-34502-large.mp4"
          };
          setData([ { id: 'landing_page', ...defaults } ]);
          setEditingConfig(defaults);
        }
        setLoading(false);
      }, (error) => {
        console.error(`Error fetching configs:`, error);
        setLoading(false);
      });
      return () => unsub();
    }

    if (activeTab === 'jobs') {
      const unsubApps = onSnapshot(collection(db, 'job_applications'), (snapshot) => {
        setApplications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (err) => {
        console.error("Error fetching job applications:", err);
      });
      
      const q = query(collection(db, 'jobs'), orderBy('createdAt', 'desc'));
      const unsubJobs = onSnapshot(q, (snapshot) => {
        setData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      }, (err) => {
        console.warn("Could not fetch jobs sorted, fallback to unsorted:", err);
        const unsubFallback = onSnapshot(collection(db, 'jobs'), (snapshot) => {
          setData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          setLoading(false);
        });
      });

      return () => {
        unsubApps();
        unsubJobs();
      };
    }

    const q = query(collection(db, activeTab), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setData(docs);
      setLoading(false);
    }, (error) => {
      console.error(`Error fetching ${activeTab}:`, error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [activeTab]);

  const executeDelete = async (id: string, tabName: string) => {
    try {
      if (tabName === 'reels') {
        const docRef = doc(db, 'reels', id);
        await deleteDoc(docRef);
        await logAuditAction('DELETE', 'reels', id, `Deleted Instagram reel document: ${id}`);
        return;
      }
      await deleteDoc(doc(db, tabName, id));
      await logAuditAction('DELETE', tabName, id, `Deleted item from ${tabName}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${tabName}/${id}`);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteDialog({
      isOpen: true,
      title: 'Confirm Deletion',
      message: `Are you sure you want to delete this item? This action is permanent and cannot be undone.`,
      onConfirm: async () => {
        await executeDelete(id, activeTab);
        setDeleteDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleAddTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, 'testimonials'), {
        ...newTestimonial,
        createdAt: serverTimestamp()
      });
      await logAuditAction('CREATE', 'testimonials', docRef.id, `Added new testimonial for ${newTestimonial.name}`);
      setIsAddingTestimonial(false);
      setNewTestimonial({ name: '', role: '', text: '', image: '', location: 'Gurgaon' });
    } catch (error) {
      console.error("Error adding testimonial:", error);
    }
  };

  const tabs = [
    { id: 'enquiries', label: 'Enquiries', icon: MessageSquare },
    { id: 'portfolio_projects', label: 'Portfolio', icon: Layers },
    { id: 'configs', label: 'Landing Page UI', icon: Settings },
    { id: 'jobs', label: 'Careers & Jobs', icon: Briefcase },
    { id: 'visualizations', label: 'Visualizations', icon: Sparkles },
    { id: 'referrals', label: 'Partner Referrals', icon: UserPlus },
    { id: 'vendors', label: 'Vendors Onboarded', icon: Hammer },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'design_briefs', label: 'Design Briefs', icon: FileText },
    { id: 'reels', label: 'Instagram Reels', icon: Video },
    { id: 'testimonials', label: 'Testimonials', icon: Quote },
    { id: 'audit_logs', label: 'Audit Logs', icon: ClipboardList },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-white flex flex-col"
    >
      {/* Header */}
      <header className="px-8 py-4 border-b border-zinc-100 flex justify-between items-center bg-white">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center text-white font-bold text-xl">RR</div>
          <div>
            <h1 className="text-sm font-bold uppercase tracking-widest text-zinc-900">Admin Dashboard</h1>
            <p className="text-[10px] text-zinc-400 uppercase tracking-widest">Management Console</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
        >
          <X size={20} className="text-zinc-500" />
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-zinc-100 bg-zinc-50/50 p-6 overflow-y-auto">
          <nav className="space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[11px] uppercase tracking-widest font-bold transition-all ${
                  activeTab === tab.id 
                    ? 'bg-[#5A5A40] text-white shadow-md' 
                    : 'text-zinc-500 hover:bg-zinc-100'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-8 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-semibold serif text-zinc-900 capitalize">{activeTab}</h2>
                <p className="text-xs text-zinc-500 mt-1">Manage and monitor your {activeTab} data in real-time.</p>
              </div>
              {activeTab === 'portfolio_projects' && (
                <div className="flex gap-3">
                  <button 
                    onClick={seedGurgaonProjects}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-900 text-[10px] uppercase tracking-widest font-bold rounded-md hover:bg-amber-100 transition-all shadow-sm"
                  >
                    <Sparkles size={14} className="text-amber-700 animate-pulse" />
                    Seed Gurgaon Projects
                  </button>
                  <button 
                    onClick={() => setIsAddingProject(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#5A5A40] text-white text-[10px] uppercase tracking-widest font-bold rounded-md hover:bg-zinc-900 transition-all"
                  >
                    <PlusCircle size={14} />
                    Add Project
                  </button>
                </div>
              )}
              {activeTab === 'configs' && (
                <button 
                  onClick={handleSaveConfig}
                  className="flex items-center gap-2 px-6 py-2 bg-[#5A5A40] text-white text-[10px] uppercase tracking-widest font-bold rounded-md hover:bg-zinc-900 transition-all shadow-lg"
                >
                  <CheckCircle2 size={14} />
                  Save Changes
                </button>
              )}
              {activeTab === 'testimonials' && (
                <button 
                  onClick={() => setIsAddingTestimonial(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#5A5A40] text-white text-[10px] uppercase tracking-widest font-bold rounded-md hover:bg-zinc-900 transition-all"
                >
                  <PlusCircle size={14} />
                  Add Testimonial
                </button>
              )}
              {activeTab === 'reels' && (
                <button 
                  onClick={() => setIsAddingReel(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#5A5A40] text-white text-[10px] uppercase tracking-widest font-bold rounded-md hover:bg-zinc-900 transition-all"
                >
                  <PlusCircle size={14} />
                  Add Reel
                </button>
              )}
              {activeTab === 'jobs' && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setCareerSubTab('listings')}
                    className={`px-4 py-2 text-[10px] uppercase tracking-widest font-bold rounded-md transition-all ${careerSubTab === 'listings' ? 'bg-[#5A5A40] text-white shadow' : 'bg-zinc-100 text-zinc-650 hover:bg-zinc-200'}`}
                  >
                    Job Listings
                  </button>
                  <button 
                    onClick={() => setCareerSubTab('applications')}
                    className={`px-4 py-2 text-[10px] uppercase tracking-widest font-bold rounded-md transition-all ${careerSubTab === 'applications' ? 'bg-[#5A5A40] text-white shadow' : 'bg-zinc-100 text-zinc-655 hover:bg-zinc-200'}`}
                  >
                    Applications Received ({applications?.length || 0})
                  </button>
                  {careerSubTab === 'listings' && (
                    <button 
                      onClick={() => setIsAddingJob(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-[10px] uppercase tracking-widest font-bold rounded-md hover:bg-zinc-900 transition-all ml-2 shadow"
                    >
                      <PlusCircle size={14} />
                      Post Vacancy
                    </button>
                  )}
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-[#5A5A40]" size={32} />
              </div>
            ) : (activeTab === 'jobs' && careerSubTab === 'applications') ? (
              applications.length === 0 ? (
                <div className="text-center py-20 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200">
                  <AlertCircle className="mx-auto text-zinc-300 mb-4" size={48} />
                  <p className="text-zinc-500 font-medium">No job applications received yet.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {applications.map((app) => (
                    <motion.div 
                      layout
                      key={app.id}
                      className="p-6 bg-white border border-zinc-100 rounded-xl hover:shadow-md transition-all group"
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-4 flex-1">
                          <div>
                            <div className="flex items-center gap-3">
                              <span className="text-base font-bold text-zinc-900">{app.name}</span>
                              <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[9px] uppercase font-bold rounded-full">
                                {app.jobTitle || 'General Application'}
                              </span>
                              <span className="px-2.5 py-1 bg-amber-50 text-amber-700 text-[9px] uppercase font-bold rounded-full">
                                {app.status || 'Pending'}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-[11px] text-zinc-500 mt-2">
                              <span><strong>Email:</strong> {app.email}</span>
                              <span><strong>Phone:</strong> {app.phone}</span>
                              {app.experience && <span><strong>Experience:</strong> {app.experience}</span>}
                              {app.portfolioUrl && (
                                <a href={app.portfolioUrl} target="_blank" rel="noreferrer" className="text-[#5A5A40] underline font-bold flex items-center gap-1 text-[10px]">
                                  <ExternalLink size={11} /> Portfolio
                                </a>
                              )}
                            </div>
                          </div>

                          {app.coverLetter && (
                            <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-100">
                              <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 mb-1">Candidate Notes / Cover Letter</p>
                              <p className="text-xs text-zinc-650 font-light leading-relaxed whitespace-pre-line">{app.coverLetter}</p>
                            </div>
                          )}

                          <div className="flex items-center gap-3">
                            <a 
                              href={app.resumeUrl} 
                              target="_blank" 
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-900 text-white hover:bg-[#5A5A40] text-[10px] uppercase tracking-widest font-bold rounded-md transition-all shadow-sm"
                            >
                              <Download size={12} />
                              Download/View Resume
                            </a>
                          </div>

                          <div className="text-[9px] uppercase tracking-widest font-bold text-zinc-400">
                            Submitted: {app.createdAt?.toDate ? app.createdAt.toDate().toLocaleString() : app.createdAt ? new Date(app.createdAt).toLocaleString() : 'Date Pending'}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              setDeleteDialog({
                                isOpen: true,
                                title: 'Delete Candidate Application',
                                message: `Are you sure you want to delete the candidate application of ${app.name}? This action is permanent and cannot be undone.`,
                                onConfirm: async () => {
                                  try {
                                    await deleteDoc(doc(db, 'job_applications', app.id));
                                    await logAuditAction('DELETE', 'job_applications', app.id, `Deleted application of: ${app.name}`);
                                  } catch (e) {
                                    console.error(e);
                                  }
                                  setDeleteDialog(prev => ({ ...prev, isOpen: false }));
                                }
                              });
                            }}
                            className="p-2 text-zinc-300 hover:text-red-550 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete Application"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )
            ) : data.length === 0 ? (
              <div className="text-center py-20 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200">
                <AlertCircle className="mx-auto text-zinc-300 mb-4" size={48} />
                <p className="text-zinc-500 font-medium">No {activeTab} found.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {data.map((item) => (
                  <motion.div 
                    layout
                    key={item.id}
                    className="p-6 bg-white border border-zinc-100 rounded-xl hover:shadow-md transition-all group"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        {activeTab === 'configs' && editingConfig && (
                          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 w-full p-4">
                            <div className="space-y-4">
                              <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Hero BG Image</label>
                              <div className="flex gap-2">
                                <input value={editingConfig.hero_bg} onChange={e => setEditingConfig({...editingConfig, hero_bg: e.target.value})} className="flex-1 text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-none outline-none focus:border-[#5A5A40]" />
                                <ImageUploadButton onUploaded={(url) => setEditingConfig({...editingConfig, hero_bg: url})} />
                              </div>
                              <img src={editingConfig.hero_bg} className="h-44 w-full object-cover rounded-none shadow-md border border-zinc-200" />
                            </div>
                            <div className="space-y-4">
                              <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Philosophy Image</label>
                              <div className="flex gap-2">
                                <input value={editingConfig.philosophy_img} onChange={e => setEditingConfig({...editingConfig, philosophy_img: e.target.value})} className="flex-1 text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-none outline-none focus:border-[#5A5A40]" />
                                <ImageUploadButton onUploaded={(url) => setEditingConfig({...editingConfig, philosophy_img: url})} />
                              </div>
                              <img src={editingConfig.philosophy_img} className="h-44 w-full object-cover rounded-none shadow-md border border-zinc-200" />
                            </div>
                            <div className="space-y-4">
                              <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Portfolio Video URL</label>
                              <div className="flex gap-2">
                                <input value={editingConfig.portfolio_video} onChange={e => setEditingConfig({...editingConfig, portfolio_video: e.target.value})} className="flex-1 text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-none outline-none focus:border-[#5A5A40]" />
                                <ImageUploadButton label="Upload Video" accept="video/*" onUploaded={(url) => setEditingConfig({...editingConfig, portfolio_video: url})} />
                              </div>
                              <div className="h-44 bg-zinc-950 rounded-none overflow-hidden flex items-center justify-center border border-zinc-250">
                                {editingConfig.portfolio_video ? (
                                  <SafeVideoPlayer src={editingConfig.portfolio_video} className="h-full w-full object-cover" controls muted />
                                ) : (
                                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">No Video</span>
                                )}
                              </div>
                            </div>
                            <div className="space-y-4">
                              <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Service 1 Image (Luxury)</label>
                              <div className="flex gap-2">
                                <input value={editingConfig.service1_img} onChange={e => setEditingConfig({...editingConfig, service1_img: e.target.value})} className="flex-1 text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-none outline-none focus:border-[#5A5A40]" />
                                <ImageUploadButton onUploaded={(url) => setEditingConfig({...editingConfig, service1_img: url})} />
                              </div>
                              <img src={editingConfig.service1_img} className="h-44 w-full object-cover rounded-none shadow-md border border-zinc-200" />
                            </div>
                            <div className="space-y-4">
                              <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Service 2 Image (Arch)</label>
                              <div className="flex gap-2">
                                <input value={editingConfig.service2_img} onChange={e => setEditingConfig({...editingConfig, service2_img: e.target.value})} className="flex-1 text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-none outline-none focus:border-[#5A5A40]" />
                                <ImageUploadButton onUploaded={(url) => setEditingConfig({...editingConfig, service2_img: url})} />
                              </div>
                              <img src={editingConfig.service2_img} className="h-44 w-full object-cover rounded-none shadow-md border border-zinc-200" />
                            </div>
                            <div className="space-y-4">
                              <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Service 3 Image (Loft)</label>
                              <div className="flex gap-2">
                                <input value={editingConfig.service3_img} onChange={e => setEditingConfig({...editingConfig, service3_img: e.target.value})} className="flex-1 text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-none outline-none focus:border-[#5A5A40]" />
                                <ImageUploadButton onUploaded={(url) => setEditingConfig({...editingConfig, service3_img: url})} />
                              </div>
                              <img src={editingConfig.service3_img} className="h-44 w-full object-cover rounded-none shadow-md border border-zinc-200" />
                            </div>
                          </div>
                        )}
                        {activeTab === 'portfolio_projects' && (
                          <div className="flex flex-col md:flex-row gap-8 w-full">
                            <div className="w-full md:w-64 h-48 rounded-xl overflow-hidden shadow-md border border-zinc-100">
                              <img src={item.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-xl font-bold text-zinc-900 serif">{item.title}</span>
                                <span className="px-3 py-1 bg-[#5A5A40]/10 text-[#5A5A40] text-[9px] uppercase font-bold rounded-full">{item.category}</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-4 text-[10px] text-zinc-400 font-bold uppercase tracking-[0.2em] mb-4">
                                <span className="flex items-center gap-1.5"><MapPin size={12} className="text-[#5A5A40]" /> {item.location}</span>
                                <span className="flex items-center gap-1.5"><Building2 size={12} className="text-[#5A5A40]" /> {item.area}</span>
                              </div>
                              <p className="text-sm text-zinc-500 font-light leading-relaxed mb-6 line-clamp-3">{item.description}</p>
                              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                                {item.gallery?.map((img: string, idx: number) => (
                                  <div key={idx} className="w-16 h-16 rounded-lg overflow-hidden border border-zinc-100 shadow-sm shrink-0">
                                    <img src={img} className="w-full h-full object-cover" />
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                        {activeTab === 'jobs' && (
                          <div className="w-full text-left">
                            <div className="flex items-center gap-3">
                              <span className="text-base font-bold text-zinc-900">{item.title}</span>
                              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[9px] uppercase font-bold rounded">
                                {item.department}
                              </span>
                              <span className="px-2 py-0.5 bg-[#5A5A40]/10 text-[#5A5A40] text-[9px] uppercase font-bold rounded">
                                {item.location}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-[11px] text-zinc-550 mt-1">
                              <span><strong>Exp:</strong> {item.experience}</span>
                              <span><strong>Type:</strong> {item.type}</span>
                              <span><strong>Salary:</strong> {item.salary}</span>
                            </div>
                            <div className="mt-3">
                              <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 mb-1">Description</p>
                              <p className="text-xs text-zinc-600 leading-relaxed whitespace-pre-line bg-zinc-50 border border-zinc-100 p-3 rounded">{item.description}</p>
                            </div>
                          </div>
                        )}
                        {activeTab === 'enquiries' && (
                          <>
                            <div className="flex justify-between items-start w-full">
                              <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                  <span className="text-base font-bold text-zinc-900">{item.name}</span>
                                  <span className="px-2 py-0.5 bg-[#5A5A40]/10 text-[#5A5A40] text-[9px] uppercase font-bold rounded">{item.projectType}</span>
                                  <span className="px-2 py-0.5 bg-zinc-100 text-zinc-500 text-[9px] uppercase font-bold rounded">{item.projectScale}</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-4 text-[11px] text-zinc-500">
                                  <span className="flex items-center gap-1.5"><Mail size={12} className="text-zinc-400" /> {item.email}</span>
                                  <span className="flex items-center gap-1.5"><Phone size={12} className="text-zinc-400" /> {item.phone}</span>
                                  <span className="flex items-center gap-1.5"><MapPin size={12} className="text-[#5A5A40]" /> {item.location}</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 mt-4 p-4 bg-zinc-50 rounded-lg">
                                  <div>
                                    <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 mb-1">Budget</p>
                                    <p className="text-xs font-bold text-zinc-800">{item.budgetRange}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 mb-1">Area</p>
                                    <p className="text-xs font-bold text-zinc-800">{item.estimatedArea} sq.ft</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 mb-1">Timeline</p>
                                    <p className="text-xs font-bold text-zinc-800">{item.timeline}</p>
                                  </div>
                                </div>
                                <div className="mt-4">
                                  <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 mb-2">Requirements</p>
                                  <p className="text-xs text-zinc-600 leading-relaxed bg-white border border-zinc-100 p-3 rounded">{item.details}</p>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                        {activeTab === 'visualizations' && (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-zinc-900">{item.roomType}</span>
                              <span className="px-2 py-0.5 bg-[#5A5A40]/10 text-[#5A5A40] text-[9px] uppercase font-bold rounded">{item.style}</span>
                            </div>
                            <div className="flex items-center gap-4 text-[11px] text-zinc-500">
                              <span className="flex items-center gap-1"><UserIcon size={12} /> {item.userEmail}</span>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-2">Original</p>
                                <img src={item.originalImage} className="w-full h-32 object-cover rounded-lg" referrerPolicy="no-referrer" />
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-2">AI Visualized</p>
                                <img src={item.visualizedImage} className="w-full h-32 object-cover rounded-lg" referrerPolicy="no-referrer" />
                              </div>
                            </div>
                          </>
                        )}
                        {activeTab === 'users' && (
                          <div className="flex items-center gap-4">
                            <img src={item.photoURL} className="w-12 h-12 rounded-full object-cover" referrerPolicy="no-referrer" />
                            <div>
                              <p className="text-sm font-bold text-zinc-900">{item.displayName}</p>
                              <p className="text-xs text-zinc-500">{item.email}</p>
                              <span className="inline-block mt-1 px-2 py-0.5 bg-zinc-100 text-zinc-500 text-[9px] uppercase font-bold rounded">{item.role}</span>
                            </div>
                          </div>
                        )}
                        {activeTab === 'testimonials' && (
                          <div className="flex gap-4">
                            <img src={item.image} className="w-16 h-16 rounded-xl object-cover" referrerPolicy="no-referrer" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-zinc-900">{item.name}</span>
                                <span className="text-[10px] text-zinc-400 uppercase tracking-widest">{item.location}</span>
                              </div>
                              <p className="text-xs text-[#5A5A40] font-medium">{item.role}</p>
                              <p className="text-xs text-zinc-600 mt-2 italic">"{item.text}"</p>
                            </div>
                          </div>
                        )}
                        {activeTab === 'reels' && (
                          <div className="flex gap-4">
                            <div className="w-24 h-40 bg-zinc-100 rounded-lg overflow-hidden flex items-center justify-center">
                              <Video size={24} className="text-zinc-300" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-bold text-zinc-900">{item.title || 'Instagram Reel'}</p>
                              <p className="text-xs text-zinc-500 truncate max-w-xs">{item.videoUrl}</p>
                              <div className="flex items-center gap-3 mt-4">
                                <a href={item.videoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold text-[#5A5A40] hover:text-zinc-900">
                                  View on Instagram <ExternalLink size={10} />
                                </a>
                                {item.pinned && (
                                  <span className="flex items-center gap-1 text-[9px] uppercase font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                                    <Sparkles size={10} /> Pinned
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        {activeTab === 'design_briefs' && (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-zinc-900">{item.roomType}</span>
                              <span className="px-2 py-0.5 bg-zinc-100 text-zinc-500 text-[9px] uppercase font-bold rounded">{item.budget}</span>
                            </div>
                            <p className="text-xs text-zinc-500">Client: {item.userEmail}</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {item.preferences?.map((pref: string, idx: number) => (
                                <span key={idx} className="px-2 py-0.5 bg-zinc-50 text-zinc-400 text-[9px] uppercase font-bold rounded border border-zinc-100">{pref}</span>
                              ))}
                            </div>
                          </>
                        )}
                        {activeTab === 'audit_logs' && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 text-[9px] uppercase font-bold rounded ${
                                item.action === 'DELETE' ? 'bg-red-100 text-red-600' : 
                                item.action === 'CREATE' ? 'bg-green-100 text-green-600' : 
                                'bg-blue-100 text-blue-600'
                              }`}>
                                {item.action}
                              </span>
                              <span className="text-sm font-bold text-zinc-900">{item.targetCollection}</span>
                            </div>
                            <p className="text-xs text-zinc-600">{item.details}</p>
                            <p className="text-[10px] text-zinc-400">By: {item.adminEmail}</p>
                          </div>
                        )}
                        {activeTab === 'referrals' && (
                          <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 pb-4">
                              <div className="flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-[#5A5A40]/10 text-[#5A5A40] flex items-center justify-center">
                                  <UserPlus size={14} />
                                </span>
                                <div>
                                  <h4 className="text-sm font-bold text-zinc-900">Referral from {item.referrerName}</h4>
                                  <p className="text-xs text-zinc-400 font-light mt-0.5">{item.referrerEmail} • {item.referrerPhone}</p>
                                </div>
                              </div>
                              <div>
                                <select
                                  value={item.status || 'reviewing'}
                                  onChange={async (e) => {
                                    try {
                                      await updateDoc(doc(db, 'referrals', item.id), {
                                        status: e.target.value
                                      });
                                      await logAuditAction('UPDATE', 'referrals', item.id, `Status updated to ${e.target.value}`);
                                    } catch (err) {
                                      console.error("Error updating referral status:", err);
                                    }
                                  }}
                                  className="text-xs font-bold uppercase tracking-widest px-3 py-1.5 border border-zinc-200 bg-white text-zinc-700 outline-none rounded-lg focus:border-[#5A5A40] cursor-pointer"
                                >
                                  <option value="reviewing">🔍 Reviewing</option>
                                  <option value="contacted">📞 Contacted Client</option>
                                  <option value="converted">🎉 Converted (₹1L Earned)</option>
                                  <option value="payout_done">🤝 Payout Disbursed</option>
                                  <option value="not_converted">❌ Not Converted</option>
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-50/50 p-4 rounded-xl border border-zinc-150">
                              <div className="space-y-2">
                                <span className="text-[10px] uppercase font-bold text-[#8e8d78] tracking-wider">Prospect Profile</span>
                                <div className="space-y-1">
                                  <p className="text-sm font-semibold text-zinc-900">{item.clientName}</p>
                                  <p className="text-xs text-zinc-500 font-normal">Phone: {item.clientPhone}</p>
                                  {item.clientEmail && <p className="text-xs text-zinc-500 font-normal">Email: {item.clientEmail}</p>}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <span className="text-[10px] uppercase font-bold text-[#8e8d78] tracking-wider">Project Scope</span>
                                <div className="space-y-1">
                                  <p className="text-xs text-zinc-800 font-bold">{item.projectType}</p>
                                  <p className="text-xs text-zinc-500 font-normal">Location: {item.location}</p>
                                </div>
                              </div>
                            </div>

                            {item.referrerUpi && (
                              <div className="bg-emerald-50/50 text-[#5A5A40] border border-emerald-100 p-3 rounded-lg flex items-center justify-between text-xs">
                                <span><strong>Referrer UPI:</strong> {item.referrerUpi}</span>
                                <span className="text-[10px] uppercase tracking-wider bg-emerald-100 px-2 py-0.5 rounded font-bold">UPI ID Attached</span>
                              </div>
                            )}

                            {item.details && (
                              <div className="space-y-1 pt-2">
                                <span className="text-[10px] uppercase font-bold text-[#8e8d78] tracking-wider">Referrer Insights</span>
                                <p className="text-xs text-zinc-600 bg-white border border-zinc-100 p-3 rounded-lg italic">
                                  "{item.details}"
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                        {activeTab === 'vendors' && (
                          <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 pb-4">
                              <div className="flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                                  <Users size={14} />
                                </span>
                                <div>
                                  <h4 className="text-sm font-bold text-zinc-900">{item.companyName || item.businessName || 'Onboarding Partner'}</h4>
                                  <p className="text-xs text-zinc-400 font-light mt-0.5">{item.contactName || item.contactPerson} • {item.email} • {item.phone}</p>
                                </div>
                              </div>
                              <div>
                                <select
                                  value={item.status || 'reviewing'}
                                  onChange={async (e) => {
                                    try {
                                      await updateDoc(doc(db, 'vendors', item.id), {
                                        status: e.target.value
                                      });
                                      await logAuditAction('UPDATE', 'vendors', item.id, `Vendor status updated to ${e.target.value}`);
                                    } catch (err) {
                                      console.error("Error updating vendor status:", err);
                                    }
                                  }}
                                  className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 border border-zinc-200 bg-white text-zinc-700 outline-none rounded-lg focus:border-[#5A5A40] cursor-pointer"
                                >
                                  <option value="reviewing">🔍 Pending Review</option>
                                  <option value="onboarded">🤝 Vetted Partner</option>
                                  <option value="rejected">❌ Not Approved</option>
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-amber-50/5 p-4 rounded-xl border border-zinc-150">
                              <div className="space-y-2">
                                <span className="text-[10px] uppercase font-bold text-[#8e8d78] tracking-wider">Expertise & Services</span>
                                <div className="space-y-1">
                                  <p className="text-sm font-semibold text-zinc-900">{item.services || item.specialty || 'General Vendor'}</p>
                                  <p className="text-xs text-zinc-500 font-normal">Past client works: {item.pastProjects || 'None listed'}</p>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <span className="text-[10px] uppercase font-bold text-[#8e8d78] tracking-wider font-mono">Operations Info</span>
                                <div className="space-y-1 font-mono text-xs text-zinc-650">
                                  <p>Experience: {item.experience || 'Not filled'}</p>
                                  <p>Location: {item.location || 'Not specified'}</p>
                                </div>
                              </div>
                            </div>

                            {item.details && (
                              <div className="space-y-1 pt-2">
                                <span className="text-[10px] uppercase font-bold text-[#8e8d78] tracking-wider">Workshop Facilities & Notes</span>
                                <p className="text-xs text-zinc-600 bg-white border border-zinc-100 p-3 rounded-lg italic">
                                  "{item.details}"
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 mt-4">
                          ID: {item.id} • {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Date Pending'}
                        </div>
                      </div>
                      {activeTab !== 'audit_logs' && (
                        <div className="flex gap-2">
                          {activeTab === 'portfolio_projects' && (
                            <button 
                              onClick={() => {
                                setEditingProject(item);
                                setIsEditingProject(true);
                              }}
                              className="p-2 text-zinc-400 hover:text-[#5A5A40] hover:bg-zinc-50 rounded-lg transition-all"
                              title="Edit Project"
                            >
                              <Settings size={16} />
                            </button>
                          )}
                          <button 
                            onClick={() => handleDelete(item.id)}
                            className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-55 rounded-lg transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Add Job Modal */}
      <AnimatePresence>
        {isAddingJob && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingJob(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] overflow-y-auto z-10"
            >
              <div className="px-8 py-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
                <h3 className="text-lg font-semibold serif text-zinc-900">Post a New Job Vacancy</h3>
                <button onClick={() => setIsAddingJob(false)} className="p-2 hover:bg-zinc-200 rounded-full">
                  <X size={18} className="text-zinc-500" />
                </button>
              </div>
              <form onSubmit={handleAddJob} className="p-8 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 block mb-1">Job Title *</label>
                    <input 
                      required
                      type="text"
                      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                      placeholder="e.g. Senior Architect"
                      value={newJob.title}
                      onChange={e => setNewJob({...newJob, title: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 block mb-1">Department</label>
                    <select 
                      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                      value={newJob.department}
                      onChange={e => setNewJob({...newJob, department: e.target.value})}
                    >
                      <option value="Design">Interior Design</option>
                      <option value="Architecture">Architecture</option>
                      <option value="Execution">Project Management / Execution</option>
                      <option value="Business Development">BD & Marketing</option>
                      <option value="Finance">Finance & Administration</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 block mb-1">Salary Range</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                      placeholder="e.g. 5-8 LPA / Negotiable"
                      value={newJob.salary}
                      onChange={e => setNewJob({...newJob, salary: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 block mb-1">Location</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-2.5 bg-[#FAF8F3] border border-zinc-200 rounded-lg text-xs font-semibold"
                      value={newJob.location}
                      onChange={e => setNewJob({...newJob, location: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 block mb-1">Required Experience</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-2.5 bg-[#FAF8F3] border border-zinc-200 rounded-lg text-xs font-semibold"
                      placeholder="e.g. 3-5 Years"
                      value={newJob.experience}
                      onChange={e => setNewJob({...newJob, experience: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 block mb-1">Job Type</label>
                    <select 
                      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                      value={newJob.type}
                      onChange={e => setNewJob({...newJob, type: e.target.value})}
                    >
                      <option value="Full-time">Full-time</option>
                      <option value="Part-time">Part-time</option>
                      <option value="Contract">Bespoke Contract</option>
                      <option value="Internship">Internship</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 block mb-1">Job Description & Core Scope *</label>
                  <textarea 
                    required
                    rows={4}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs whitespace-pre-line"
                    placeholder="Provide full roles, responsibilities, and key design specialties required..."
                    value={newJob.description}
                    onChange={e => setNewJob({...newJob, description: e.target.value})}
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 bg-zinc-900 text-white rounded-xl font-bold uppercase tracking-widest text-[11px] hover:bg-[#5A5A40] transition-all shadow-lg mt-4"
                >
                  Create & Post Job
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Reel Modal */}
      <AnimatePresence>
        {isAddingReel && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingReel(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-zinc-100 flex justify-between items-center">
                <h3 className="text-xl font-semibold serif">Add New Reel</h3>
                <button onClick={() => setIsAddingReel(false)} className="p-2 hover:bg-zinc-100 rounded-full">
                  <X size={20} className="text-zinc-400" />
                </button>
              </div>
              <form onSubmit={handleAddReel} className="p-8 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Reel Title</label>
                  <input 
                    required
                    type="text"
                    value={newReel.title}
                    onChange={(e) => setNewReel({...newReel, title: e.target.value})}
                    className="w-full px-4 py-2 bg-zinc-50 border border-zinc-100 rounded-lg text-sm focus:outline-none focus:border-[#5A5A40]"
                    placeholder="e.g. Modern Living Room Reel"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Instagram Reel URL / Video File URL</label>
                  <div className="flex gap-2">
                    <input 
                      required
                      type="text"
                      value={newReel.videoUrl}
                      onChange={(e) => setNewReel({...newReel, videoUrl: e.target.value})}
                      className="flex-1 px-4 py-2.5 bg-zinc-50 border border-zinc-100 rounded-none text-sm focus:outline-none focus:border-[#5A5A40]"
                      placeholder="https://www.instagram.com/reel/... or direct video file URL"
                    />
                    <ImageUploadButton label="Upload Video" accept="video/*" onUploaded={(url) => setNewReel({...newReel, videoUrl: url})} />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <input 
                    type="checkbox"
                    id="pinned"
                    checked={newReel.pinned}
                    onChange={(e) => setNewReel({...newReel, pinned: e.target.checked})}
                    className="w-4 h-4 text-[#5A5A40] border-zinc-300 rounded focus:ring-[#5A5A40]"
                  />
                  <label htmlFor="pinned" className="text-xs text-zinc-600 font-medium">Pin to top</label>
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 bg-zinc-900 text-white rounded-xl font-bold uppercase tracking-widest text-[11px] hover:bg-[#5A5A40] transition-all shadow-lg mt-4"
                >
                  Add Reel
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isAddingProject && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingProject(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
                <h3 className="text-xl font-semibold serif underline decoration-[#5A5A40]">Add Portfolio Project</h3>
                <button onClick={() => setIsAddingProject(false)} className="p-2 hover:bg-zinc-200 rounded-full transition-colors">
                  <X size={20} className="text-zinc-500" />
                </button>
              </div>
              <form onSubmit={handleAddProject} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Project Title</label>
                    <input 
                      required
                      type="text"
                      value={newProject.title}
                      onChange={(e) => setNewProject({...newProject, title: e.target.value})}
                      className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:border-[#5A5A40] outline-none"
                      placeholder="Project Name"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Category</label>
                    <select 
                      value={newProject.category}
                      onChange={(e) => setNewProject({...newProject, category: e.target.value})}
                      className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:border-[#5A5A40] outline-none"
                    >
                      <option>Luxury Residential</option>
                      <option>Architectural Design</option>
                      <option>Luxury Interior</option>
                      <option>Corporate Workspace</option>
                      <option>Commercial Work</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Location</label>
                    <input 
                      required
                      type="text"
                      value={newProject.location}
                      onChange={(e) => setNewProject({...newProject, location: e.target.value})}
                      className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:border-[#5A5A40] outline-none"
                      placeholder="e.g. Gurgaon, Delhi"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Area</label>
                    <input 
                      required
                      type="text"
                      value={newProject.area}
                      onChange={(e) => setNewProject({...newProject, area: e.target.value})}
                      className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:border-[#5A5A40] outline-none"
                      placeholder="e.g. 5000 sq.ft"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Main Image URL</label>
                  <div className="flex gap-2">
                    <input 
                      required
                      type="text"
                      value={newProject.image}
                      onChange={(e) => setNewProject({...newProject, image: e.target.value})}
                      className="flex-1 px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-none text-sm focus:border-[#5A5A40] outline-none"
                      placeholder="https://... or upload image"
                    />
                    <ImageUploadButton label="Upload Cover" onUploaded={(url) => setNewProject({...newProject, image: url})} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Description</label>
                  <textarea 
                    required
                    rows={3}
                    value={newProject.description}
                    onChange={(e) => setNewProject({...newProject, description: e.target.value})}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-none text-sm focus:border-[#5A5A40] outline-none resize-none"
                    placeholder="Brief project mission/details..."
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center bg-zinc-50 p-2 border border-zinc-200">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">Gallery Items ({newProject.gallery.length})</span>
                    <ImageUploadButton label="Upload Image to Gallery" onUploaded={(url) => {
                      setNewProject({...newProject, gallery: [...newProject.gallery, url]});
                    }} />
                  </div>
                  <textarea 
                    rows={4}
                    value={newProject.gallery.join('\n')}
                    onChange={(e) => setNewProject({...newProject, gallery: e.target.value.split('\n').filter(Boolean)})}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-none text-sm focus:border-[#5A5A40] outline-none resize-none font-mono text-[10px]"
                    placeholder="Each uploaded or pasted image URL on its own line..."
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 bg-zinc-900 text-white text-[11px] uppercase tracking-[0.2em] font-bold rounded-lg hover:bg-[#5A5A40] transition-all shadow-xl"
                >
                  Add Project to Portfolio
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isEditingProject && editingProject && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditingProject(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
                <h3 className="text-xl font-semibold serif underline decoration-[#5A5A40]">Edit portfolio project</h3>
                <button onClick={() => setIsEditingProject(false)} className="p-2 hover:bg-zinc-200 rounded-full transition-colors">
                  <X size={20} className="text-zinc-500" />
                </button>
              </div>
              <form onSubmit={handleEditProject} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Project Title</label>
                    <input 
                      required
                      type="text"
                      value={editingProject.title || ''}
                      onChange={(e) => setEditingProject({...editingProject, title: e.target.value})}
                      className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:border-[#5A5A40] outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Category</label>
                    <select 
                      value={editingProject.category || 'Luxury Residential'}
                      onChange={(e) => setEditingProject({...editingProject, category: e.target.value})}
                      className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:border-[#5A5A40] outline-none"
                    >
                      <option>Luxury Residential</option>
                      <option>Architectural Design</option>
                      <option>Luxury Interior</option>
                      <option>Corporate Workspace</option>
                      <option>Commercial Work</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Location</label>
                    <input 
                      required
                      type="text"
                      value={editingProject.location || ''}
                      onChange={(e) => setEditingProject({...editingProject, location: e.target.value})}
                      className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:border-[#5A5A40] outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Area</label>
                    <input 
                      required
                      type="text"
                      value={editingProject.area || ''}
                      onChange={(e) => setEditingProject({...editingProject, area: e.target.value})}
                      className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:border-[#5A5A40] outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Main Image URL</label>
                  <div className="flex gap-2">
                    <input 
                      required
                      type="text"
                      value={editingProject.image || ''}
                      onChange={(e) => setEditingProject({...editingProject, image: e.target.value})}
                      className="flex-1 px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-none text-sm focus:border-[#5A5A40] outline-none"
                    />
                    <ImageUploadButton label="Upload Cover" onUploaded={(url) => setEditingProject({...editingProject, image: url})} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Description</label>
                  <textarea 
                    required
                    rows={3}
                    value={editingProject.description || ''}
                    onChange={(e) => setEditingProject({...editingProject, description: e.target.value})}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-none text-sm focus:border-[#5A5A40] outline-none resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center bg-zinc-50 p-2 border border-zinc-200">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">Gallery Items ({(editingProject.gallery || []).length})</span>
                    <ImageUploadButton label="Upload Image" onUploaded={(url) => {
                      setEditingProject({...editingProject, gallery: [...(editingProject.gallery || []), url]});
                    }} />
                  </div>
                  <textarea 
                    rows={4}
                    value={(editingProject.gallery || []).join('\n')}
                    onChange={(e) => setEditingProject({...editingProject, gallery: e.target.value.split('\n').filter(Boolean)})}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-none text-sm focus:border-[#5A5A40] outline-none resize-none font-mono text-[10px]"
                    placeholder="Each image URL on its own line..."
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 bg-zinc-900 text-white text-[11px] uppercase tracking-[0.2em] font-bold rounded-lg hover:bg-[#5A5A40] transition-all shadow-xl"
                >
                  Save Project Changes
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isAddingTestimonial && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingTestimonial(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-zinc-100 flex justify-between items-center">
                <h3 className="text-xl font-semibold serif">Add New Testimonial</h3>
                <button onClick={() => setIsAddingTestimonial(false)} className="p-2 hover:bg-zinc-100 rounded-full">
                  <X size={20} className="text-zinc-400" />
                </button>
              </div>
              <form onSubmit={handleAddTestimonial} className="p-8 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Client Name</label>
                    <input 
                      required
                      type="text"
                      value={newTestimonial.name}
                      onChange={(e) => setNewTestimonial({...newTestimonial, name: e.target.value})}
                      className="w-full px-4 py-2 bg-zinc-50 border border-zinc-100 rounded-lg text-sm focus:outline-none focus:border-[#5A5A40]"
                      placeholder="e.g. Rajesh Kumar"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Location</label>
                    <select 
                      value={newTestimonial.location}
                      onChange={(e) => setNewTestimonial({...newTestimonial, location: e.target.value})}
                      className="w-full px-4 py-2 bg-zinc-50 border border-zinc-100 rounded-lg text-sm focus:outline-none focus:border-[#5A5A40]"
                    >
                      <option value="Gurgaon">Gurgaon</option>
                      <option value="Delhi NCR">Delhi NCR</option>
                      <option value="Noida">Noida</option>
                      <option value="South Delhi">South Delhi</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Role / Title</label>
                  <input 
                    required
                    type="text"
                    value={newTestimonial.role}
                    onChange={(e) => setNewTestimonial({...newTestimonial, role: e.target.value})}
                    className="w-full px-4 py-2 bg-zinc-50 border border-zinc-100 rounded-lg text-sm focus:outline-none focus:border-[#5A5A40]"
                    placeholder="e.g. Homeowner in DLF Phase 5"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Quote</label>
                  <textarea 
                    required
                    rows={3}
                    value={newTestimonial.text}
                    onChange={(e) => setNewTestimonial({...newTestimonial, text: e.target.value})}
                    className="w-full px-4 py-2 bg-zinc-50 border border-zinc-100 rounded-lg text-sm focus:outline-none focus:border-[#5A5A40] resize-none"
                    placeholder="What did the client say?"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Image URL</label>
                  <div className="flex gap-2">
                    <input 
                      required
                      type="url"
                      value={newTestimonial.image}
                      onChange={(e) => setNewTestimonial({...newTestimonial, image: e.target.value})}
                      className="flex-1 px-4 py-2 bg-zinc-50 border border-zinc-100 rounded-lg text-sm focus:outline-none focus:border-[#5A5A40]"
                      placeholder="https://images.unsplash.com/..."
                    />
                    <ImageUploadButton label="Upload Photo" onUploaded={(url) => setNewTestimonial({...newTestimonial, image: url})} />
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full py-3 bg-[#5A5A40] text-white text-[11px] uppercase tracking-widest font-bold rounded-lg hover:bg-zinc-900 transition-all shadow-lg"
                >
                  Publish Testimonial
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {deleteDialog.isOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteDialog(prev => ({ ...prev, isOpen: false }))}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden z-10 p-6 border border-zinc-100"
            >
              <h3 className="text-lg font-semibold serif text-zinc-900 mb-2">{deleteDialog.title}</h3>
              <p className="text-xs text-zinc-500 mb-6 font-light">{deleteDialog.message}</p>
              
              <div className="flex gap-3 justify-end leading-none">
                <button
                  type="button"
                  onClick={() => setDeleteDialog(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 bg-zinc-100 text-zinc-700 text-[10px] font-bold uppercase tracking-wider rounded transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={deleteDialog.onConfirm}
                  className="px-4 py-2 bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider rounded transition-all shadow hover:shadow-md hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

function MainApp() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ text: string; sources: any[] } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReferralOpen, setIsReferralOpen] = useState(false);
  const [isVendorOpen, setIsVendorOpen] = useState(false);
  const [isCareersOpen, setIsCareersOpen] = useState(false);
  const [isDesignFormOpen, setIsDesignFormOpen] = useState(false);
  const [isVisualizerOpen, setIsVisualizerOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const { scrollYProgress } = useScroll();
  const scale = useTransform(scrollYProgress, [0, 0.2], [1, 1.05]);

  const [config, setConfig] = useState<LandingPageConfig>({
    hero_bg: "https://images.unsplash.com/photo-1620626011761-9963d7b69763?auto=format&fit=crop&q=80&w=2000",
    philosophy_img: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&q=80&w=1200",
    service1_img: "https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?auto=format&fit=crop&q=80&w=1200",
    service2_img: "https://images.unsplash.com/photo-1600607687940-c52af096999c?auto=format&fit=crop&q=80&w=1200",
    service3_img: "https://images.unsplash.com/photo-1600607687644-c7171bb3e299?auto=format&fit=crop&q=80&w=1200",
    portfolio_video: "https://assets.mixkit.co/videos/preview/mixkit-luxury-interior-design-of-a-living-room-34502-large.mp4"
  });

  const [projects, setProjects] = useState<PortfolioProject[]>([
    { 
      image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=1200", 
      title: "The DLF Kings Court Villa", 
      category: "Luxury Residential",
      location: "DLF Phase 1, Gurgaon",
      area: "9,500 sq.ft",
      description: "A majestic modern villa featuring bespoke hand-carved stone claddings, triple-height ceilings, a private glass elevator, and custom Italian marble flooring. Each bedroom is curated with a personalized lighting layout and custom veneer wood paneling, reflecting Indian warmth with European minimal elegance.",
      gallery: [
        "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&q=80&w=1200",
        "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&q=80&w=1200",
        "https://images.unsplash.com/photo-1617806118233-18e1db208586?auto=format&fit=crop&q=80&w=1200"
      ]
    },
    { 
      image: "https://images.unsplash.com/photo-1600607687940-c52af096999c?auto=format&fit=crop&q=80&w=1200", 
      title: "The Camellias Sky Penthouse", 
      category: "Luxury Interior",
      location: "Golf Course Road, Gurgaon",
      area: "6,800 sq.ft",
      description: "A premium high-floor sanctuary overlooking the Aravallis. This ultra-luxury apartment was designed with curated metal accents, custom acoustical plaster, hidden motorized bar consoles, and a bespoke art vestibule. Floor-to-ceiling glass paneling integrates the interior with a panoramic reflexology terrace.",
      gallery: [
        "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&q=80&w=1200",
        "https://images.unsplash.com/photo-1616486029423-aaa4789e8c9a?auto=format&fit=crop&q=80&w=1200",
        "https://images.unsplash.com/photo-1618219908412-a29a1bb7b86e?auto=format&fit=crop&q=80&w=1200"
      ]
    },
    { 
      image: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1200", 
      title: "Cyber Hub Innovation Chambers", 
      category: "Corporate Workspace",
      location: "DLF CyberCity, Gurgaon",
      area: "24,000 sq.ft",
      description: "An avant-garde corporate headquarter combining smart automation, biophilic green zones, and double-glazed acoustics. Crafted for a high-performing global team, it features soundproof collaboration pods, a dedicated gourmet espresso bar, customized ergonomic work bays, and ambient architectural lighting.",
      gallery: [
        "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&q=80&w=1200",
        "https://images.unsplash.com/photo-1531834215091-62544e4569ce?auto=format&fit=crop&q=80&w=1200",
        "https://images.unsplash.com/photo-1556761175-4b46a572b186?auto=format&fit=crop&q=80&w=1200"
      ]
    },
    { 
      image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=1200", 
      title: "The Grand Aravalli Resort", 
      category: "Commercial Work",
      location: "Sohna Road, Gurgaon",
      area: "45,000 sq.ft",
      description: "A luxury lifestyle boutique hotel featuring majestic arches, custom terrazzo paving, and premium indoor wellness pavilions. Incorporating hand-loomed Indian silk fabrics and local stone carvings with a clean contemporary canvas, this space defines elite business and hospitality in Gurgaon.",
      gallery: [
        "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&q=80&w=1200",
        "https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&q=80&w=1200",
        "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&q=80&w=1200"
      ]
    }
  ]);

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, 'configs', 'landing_page'), (snapshot) => {
      if (snapshot.exists()) {
        setConfig(prev => ({ ...prev, ...snapshot.data() }));
      }
    }, (error) => {
      console.error("Config fetch error:", error);
    });

    const unsubProjects = onSnapshot(query(collection(db, 'portfolio_projects'), orderBy('createdAt', 'desc')), (snapshot) => {
      if (!snapshot.empty) {
        setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as PortfolioProject));
      }
    }, (error) => {
      console.error("Projects fetch error:", error);
    });

    return () => {
      unsubConfig();
      unsubProjects();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    (window as any).scrollToEnquiry = () => {
      document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
    };
    getCompanyDetails("RR Inside Out Creation Private Limited").then(res => {
      setData(res);
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-white selection:bg-[#5A5A40] selection:text-[#FAF8F3]">
      <MagicCursor />
      <Navbar 
        onEnquire={() => setIsModalOpen(true)} 
        onStartDesign={() => setIsDesignFormOpen(true)}
        onStartVisualizer={() => setIsVisualizerOpen(true)}
        user={user}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenReferral={() => setIsReferralOpen(true)}
        onOpenVendor={() => setIsVendorOpen(true)}
        onOpenCareers={() => setIsCareersOpen(true)}
      />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <EnquiryModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <ReferralModal isOpen={isReferralOpen} onClose={() => setIsReferralOpen(false)} />
      <VendorModal isOpen={isVendorOpen} onClose={() => setIsVendorOpen(false)} />
      <CareersModal isOpen={isCareersOpen} onClose={() => setIsCareersOpen(false)} />
      <StartWithDesign 
        isOpen={isDesignFormOpen} 
        onClose={() => setIsDesignFormOpen(false)} 
        user={user} 
        onBookConsultation={() => setIsModalOpen(true)} 
        onOpenAuth={() => setIsAuthOpen(true)}
      />
      <AI3DVisualizer
        isOpen={isVisualizerOpen}
        onClose={() => setIsVisualizerOpen(false)}
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
      />
      <AIChatbot user={user} />
      {isAdminOpen && <AdminDashboard onClose={() => setIsAdminOpen(false)} user={user} />}
      <ProjectDetailsModal 
        isOpen={isProjectModalOpen} 
        onClose={() => setIsProjectModalOpen(false)} 
        project={selectedProject} 
      />

      {/* Hero Section */}
      <section className="relative h-screen flex items-center overflow-hidden pt-24 bg-zinc-950">
        <motion.div 
          initial={{ scale: 1.15, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 2.2, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 z-0"
        >
          <img 
            src={config.hero_bg} 
            alt="Luxury Interior" 
            className="w-full h-full object-cover select-none"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-black/45" />
          <div className="absolute inset-0 cinematic-scrim opacity-75" />
        </motion.div>

        {/* Elegant top & bottom fine borders bounding the frame */}
        <div className="absolute top-24 left-10 right-10 h-[100px] border-l border-t border-white/5 pointer-events-none z-10" />
        <div className="absolute bottom-10 left-10 right-10 h-[100px] border-l border-b border-white/5 pointer-events-none z-10" />

        <div className="container mx-auto px-6 md:px-16 lg:px-24 relative z-10">
          <div className="max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-5 mb-8"
            >
              <div className="w-16 h-[1px] bg-[#5A5A40]" />
              <p className="text-[10px] uppercase tracking-[0.5em] text-[#8e8d78] font-bold">
                Bespoke Minimal Modern Architecture & Interiors
              </p>
            </motion.div>
            
            <h1 className="serif text-5xl md:text-8xl text-white font-light leading-[1.05] tracking-tight mb-8">
              <motion.span
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="block"
              >
                Design Your
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.4, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="block font-light italic gold-gradient-text"
              >
                Dream Space
              </motion.span>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.4, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="text-zinc-300 text-base md:text-xl font-light leading-relaxed mb-12 max-w-2xl text-balance"
            >
              We compile your unique expressions into elegant architectural masterpieces. Crafting bespoke private residences and contemporary creative spaces across India.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.4, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-wrap items-center gap-8"
            >
              <motion.button 
                onClick={() => setIsModalOpen(true)}
                className="relative px-12 py-5 overflow-hidden bg-[#5A5A40] text-white text-[10px] uppercase tracking-[0.25em] font-bold shadow-2xl active:translate-y-[1px] transition-transform duration-300 group border border-[#5A5A40]"
                whileHover="hover"
                initial="initial"
                animate="animate"
                whileTap={{ scale: 0.98 }}
              >
                {/* Sliding modern gold/white full background fill on hover */}
                <motion.div 
                  className="absolute inset-0 bg-white"
                  variants={{
                    initial: { y: "100%" },
                    hover: { y: 0 }
                  }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                />
                
                {/* Text container with relative z-index for correct stacking */}
                <span className="relative z-10 flex items-center justify-center gap-2.5 transition-colors duration-450 group-hover:text-zinc-950">
                  <span>Let's Talk</span>
                  <motion.span
                    variants={{
                      initial: { x: -6, opacity: 0, width: 0 },
                      hover: { x: 0, opacity: 1, width: "auto" }
                    }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <ArrowRight size={13} className="text-zinc-950" />
                  </motion.span>
                </span>
              </motion.button>
              <a 
                href="#projects" 
                className="group flex items-center gap-3 text-[10px] uppercase tracking-[0.25em] font-bold text-white hover:text-[#bfa15c] transition-colors"
              >
                View Works 
                <ArrowRight size={12} className="group-hover:translate-x-1.5 transition-transform" />
              </a>
            </motion.div>
          </div>
        </div>

        {/* Dynamic down-arrow indicator */}
        <div className="absolute bottom-12 right-12 z-10 hidden md:flex flex-col items-center gap-4">
          <span className="text-[8px] uppercase tracking-[0.4em] text-white/30 font-bold rotate-90 origin-bottom-right translate-x-[9px] -translate-y-5">Scroll</span>
          <div className="w-[1px] h-12 bg-white/10 relative overflow-hidden">
            <motion.div 
              animate={{ y: ["0%", "100%"] }} 
              transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }} 
              className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-[#5A5A40] to-transparent" 
            />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 bg-[#FAF8F3] border-b border-zinc-200/40 relative">
        <div className="container mx-auto px-6 md:px-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-16 gap-x-12 relative">
            {[
              { icon: Award, label: "Awards Curation", value: "25+" },
              { icon: Users, label: "Elite Clientele", value: "500+" },
              { icon: Building2, label: "Estates Crafted", value: "1200+" },
              { icon: Clock, label: "Years Curation", value: "15+" }
            ].map((stat, i) => (
              <div key={i} className="space-y-4 relative group flex flex-col items-center">
                {/* Vertical Divider line between stats for desktop */}
                {i > 0 && (
                  <div className="absolute left-[-24px] top-4 bottom-4 w-[1px] bg-zinc-200/50 hidden md:block" />
                )}
                <div className="text-[#5A5A40] transition-transform duration-500 group-hover:scale-110">
                  <stat.icon size={20} strokeWidth={1.5} />
                </div>
                <p className="serif text-4xl md:text-5xl font-light text-zinc-950 tracking-tight">{stat.value}</p>
                <p className="text-[8px] uppercase tracking-[0.3em] text-[#8e8d78] font-bold text-center leading-relaxed">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <InfiniteDesignTicker />

      {/* Philosophy Section */}
      <section id="about" className="py-40 px-6 md:px-16 lg:px-24 bg-[#FAF8F3] relative overflow-hidden">
        {/* Subtle background canvas texture lines */}
        <div className="absolute inset-0 bg-[radial-gradient(#e5e1d8_1px,transparent_1px)] [background-size:32px_32px] opacity-40 pointer-events-none" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-12 gap-16 lg:gap-24 items-center">
            <div className="space-y-12 lg:col-span-7">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-[1px] bg-[#5A5A40]" />
                  <p className="text-[9px] uppercase tracking-[0.4em] text-[#5A5A40] font-bold">Our Philosophy</p>
                </div>
                <h2 className="serif text-4xl md:text-6xl text-zinc-950 font-light leading-tight">
                  The <span className="italic font-normal text-[#5A5A40]">Inside Out</span> Approach
                </h2>
              </div>
              
              <div className="space-y-8 text-zinc-700 leading-relaxed font-light">
                <p className="text-lg md:text-xl text-zinc-800 leading-relaxed italic">
                  "Every structural decision should be informed by the human experience within, and every interior detail should resonate with the architectural soul of the building."
                </p>
                <p className="text-sm md:text-base text-zinc-650">
                  With over a decade of dedication to design excellence, RR Inside Out Creation Private Limited has been redefining the traditional relationship between architecture and interior spaces. We transcend typical decor lists to curate holistic living envelopes where outside structures and bespoke insides play in absolute harmony.
                </p>
                
                <div className="grid sm:grid-cols-2 gap-10 pt-8 border-t border-zinc-200/60">
                  <div className="space-y-4">
                    <div className="w-10 h-10 bg-zinc-900 text-white rounded-none flex items-center justify-center">
                      <Building2 size={16} />
                    </div>
                    <h4 className="font-bold text-xs uppercase tracking-[0.2em] text-zinc-900">Service Integration</h4>
                    <p className="text-xs text-zinc-500 leading-relaxed font-light">
                      Seamlessly blending minimal modern and premium residential design, contemporary corporate spaces, and customized bespoke furniture into a unified, signature model.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <div className="w-10 h-10 bg-[#5A5A40] text-white rounded-none flex items-center justify-center">
                      <Users size={16} />
                    </div>
                    <h4 className="font-bold text-xs uppercase tracking-[0.2em] text-zinc-900">Expert Leadership</h4>
                    <p className="text-xs text-zinc-500 leading-relaxed font-light">
                      Led by visionaries Mohit Kumawat, Ashish Shukla, and Lalit Kumar, combining decades of master curation to deliver unrivaled design projects.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="relative lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-md aspect-[4/5] overflow-hidden border border-zinc-200/50 p-3 bg-white/40 shadow-sm">
                <div className="w-full h-full overflow-hidden relative">
                  <img 
                    src={config.philosophy_img} 
                    alt="Architecture and Design Process" 
                    className="w-full h-full object-cover transition-transform duration-1000 hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
              
              {/* Gallery-style Placard */}
              <div className="absolute -bottom-8 -left-8 bg-white border border-zinc-200/50 p-8 shadow-2xl hidden md:block max-w-[240px]">
                <p className="serif text-5xl font-light text-zinc-950 mb-1 tracking-tight">10+</p>
                <div className="w-8 h-[2px] bg-[#5A5A40] my-3" />
                <p className="text-[8px] uppercase tracking-[0.25em] text-zinc-400 font-bold leading-relaxed">
                  YEARS OF EXCELLENCE IN BESPOKE SPACES
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-32 px-6 md:px-12 bg-zinc-50">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-24 gap-8">
            <div className="max-w-2xl">
              <p className="text-[11px] uppercase tracking-[0.3em] text-[#5A5A40] font-bold mb-6">Our Expertise</p>
              <h2 className="serif text-5xl md:text-6xl text-zinc-900">Bespoke <span className="italic">Services</span></h2>
            </div>
            <p className="text-zinc-400 max-w-xs text-sm font-light">
              Tailoring custom-crafted furniture, ambient layouts, and high-contrast styling specifications for discerning architectural environments.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            <TiltCard>
              <ServiceCard 
                image={config.service1_img}
                title="Bespoke Modern Interiors"
                description="Complete customized interior architectural environments for discerning modern residential and creative spaces."
                onClick={() => setIsModalOpen(true)}
              />
            </TiltCard>
            <TiltCard>
              <ServiceCard 
                image={config.service2_img}
                title="Architectural Curation"
                description="Innovative sustainable structural plans and blueprints that seamlessly harmonize outside shell and indoor volume."
                onClick={() => setIsModalOpen(true)}
              />
            </TiltCard>
            <TiltCard>
              <ServiceCard 
                image={config.service3_img}
                title="Urban Creative Loft"
                description="Modern space-efficient premium layouts for contemporary city living with clean high-contrast elements."
                onClick={() => setIsModalOpen(true)}
              />
            </TiltCard>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section id="process" className="py-32 px-6 md:px-12">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-24 gap-8">
            <div className="max-w-2xl">
              <p className="text-[11px] uppercase tracking-[0.3em] text-[#5A5A40] font-bold mb-6">How We Work</p>
              <h2 className="serif text-5xl md:text-6xl text-zinc-900">Our Seamless <span className="italic">Process</span></h2>
            </div>
            <p className="text-zinc-400 max-w-xs text-sm font-light">
              From the first sketch to the final reveal, we handle every detail with meticulous care.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
            {[
              { step: "01", title: "Consultation", desc: "We begin by understanding your lifestyle, preferences, and the unique potential of your space." },
              { step: "02", title: "Design & Curation", desc: "Our designers create a bespoke concept, selecting materials and pieces that define your vision." },
              { step: "03", title: "Execution", desc: "Our master craftsmen bring the design to life, ensuring every detail meets our high standards of precision." }
            ].map((item, i) => (
              <div key={i} className="relative group">
                <div className="serif text-9xl text-zinc-50 absolute -top-16 -left-4 z-0 select-none">
                  {item.step}
                </div>
                <div className="relative z-10">
                  <div className="w-12 h-[2px] bg-[#5A5A40] mb-8" />
                  <h4 className="serif text-3xl mb-6 text-zinc-900">{item.title}</h4>
                  <p className="text-zinc-500 text-sm leading-relaxed font-light">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Portfolio Section */}
      <section id="projects" className="py-32 px-6 md:px-12 bg-zinc-900 text-white">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-[#5A5A40] font-bold mb-6">Our Portfolio</p>
              <h2 className="serif text-5xl md:text-6xl">Selected <span className="italic">Works</span></h2>
            </div>
            <div className="flex gap-4">
              <button className="px-8 py-4 border border-white/20 rounded-md text-[11px] uppercase tracking-widest font-bold hover:bg-white hover:text-zinc-900 transition-all">
                View All Projects
              </button>
            </div>
          </div>

          {/* Reel Section */}
          <div className="mb-24 rounded-3xl overflow-hidden aspect-video md:aspect-[21/9] relative group">
            <SafeVideoPlayer 
              src={config.portfolio_video}
              autoPlay 
              muted 
              loop 
              playsInline
              key={config.portfolio_video}
              className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-700"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-black/20">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <p className="text-[10px] uppercase tracking-[0.5em] text-[#5A5A40] font-bold">Featured Reel</p>
                <h3 className="serif text-4xl md:text-6xl">Our Work in <span className="italic text-[#5A5A40]">Motion</span></h3>
                <a 
                  href="https://www.instagram.com/inout.creation/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-zinc-900 rounded-full text-[10px] uppercase tracking-widest font-bold hover:bg-[#5A5A40] hover:text-white transition-all"
                >
                  <Instagram size={14} /> Follow on Instagram
                </a>
              </motion.div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {projects.map((project, i) => (
              <TiltCard key={project.id || i}>
                <motion.div 
                  whileHover={{ y: -6 }} 
                  className="group cursor-pointer"
                  onClick={() => {
                    setSelectedProject(project);
                    setIsProjectModalOpen(true);
                  }}
                >
                  <div className="aspect-video rounded-2xl overflow-hidden mb-8 relative">
                    <img 
                      src={project.image} 
                      alt={project.title} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/50 transition-all duration-500" />
                    
                    {/* Hover Content */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                      <div className="flex flex-col items-center gap-4 translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                        <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
                          <Eye size={24} />
                        </div>
                        <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-white">Discover Detail</span>
                      </div>
                    </div>

                    <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity translate-y-4 group-hover:translate-y-0 transition-transform delay-75">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-white/70">
                        <MapPin size={12} className="text-[#5A5A40]" />
                        {project.location}
                      </div>
                      <div className="px-3 py-1 bg-white/10 backdrop-blur-md rounded text-[9px] uppercase font-bold text-white/70 border border-white/10">
                        {project.area}
                      </div>
                    </div>
                  </div>
                  <h4 className="serif text-2xl mb-2">{project.title}</h4>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[#5A5A40] font-bold">{project.category}</p>
                </motion.div>
              </TiltCard>
            ))}
          </div>
        </div>
      </section>

      <InstagramReels onOpenAdmin={() => setIsAdminOpen(true)} />
      <Testimonials />

      {/* CTA Section */}
      <section id="contact" className="py-32 px-6 md:px-12 bg-[#fdfdfb]">
        <div className="container mx-auto">
          <div className="max-w-5xl mx-auto bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-zinc-100">
            <div className="flex flex-col md:flex-row">
              <div className="md:w-1/2 p-12 md:p-20 space-y-10">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-[#5A5A40] font-bold mb-6">Contact Us</p>
                  <h2 className="serif text-5xl md:text-6xl text-zinc-900 leading-tight flex items-center flex-wrap gap-x-3">
                    <span>Ready to</span>
                    <span className="italic text-zinc-400">Collaborate?</span>
                  </h2>
                </div>
                <p className="text-zinc-500 font-light leading-relaxed">
                  Whether you have a specific project in mind or just want to explore possibilities, we're here to help you create something extraordinary.
                </p>
                <div className="space-y-6">
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-12 rounded-full bg-zinc-50 flex items-center justify-center text-[#5A5A40] shrink-0">
                      <Phone size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Call Us</p>
                      <p className="font-bold text-sm">+91 80059 87790</p>
                      <p className="font-bold text-sm">+91 86192 22683</p>
                      <p className="font-bold text-sm">+91 77019 96418</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-12 rounded-full bg-zinc-50 flex items-center justify-center text-[#5A5A40] shrink-0">
                      <Mail size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Email Us</p>
                      <p className="font-bold text-sm break-all">rrinsideoutcreation@gmail.com</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="md:w-1/2 bg-zinc-900 p-12 md:p-20 flex flex-col justify-center">
                <h3 className="serif text-4xl text-white mb-8">Get a Free <span className="italic text-[#5A5A40]">Bespoke Consultation</span></h3>
                <p className="text-white/60 mb-12 font-light">
                  Join our elite clientele. Share your project details and our team of senior designers will get back to you with a personalized strategy.
                </p>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="w-full py-6 bg-[#5A5A40] text-white rounded-md font-bold uppercase tracking-widest text-xs hover:bg-white hover:text-zinc-900 transition-all shadow-xl group flex items-center justify-center gap-4"
                >
                  Start Your Consultation
                  <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Referral Program Section */}
      <section className="py-28 px-6 md:px-12 bg-zinc-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,#5a5a40/15,transparent_50%)]" />
        <div className="container mx-auto relative z-10">
          <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-16 items-center">
            
            {/* Left Info Column */}
            <div className="w-full lg:w-1/2 space-y-8">
              <div className="space-y-4">
                <div className="w-12 h-[1px] bg-[#5A5A40]" />
                <p className="text-[10px] uppercase tracking-[0.4em] text-[#5A5A40] font-bold">The Elite Partner Circle</p>
                <h2 className="serif text-5xl md:text-6xl text-white leading-tight">
                  Earn Up To <br />
                  <span className="italic text-[#5A5A40]">₹1,00,000 INR</span>
                </h2>
              </div>
              <p className="text-zinc-400 font-light text-base leading-relaxed">
                Do you know someone searching for India's leading bespoke architecture and luxury interior design firm? Refer friends, family, or professional associates to RR Inside Out. Upon contract finalization, receive an elite reward transfer of up to ₹1,00,000 INR as our partner.
              </p>

              {/* Three Steps Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-zinc-800">
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-full border border-zinc-800 flex items-center justify-center text-xs font-bold text-[#5A5A40]">01</div>
                  <h5 className="text-[11px] uppercase tracking-wider font-bold text-white">Share Details</h5>
                  <p className="text-xs text-zinc-500 font-light leading-snug">Submit both your details and the prospect's project scope.</p>
                </div>
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-full border border-zinc-800 flex items-center justify-center text-xs font-bold text-[#5A5A40]">02</div>
                  <h5 className="text-[11px] uppercase tracking-wider font-bold text-white">Bespoke Pitch</h5>
                  <p className="text-xs text-zinc-500 font-light leading-snug">Our design studio handles contact with absolute decorum & privacy.</p>
                </div>
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-full border border-zinc-800 flex items-center justify-center text-xs font-bold text-[#5A5A40]">03</div>
                  <h5 className="text-[11px] uppercase tracking-wider font-bold text-white">Collect Commission</h5>
                  <p className="text-xs text-zinc-500 font-light leading-snug">Transfer rewards directly via UPI or Bank upon client retention.</p>
                </div>
              </div>
            </div>

            {/* Right Card Column - Interactive Bento */}
            <div className="w-full lg:w-1/2">
              <TiltCard>
                <div className="bg-zinc-900 border border-zinc-800 p-8 md:p-12 rounded-[2.5rem] shadow-2xl relative space-y-8 overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#5A5A40]/10 rounded-full blur-2xl" />
                  
                  <div className="space-y-3">
                    <span className="inline-block px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] uppercase tracking-widest font-bold text-[#5a5a40]">
                      ★ No Referral Limit
                    </span>
                    <h3 className="serif text-3xl text-white">Ready to <span className="italic text-[#5A5A40]">Introduce?</span></h3>
                    <p className="text-zinc-400 font-light text-sm max-w-sm">
                      Become an esteemed affiliate of RR Inside Out Creation. We value our scouts & ambassadors with complete transparency.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-4 bg-zinc-950/40 p-4 rounded-xl border border-zinc-810/60">
                      <div className="w-10 h-10 rounded-full bg-[#5A5A40]/10 flex items-center justify-center text-[#5A5A40]">
                        <Users size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-[#5a5a40] font-bold">100% Privacy</p>
                        <p className="text-xs text-zinc-400 font-light">We never disclose the referrer's name without consent.</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 bg-zinc-950/40 p-4 rounded-xl border border-zinc-810/60">
                      <div className="w-10 h-10 rounded-full bg-[#5A5A40]/10 flex items-center justify-center text-[#5A5A40]">
                        <Award size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-[#5a5a40] font-bold">Earn ₹1,00,000</p>
                        <p className="text-xs text-zinc-400 font-light">Directly proportional to project volume and conversion.</p>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => setIsReferralOpen(true)}
                    className="w-full py-5 bg-[#5A5A40] text-white rounded-md font-bold uppercase tracking-[0.2em] text-xs hover:bg-white hover:text-zinc-900 transition-all shadow-xl flex items-center justify-center gap-4 group cursor-pointer"
                  >
                    Submit Prospect Details
                    <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform" />
                  </button>
                </div>
              </TiltCard>
            </div>

          </div>
        </div>
      </section>

      {/* Office Location Map Section */}
      <section className="py-24 px-6 md:px-12 bg-zinc-50 border-t border-zinc-100">
        <div className="container mx-auto">
          <div className="flex flex-col lg:flex-row gap-16 items-center">
            {/* Left Content Column */}
            <div className="w-full lg:w-2/5 space-y-8">
              <div className="space-y-4">
                <div className="w-12 h-[1px] bg-[#5A5A40]" />
                <p className="text-[10px] uppercase tracking-[0.4em] text-[#8e8d78] font-bold">Locate Us</p>
                <h2 className="serif text-4xl md:text-5xl text-zinc-900 leading-tight">
                  Our Design <span className="italic">Studio</span>
                </h2>
              </div>
              <p className="text-zinc-500 font-light text-sm leading-relaxed">
                Step inside our creative hub where visions take tactile shape. Meet our design architects, explore material boards, and witness bespoke craftsmanship first-hand.
              </p>
              
              <div className="space-y-6 pt-4 border-t border-zinc-200/60 font-sans">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-white border border-zinc-200/50 flex items-center justify-center text-[#5A5A40] shrink-0 shadow-sm">
                    <MapPin size={16} />
                  </div>
                  <div>
                    <h5 className="text-[10px] uppercase tracking-widest font-bold text-zinc-450">Coordinates</h5>
                    <p className="text-sm font-semibold text-zinc-900 mt-0.5">28°25'19.1"N 76°56'05.9"E</p>
                    <p className="text-xs text-zinc-400 font-light mt-1">Sohna Road, Gurugram, India</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-white border border-zinc-200/50 flex items-center justify-center text-[#5A5A40] shrink-0 shadow-sm">
                    <Clock size={16} />
                  </div>
                  <div>
                    <h5 className="text-[10px] uppercase tracking-widest font-bold text-zinc-450">Studio Hours</h5>
                    <p className="text-sm font-semibold text-zinc-900 mt-0.5">Mon - Sat: 09:30 AM - 06:30 PM</p>
                    <p className="text-xs text-zinc-400 font-light mt-1">Closed on Sundays & National Holidays</p>
                  </div>
                </div>
              </div>

              <a 
                href="https://www.google.com/maps/dir/?api=1&destination=28.421972,76.934972" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-6 py-3.5 bg-zinc-950 text-white rounded-md text-[10px] uppercase tracking-widest font-bold hover:bg-[#5A5A40] transition-all shadow-lg text-center"
              >
                <span>Get Driving Directions</span>
                <ArrowRight size={14} />
              </a>
            </div>

            {/* Right Map Column */}
            <div className="w-full lg:w-3/5">
              <TiltCard>
                <div className="w-full aspect-[4/3] sm:aspect-video lg:aspect-[1.4/1] rounded-3xl overflow-hidden border border-zinc-200/60 shadow-2xl relative bg-zinc-100">
                  <iframe 
                    title="RR Inside Out Location"
                    src="https://maps.google.com/maps?q=28.421972,76.934972&z=15&t=m&output=embed"
                    className="w-full h-full border-0 grayscale hover:grayscale-0 transition-all duration-1000"
                    allowFullScreen={true}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                  <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-md px-4 py-3 rounded-xl border border-white/50 shadow-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[9px] uppercase tracking-wider font-bold text-zinc-600">RR Inside Out Studio</span>
                    </div>
                    <span className="text-[9px] text-zinc-400 font-mono">28.4219° N, 76.9349° E</span>
                  </div>
                </div>
              </TiltCard>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-24 px-6 md:px-12 bg-white border-t border-zinc-100">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-20">
            <div className="space-y-8">
              <div className="flex items-center">
                <RRBrandLogo scrolled={true} className="h-10" />
              </div>
              <p className="text-zinc-500 text-sm leading-relaxed font-light">
                India's premier bespoke design firm. We create minimalist and modern spaces that blend functionality with artistic expression.
              </p>
              <div className="flex gap-6">
                <a href="https://www.instagram.com/inout.creation/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full border border-zinc-100 flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:border-zinc-900 transition-all">
                  <Instagram size={18} />
                </a>
                <a href="https://www.facebook.com/profile.php?id=61587007480832" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full border border-zinc-100 flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:border-zinc-900 transition-all">
                  <Facebook size={18} />
                </a>
                <a href="https://www.linkedin.com/company/111526305/admin/dashboard/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full border border-zinc-100 flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:border-zinc-900 transition-all">
                  <Linkedin size={18} />
                </a>
              </div>
            </div>
            
            <div>
              <h5 className="text-[11px] uppercase tracking-widest font-bold text-zinc-900 mb-10">Quick Links</h5>
              <ul className="space-y-4 text-sm text-zinc-500 font-light">
                <li><a href="#" className="hover:text-[#5A5A40] transition-colors">Home</a></li>
                <li><a href="#about" className="hover:text-[#5A5A40] transition-colors">About Us</a></li>
                <li><a href="#services" className="hover:text-[#5A5A40] transition-colors">Services</a></li>
                <li><a href="#projects" className="hover:text-[#5A5A40] transition-colors">Portfolio</a></li>
                <li><a href="#contact" className="hover:text-[#5A5A40] transition-colors">Contact</a></li>
              </ul>
            </div>

            <div>
              <h5 className="text-[11px] uppercase tracking-widest font-bold text-zinc-900 mb-10">Services</h5>
              <ul className="space-y-4 text-sm text-zinc-500 font-light">
                <li><a href="#" className="hover:text-[#5A5A40] transition-colors">Luxury Interiors</a></li>
                <li><a href="#" className="hover:text-[#5A5A40] transition-colors">Architectural Design</a></li>
                <li><a href="#" className="hover:text-[#5A5A40] transition-colors">Turnkey Solutions</a></li>
                <li><a href="#" className="hover:text-[#5A5A40] transition-colors">Bespoke Furniture</a></li>
                <li><a href="#" className="hover:text-[#5A5A40] transition-colors">Commercial Design</a></li>
              </ul>
            </div>

            <div>
              <h5 className="text-[11px] uppercase tracking-widest font-bold text-zinc-900 mb-10">Newsletter</h5>
              <p className="text-zinc-500 text-sm font-light mb-6">Subscribe to get the latest design trends and project updates.</p>
              <div className="flex gap-2">
                <input 
                  type="email" 
                  placeholder="Email Address" 
                  className="flex-1 bg-zinc-50 border border-zinc-200 px-4 py-3 rounded-md text-sm outline-none focus:border-[#5A5A40] transition-all"
                />
                <button className="p-3 bg-zinc-900 text-white rounded-md hover:bg-[#5A5A40] transition-all">
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </div>
          
          <div className="mt-24 pt-8 border-t border-zinc-100 flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] uppercase tracking-widest text-zinc-400 font-bold">
            <p>© 2026 RR Inside Out Creation Private Limited. All rights reserved.</p>
            <div className="flex gap-10">
              <a href="#" className="hover:text-zinc-900">Privacy Policy</a>
              <a href="#" className="hover:text-zinc-900">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
