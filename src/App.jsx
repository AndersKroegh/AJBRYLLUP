import React, { useState, useEffect, useRef } from 'react';
import { Heart, MapPin, Clock, Gift, Home, CheckCircle2, Lock, Users, Edit3, Plus, Trash2, ChevronDown } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, onSnapshot, updateDoc, query, orderBy } from 'firebase/firestore';

// --- FIREBASE SETUP ---
const firebaseConfig = {
  apiKey: "AIzaSyC-baRY8ADfQ_oS0U51D80Bql_GKw8b8OU",
  authDomain: "bryllups-website.firebaseapp.com",
  projectId: "bryllups-website",
  storageBucket: "bryllups-website.firebasestorage.app",
  messagingSenderId: "614384539759",
  appId: "1:614384539759:web:2160ecc6dfb1b0711e559a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'bryllups-website-app'; // Unikt ID til din database

// Default Data hvis databasen er tom
const DEFAULT_DATA = {
  names: "Anna & Christian",
  date: "15. August 2026",
  rsvpDate: "1. Maj 2026",
  heroImage: "https://images.unsplash.com/photo-1519741497674-611481863552?ixlib=rb-1.2.1&auto=format&fit=crop&w=2000&q=80",
  timeAndPlace: "Vielsen finder sted kl. 13:00 i Risskov Kirke. Herefter inviterer vi til en festlig reception og en uforglemmelig aften på Varna Palæet.",
  accommodation: "Vi har forhåndsreserveret en række værelser på Hotel Marselis til en særpris. Nævn venligst 'Anna & Christian Bryllup' ved booking.",
  program: [
    { id: 1, time: "13:00", event: "Vielse i Risskov Kirke" },
    { id: 2, time: "15:00", event: "Reception & Bryllupskage" },
    { id: 3, time: "18:00", event: "Middag & Fest" },
    { id: 4, time: "23:30", event: "Brudevals" }
  ],
  wishlist: [
    { id: 1, item: "Oplevelser & Rejsegavekort", link: "" },
    { id: 2, item: "Gavekort til Illums Bolighus", link: "https://illumsbolighus.dk" },
    { id: 3, item: "Royal Copenhagen Mega Mussel kopper", link: "" }
  ]
};

// --- HJÆLPE HOOK TIL SCROLL ANIMATION ---
const FadeInSection = ({ children, delay = 0 }) => {
  const [isVisible, setVisible] = useState(false);
  const domRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    
    if (domRef.current) observer.observe(domRef.current);
    return () => {
      if (domRef.current) observer.unobserve(domRef.current);
    };
  }, []);

  return (
    <div
      ref={domRef}
      className={`transition-all duration-1000 ease-out transform ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};


// --- MAIN APP COMPONENT ---
export default function App() {
  const [user, setUser] = useState(null);
  const [weddingData, setWeddingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('landing'); // 'landing' | 'admin'

  // Håndter rute via hash (simpel routing for single-file)
  useEffect(() => {
    const handleHashChange = () => {
      setCurrentView(window.location.hash === '#/admin' ? 'admin' : 'landing');
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Firebase Auth Init
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Hent bryllupsdata
  useEffect(() => {
    if (!user) return;

    const infoDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'wedding_info', 'main');

    const unsubscribe = onSnapshot(infoDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        setWeddingData(docSnap.data());
      } else {
        // Opret standard data hvis det ikke findes endnu
        await setDoc(infoDocRef, DEFAULT_DATA);
        setWeddingData(DEFAULT_DATA);
      }
      setLoading(false);
    }, (error) => {
      console.error("Fejl ved hentning af data:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (loading || !weddingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <div className="animate-pulse text-stone-400 font-serif text-xl tracking-widest">
          Indlæser...
        </div>
      </div>
    );
  }

  return (
    <div className="font-sans text-stone-800 bg-[#FAFAFA] min-h-screen overflow-x-hidden selection:bg-stone-200">
      {currentView === 'landing' ? (
        <LandingPage data={weddingData} user={user} />
      ) : (
        <AdminPage data={weddingData} user={user} />
      )}
    </div>
  );
}

// --- LANDING PAGE KOMPONENT ---
function LandingPage({ data, user }) {
  const [rsvpForm, setRsvpForm] = useState({ name: '', attending: 'yes', diet: '', message: '' });
  const [rsvpStatus, setRsvpStatus] = useState('idle'); // idle, submitting, success

  const handleRsvpSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setRsvpStatus('submitting');
    try {
      const rsvpsRef = collection(db, 'artifacts', appId, 'public', 'data', 'wedding_rsvps');
      await addDoc(rsvpsRef, {
        ...rsvpForm,
        timestamp: new Date().toISOString()
      });
      setRsvpStatus('success');
      setRsvpForm({ name: '', attending: 'yes', diet: '', message: '' });
    } catch (error) {
      console.error("Fejl ved afsendelse af S.U.:", error);
      setRsvpStatus('idle');
    }
  };

  return (
    <div>
      {/* Hero Section */}
      <div className="relative h-screen min-h-[600px] flex items-center justify-center">
        <div className="absolute inset-0 z-0">
          <img 
            src={data.heroImage} 
            alt="Wedding Cover" 
            className="w-full h-full object-cover opacity-90"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-stone-900/40 mix-blend-multiply"></div>
        </div>
        
        <div className="relative z-10 text-center text-white px-4">
          <FadeInSection>
            <p className="tracking-[0.3em] uppercase text-sm md:text-base mb-6 font-light">Vi skal giftes</p>
          </FadeInSection>
          <FadeInSection delay={200}>
            <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl mb-6 font-medium">
              {data.names}
            </h1>
          </FadeInSection>
          <FadeInSection delay={400}>
            <p className="text-xl md:text-2xl font-light tracking-wider">
              {data.date}
            </p>
          </FadeInSection>
        </div>

        <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 animate-bounce text-white/70">
          <ChevronDown size={32} strokeWidth={1} />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-20 md:py-32 space-y-32">
        
        {/* Tid & Sted */}
        <FadeInSection>
          <div className="text-center space-y-6">
            <MapPin className="mx-auto text-stone-400 mb-4" size={40} strokeWidth={1} />
            <h2 className="font-serif text-3xl md:text-4xl">Tid & Sted</h2>
            <div className="w-12 h-[1px] bg-stone-300 mx-auto"></div>
            <p className="text-stone-600 leading-relaxed max-w-2xl mx-auto text-lg font-light">
              {data.timeAndPlace}
            </p>
          </div>
        </FadeInSection>

        {/* Program */}
        <FadeInSection>
          <div className="bg-white p-8 md:p-12 shadow-sm border border-stone-100 rounded-lg">
            <div className="text-center space-y-6 mb-12">
              <Clock className="mx-auto text-stone-400 mb-4" size={40} strokeWidth={1} />
              <h2 className="font-serif text-3xl md:text-4xl">Program for Dagen</h2>
            </div>
            <div className="max-w-md mx-auto relative border-l border-stone-200 pl-6 md:pl-8 space-y-10">
              {data.program.map((item, index) => (
                <div key={item.id} className="relative">
                  <div className="absolute -left-[31px] md:-left-[39px] bg-[#FAFAFA] p-1">
                    <div className="w-3 h-3 rounded-full bg-stone-300"></div>
                  </div>
                  <h3 className="font-serif text-xl mb-1">{item.time}</h3>
                  <p className="text-stone-500 font-light">{item.event}</p>
                </div>
              ))}
            </div>
          </div>
        </FadeInSection>

        <div className="grid md:grid-cols-2 gap-12 md:gap-20">
          {/* Overnatning */}
          <FadeInSection>
            <div className="text-center md:text-left space-y-6">
              <Home className="mx-auto md:mx-0 text-stone-400 mb-4" size={32} strokeWidth={1.5} />
              <h2 className="font-serif text-3xl">Overnatning</h2>
              <div className="w-12 h-[1px] bg-stone-300 mx-auto md:mx-0"></div>
              <p className="text-stone-600 leading-relaxed font-light">
                {data.accommodation}
              </p>
            </div>
          </FadeInSection>

          {/* Ønskeliste */}
          <FadeInSection delay={200}>
            <div className="text-center md:text-left space-y-6">
              <Gift className="mx-auto md:mx-0 text-stone-400 mb-4" size={32} strokeWidth={1.5} />
              <h2 className="font-serif text-3xl">Ønskeliste</h2>
              <div className="w-12 h-[1px] bg-stone-300 mx-auto md:mx-0"></div>
              <ul className="text-stone-600 font-light space-y-4">
                {data.wishlist.map(item => (
                  <li key={item.id} className="flex items-start gap-3 justify-center md:justify-start">
                    <Heart size={16} className="mt-1 flex-shrink-0 text-stone-300 fill-current" />
                    {item.link ? (
                      <a href={item.link} target="_blank" rel="noreferrer" className="underline decoration-stone-300 underline-offset-4 hover:text-stone-900 transition-colors">
                        {item.item}
                      </a>
                    ) : (
                      <span>{item.item}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </FadeInSection>
        </div>

        {/* S.U. Formular */}
        <FadeInSection>
          <div className="bg-stone-900 text-stone-100 p-8 md:p-16 rounded-xl text-center">
            <h2 className="font-serif text-3xl md:text-4xl mb-4">S.U.</h2>
            <p className="font-light text-stone-400 mb-10">
              Vi håber meget, I vil fejre dagen med os. Senest {data.rsvpDate}.
            </p>

            {rsvpStatus === 'success' ? (
              <div className="py-12 flex flex-col items-center justify-center animate-pulse">
                <CheckCircle2 size={48} className="text-green-400 mb-4" />
                <p className="text-xl font-serif">Tak for dit svar!</p>
              </div>
            ) : (
              <form onSubmit={handleRsvpSubmit} className="max-w-md mx-auto space-y-6 text-left">
                <div>
                  <label className="block text-sm font-light text-stone-400 mb-2">Navn(e)</label>
                  <input 
                    required
                    type="text" 
                    value={rsvpForm.name}
                    onChange={e => setRsvpForm({...rsvpForm, name: e.target.value})}
                    className="w-full bg-stone-800 border border-stone-700 rounded-md p-3 text-white focus:outline-none focus:border-stone-500 transition-colors"
                    placeholder="Fulde navn på alle gæster"
                  />
                </div>
                <div>
                  <label className="block text-sm font-light text-stone-400 mb-2">Deltager I?</label>
                  <select 
                    value={rsvpForm.attending}
                    onChange={e => setRsvpForm({...rsvpForm, attending: e.target.value})}
                    className="w-full bg-stone-800 border border-stone-700 rounded-md p-3 text-white focus:outline-none focus:border-stone-500 appearance-none"
                  >
                    <option value="yes">Ja, vi/jeg deltager med glæde</option>
                    <option value="no">Nej, vi/jeg kan desværre ikke</option>
                  </select>
                </div>
                {rsvpForm.attending === 'yes' && (
                  <div>
                    <label className="block text-sm font-light text-stone-400 mb-2">Allergier eller diæter?</label>
                    <input 
                      type="text" 
                      value={rsvpForm.diet}
                      onChange={e => setRsvpForm({...rsvpForm, diet: e.target.value})}
                      className="w-full bg-stone-800 border border-stone-700 rounded-md p-3 text-white focus:outline-none focus:border-stone-500 transition-colors"
                      placeholder="F.eks. vegetar, nøddeallergi (Valgfrit)"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-light text-stone-400 mb-2">En lille hilsen (Valgfrit)</label>
                  <textarea 
                    rows={3}
                    value={rsvpForm.message}
                    onChange={e => setRsvpForm({...rsvpForm, message: e.target.value})}
                    className="w-full bg-stone-800 border border-stone-700 rounded-md p-3 text-white focus:outline-none focus:border-stone-500 transition-colors resize-none"
                    placeholder="Vi glæder os..."
                  />
                </div>
                <button 
                  disabled={rsvpStatus === 'submitting'}
                  type="submit"
                  className="w-full bg-white text-stone-900 font-medium py-4 rounded-md hover:bg-stone-200 transition-colors disabled:opacity-50"
                >
                  {rsvpStatus === 'submitting' ? 'Sender...' : 'Send Svar'}
                </button>
              </form>
            )}
          </div>
        </FadeInSection>

      </div>
      
      {/* Footer med usynligt link til admin */}
      <footer className="text-center py-10 text-stone-400 font-light text-sm border-t border-stone-200">
        <p>Vi glæder os til at se jer!</p>
        <a href="#/admin" className="opacity-0 hover:opacity-100 transition-opacity absolute bottom-2 right-4 text-xs">Admin</a>
      </footer>
    </div>
  );
}

// --- ADMIN PAGE KOMPONENT ---
function AdminPage({ data, user }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [activeTab, setActiveTab] = useState('content'); // 'content' | 'rsvps'
  const [formData, setFormData] = useState(data);
  const [rsvps, setRsvps] = useState([]);
  const [saveStatus, setSaveStatus] = useState('');

  // Hent S.U.'er hvis auth'ed
  useEffect(() => {
    if (!user || !isAuthenticated) return;
    
    const rsvpsRef = collection(db, 'artifacts', appId, 'public', 'data', 'wedding_rsvps');
    // Vi henter uden orderBy her for at overholde regel om simple queries, sorterer i memory
    const unsubscribe = onSnapshot(rsvpsRef, (snap) => {
      const rsvpData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sorter nyeste først
      rsvpData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setRsvps(rsvpData);
    }, (error) => console.error("Error fetching rsvps", error));

    return () => unsubscribe();
  }, [user, isAuthenticated]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (pin === '2026') setIsAuthenticated(true); // Simpel PIN validering
    else alert("Forkert kode");
  };

  const handleSave = async () => {
    if (!user) return;
    setSaveStatus('Gemmer...');
    try {
      const infoDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'wedding_info', 'main');
      await updateDoc(infoDocRef, formData);
      setSaveStatus('Gemt!');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (error) {
      console.error("Fejl ved gemning:", error);
      setSaveStatus('Fejl ved gemning');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100 p-4">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-xl shadow-md max-w-sm w-full text-center">
          <Lock className="mx-auto text-stone-400 mb-4" size={32} />
          <h2 className="font-serif text-2xl mb-6">Admin Panel</h2>
          <input 
            type="password" 
            placeholder="Indtast pinkode (2026)"
            value={pin}
            onChange={e => setPin(e.target.value)}
            className="w-full text-center border border-stone-300 rounded-md p-3 mb-4 focus:outline-none focus:border-stone-500"
          />
          <button type="submit" className="w-full bg-stone-900 text-white rounded-md p-3 hover:bg-stone-800 transition-colors">
            Log ind
          </button>
          <a href="#/" className="block mt-4 text-sm text-stone-400 underline">Tilbage til siden</a>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[80vh]">
        
        {/* Sidebar */}
        <div className="w-full md:w-64 bg-stone-50 border-b md:border-b-0 md:border-r border-stone-200 p-6 flex flex-col">
          <h2 className="font-serif text-2xl mb-8">Oversigt</h2>
          <nav className="space-y-2 flex-grow">
            <button 
              onClick={() => setActiveTab('content')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${activeTab === 'content' ? 'bg-stone-200 font-medium' : 'hover:bg-stone-100 text-stone-600'}`}
            >
              <Edit3 size={18} /> Rediger Indhold
            </button>
            <button 
              onClick={() => setActiveTab('rsvps')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${activeTab === 'rsvps' ? 'bg-stone-200 font-medium' : 'hover:bg-stone-100 text-stone-600'}`}
            >
              <Users size={18} /> S.U. Besvarelser
              <span className="ml-auto bg-stone-900 text-white text-xs py-1 px-2 rounded-full">{rsvps.length}</span>
            </button>
          </nav>
          <a href="#/" className="mt-8 text-sm text-stone-500 hover:text-stone-900 flex items-center gap-2">
            &larr; Tilbage til hjemmeside
          </a>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-6 md:p-10 overflow-y-auto">
          {activeTab === 'content' && (
            <div className="space-y-8 max-w-2xl">
              <div className="flex justify-between items-center border-b border-stone-200 pb-4">
                <h1 className="text-3xl font-serif">Rediger Hjemmeside</h1>
                <button onClick={handleSave} className="bg-stone-900 text-white px-6 py-2 rounded-md hover:bg-stone-800 transition-colors font-medium">
                  {saveStatus || 'Gem ændringer'}
                </button>
              </div>

              {/* Generelle Informationer */}
              <div className="space-y-4">
                <h3 className="font-medium text-lg text-stone-900">Generelt</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-stone-500 uppercase tracking-wider mb-1">Navne</label>
                    <input className="w-full border border-stone-300 rounded p-2 focus:border-stone-500 outline-none" value={formData.names} onChange={e => setFormData({...formData, names: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 uppercase tracking-wider mb-1">Dato</label>
                    <input className="w-full border border-stone-300 rounded p-2 focus:border-stone-500 outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-stone-500 uppercase tracking-wider mb-1">S.U. Frist</label>
                  <input className="w-full border border-stone-300 rounded p-2 focus:border-stone-500 outline-none" value={formData.rsvpDate} onChange={e => setFormData({...formData, rsvpDate: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 uppercase tracking-wider mb-1">Hero Billede URL (Unsplash e.lign.)</label>
                  <input className="w-full border border-stone-300 rounded p-2 focus:border-stone-500 outline-none" value={formData.heroImage} onChange={e => setFormData({...formData, heroImage: e.target.value})} />
                </div>
              </div>

              {/* Tekster */}
              <div className="space-y-4">
                <h3 className="font-medium text-lg text-stone-900 border-t border-stone-100 pt-6">Tekst Sektioner</h3>
                <div>
                  <label className="block text-xs text-stone-500 uppercase tracking-wider mb-1">Tid & Sted</label>
                  <textarea rows={3} className="w-full border border-stone-300 rounded p-2 focus:border-stone-500 outline-none resize-none" value={formData.timeAndPlace} onChange={e => setFormData({...formData, timeAndPlace: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 uppercase tracking-wider mb-1">Overnatning</label>
                  <textarea rows={3} className="w-full border border-stone-300 rounded p-2 focus:border-stone-500 outline-none resize-none" value={formData.accommodation} onChange={e => setFormData({...formData, accommodation: e.target.value})} />
                </div>
              </div>

              {/* Program Editor */}
              <div className="space-y-4">
                <h3 className="font-medium text-lg text-stone-900 border-t border-stone-100 pt-6">Program</h3>
                {formData.program.map((item, index) => (
                  <div key={item.id} className="flex gap-2 items-center bg-stone-50 p-2 rounded border border-stone-200">
                    <input className="w-24 border border-stone-300 rounded p-2 text-sm" placeholder="13:00" value={item.time} onChange={e => {
                      const newProgram = [...formData.program];
                      newProgram[index].time = e.target.value;
                      setFormData({...formData, program: newProgram});
                    }}/>
                    <input className="flex-1 border border-stone-300 rounded p-2 text-sm" placeholder="Begivenhed" value={item.event} onChange={e => {
                      const newProgram = [...formData.program];
                      newProgram[index].event = e.target.value;
                      setFormData({...formData, program: newProgram});
                    }}/>
                    <button onClick={() => {
                      setFormData({...formData, program: formData.program.filter((_, i) => i !== index)});
                    }} className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                  </div>
                ))}
                <button onClick={() => {
                  setFormData({...formData, program: [...formData.program, {id: Date.now(), time: "", event: ""}]});
                }} className="text-sm font-medium text-stone-600 flex items-center gap-1 hover:text-stone-900">
                  <Plus size={16} /> Tilføj punkt
                </button>
              </div>

              {/* Ønskeliste Editor */}
              <div className="space-y-4">
                <h3 className="font-medium text-lg text-stone-900 border-t border-stone-100 pt-6">Ønskeliste</h3>
                {formData.wishlist.map((item, index) => (
                  <div key={item.id} className="flex gap-2 items-center bg-stone-50 p-2 rounded border border-stone-200">
                    <input className="flex-1 border border-stone-300 rounded p-2 text-sm" placeholder="Ønske" value={item.item} onChange={e => {
                      const newWishlist = [...formData.wishlist];
                      newWishlist[index].item = e.target.value;
                      setFormData({...formData, wishlist: newWishlist});
                    }}/>
                    <input className="flex-1 border border-stone-300 rounded p-2 text-sm" placeholder="Link (Valgfrit, inkl. https://)" value={item.link} onChange={e => {
                      const newWishlist = [...formData.wishlist];
                      newWishlist[index].link = e.target.value;
                      setFormData({...formData, wishlist: newWishlist});
                    }}/>
                    <button onClick={() => {
                      setFormData({...formData, wishlist: formData.wishlist.filter((_, i) => i !== index)});
                    }} className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                  </div>
                ))}
                <button onClick={() => {
                  setFormData({...formData, wishlist: [...formData.wishlist, {id: Date.now(), item: "", link: ""}]});
                }} className="text-sm font-medium text-stone-600 flex items-center gap-1 hover:text-stone-900">
                  <Plus size={16} /> Tilføj ønske
                </button>
              </div>

            </div>
          )}

          {activeTab === 'rsvps' && (
            <div className="space-y-6">
              <h1 className="text-3xl font-serif border-b border-stone-200 pb-4">S.U. Besvarelser</h1>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-green-50 text-green-800 p-4 rounded-lg">
                  <p className="text-sm font-medium">Deltager</p>
                  <p className="text-3xl font-serif mt-1">{rsvps.filter(r => r.attending === 'yes').length}</p>
                </div>
                <div className="bg-red-50 text-red-800 p-4 rounded-lg">
                  <p className="text-sm font-medium">Deltager ikke</p>
                  <p className="text-3xl font-serif mt-1">{rsvps.filter(r => r.attending === 'no').length}</p>
                </div>
                <div className="bg-stone-100 text-stone-800 p-4 rounded-lg">
                  <p className="text-sm font-medium">Total Besvarelser</p>
                  <p className="text-3xl font-serif mt-1">{rsvps.length}</p>
                </div>
              </div>

              <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-stone-50 border-b border-stone-200">
                    <tr>
                      <th className="p-4 font-medium text-stone-600">Navn</th>
                      <th className="p-4 font-medium text-stone-600">Status</th>
                      <th className="p-4 font-medium text-stone-600">Allergi/Diæt</th>
                      <th className="p-4 font-medium text-stone-600">Hilsen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {rsvps.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="p-8 text-center text-stone-500 font-light">Ingen besvarelser endnu.</td>
                      </tr>
                    ) : rsvps.map((rsvp) => (
                      <tr key={rsvp.id} className="hover:bg-stone-50">
                        <td className="p-4 font-medium">{rsvp.name}</td>
                        <td className="p-4">
                          {rsvp.attending === 'yes' 
                            ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">Deltager</span> 
                            : <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">Afbud</span>}
                        </td>
                        <td className="p-4 text-stone-600">{rsvp.diet || '-'}</td>
                        <td className="p-4 text-stone-600 max-w-xs truncate" title={rsvp.message}>{rsvp.message || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}