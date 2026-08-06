import React, { useState, useEffect, useRef } from 'react';
import {
  Heart, MapPin, Clock, Gift, Home, CheckCircle2, Lock, Users, Edit3, Plus,
  Trash2, ChevronDown, Navigation, ArrowUpRight, HelpCircle, X, UserPlus,
  CalendarPlus, Download, ExternalLink
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore, doc, setDoc, collection, addDoc, onSnapshot, updateDoc
} from 'firebase/firestore';
import { firebaseConfig, appId, DEFAULT_DATA } from './weddingConfig';
import IntroOverlay from './IntroOverlay';
import { buildCalendar, downloadIcs } from './calendar';

// --- FIREBASE SETUP ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const NAV_LINKS = [
  { id: 'hjem', label: 'Hjem' },
  { id: 'program', label: 'Program' },
  { id: 'rejse', label: 'Find vej' },
  { id: 'praktisk', label: 'Praktisk' },
  { id: 'su', label: 'S.U.' },
];

// Tomme rækker til S.U.-formularen (per-gæst navn + allergi)
const emptyGuest = () => ({ name: '', diet: '' });
const emptyRsvp = () => ({ name: '', attending: 'yes', guests: [emptyGuest()], message: '' });

// --- SCROLL REVEAL (IntersectionObserver + spring-eased CSS) ---
const Reveal = ({ children, delay = 0, className = '' }) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const node = ref.current;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    if (node) observer.observe(node);
    return () => { if (node) observer.unobserve(node); };
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-[900ms] ease-spring will-change-[transform,opacity] ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

// --- LIVE COUNTDOWN ---
function getRemaining(target) {
  const diff = new Date(target).getTime() - Date.now();
  if (isNaN(diff)) return null;
  if (diff <= 0) return { done: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return { done: false, days, hours, minutes, seconds };
}

const Countdown = ({ target, light = false }) => {
  const [t, setT] = useState(() => getRemaining(target));
  useEffect(() => {
    const tick = () => setT(getRemaining(target));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [target]);

  if (!t) return null;

  const numCls = light ? 'text-white' : 'text-ink';
  const labelCls = light ? 'text-white/70' : 'text-ink-faint';
  const sepCls = light ? 'text-white/40' : 'text-gold/50';

  if (t.done) {
    return (
      <p className={`font-serif text-2xl md:text-3xl ${numCls}`}>
        I dag fejrer vi kærligheden ♥
      </p>
    );
  }

  const units = [
    { v: t.days, l: 'Dage' },
    { v: t.hours, l: 'Timer' },
    { v: t.minutes, l: 'Min.' },
    { v: t.seconds, l: 'Sek.' },
  ];

  return (
    <div className="flex items-end justify-center gap-3 sm:gap-6">
      {units.map((u, i) => (
        <React.Fragment key={u.l}>
          <div className="flex flex-col items-center min-w-[3.2rem] sm:min-w-[4.5rem]">
            <span
              className={`font-serif tabular-nums leading-none text-4xl sm:text-6xl ${numCls}`}
              style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}
            >
              {String(u.v).padStart(2, '0')}
            </span>
            <span className={`mt-2 text-[0.62rem] sm:text-xs uppercase tracking-widest2 ${labelCls}`}>
              {u.l}
            </span>
          </div>
          {i < units.length - 1 && (
            <span className={`font-serif text-3xl sm:text-5xl leading-none pb-6 ${sepCls}`}>·</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// --- SECTION HEADING ---
const SectionHeading = ({ icon: Icon, kicker, title, align = 'center' }) => (
  <div className={align === 'center' ? 'text-center' : 'text-left'}>
    {Icon && (
      <Icon
        className={`${align === 'center' ? 'mx-auto' : ''} text-gold mb-5`}
        size={30}
        strokeWidth={1.25}
      />
    )}
    {kicker && (
      <p className="text-[0.7rem] uppercase tracking-widest2 text-ink-faint mb-3">{kicker}</p>
    )}
    <h2 className="font-serif text-4xl md:text-5xl text-ink" style={{ letterSpacing: '-0.015em' }}>
      {title}
    </h2>
    <div className={`rule mt-5 ${align === 'center' ? 'mx-auto' : ''}`} />
  </div>
);

// --- MAIN APP ---
export default function App() {
  const [user, setUser] = useState(null);
  const [weddingData, setWeddingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('landing');
  // Intro vises kun én gang pr. browser-session (og aldrig på admin-siden).
  const [showIntro, setShowIntro] = useState(() => {
    try { return sessionStorage.getItem('aj-intro-seen') !== '1'; } catch { return true; }
  });
  const introActive = showIntro && currentView === 'landing' && !!weddingData;

  // Lås scroll mens introen kører.
  useEffect(() => {
    document.body.style.overflow = introActive ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [introActive]);

  const dismissIntro = () => {
    try { sessionStorage.setItem('aj-intro-seen', '1'); } catch { /* ignore */ }
    setShowIntro(false);
  };

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentView(window.location.hash === '#/admin' ? 'admin' : 'landing');
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    signInAnonymously(auth).catch((error) => console.error("Auth error:", error));
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const infoDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'wedding_info', 'main');
    const unsubscribe = onSnapshot(infoDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        // Merge så nye felter (nedtælling, kort m.m.) altid har en værdi
        setWeddingData({ ...DEFAULT_DATA, ...docSnap.data() });
      } else {
        await setDoc(infoDocRef, DEFAULT_DATA);
        setWeddingData(DEFAULT_DATA);
      }
      setLoading(false);
    }, (error) => {
      // Hvis databasen ikke kan læses (fx rettigheder/offline), vis stadig siden
      // med standardindhold, så gæster aldrig møder en evig "Indlæser..."-skærm.
      console.error("Fejl ved hentning af data:", error);
      setWeddingData((prev) => prev ?? DEFAULT_DATA);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  if (loading || !weddingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ivory">
        <div className="animate-pulse text-ink-faint font-serif text-2xl tracking-widest2">
          Et øjeblik &hellip;
        </div>
      </div>
    );
  }

  return (
    <div className="font-sans text-ink bg-ivory min-h-screen overflow-x-hidden selection:bg-blush selection:text-ink">
      {introActive && (
        <IntroOverlay
          names={weddingData.names}
          subtitle={weddingData.intro}
          date={weddingData.date}
          onDone={dismissIntro}
        />
      )}
      {currentView === 'landing'
        ? <LandingPage data={weddingData} user={user} />
        : <AdminPage data={weddingData} user={user} />}
    </div>
  );
}

// --- TRANSLUCENT NAV ---
function Nav({ names }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const initials = names.split('&').map(s => s.trim()[0]).filter(Boolean).join(' & ');

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ease-spring ${
        scrolled ? 'glass shadow-glass py-3' : 'py-5'
      }`}
    >
      <nav className="max-w-6xl mx-auto px-6 flex items-center justify-between">
        <a
          href="#hjem"
          className={`font-serif text-xl tracking-wide transition-colors ${
            scrolled ? 'text-ink' : 'text-white text-shadow-soft'
          }`}
        >
          {initials}
        </a>
        <ul className="flex items-center gap-6 sm:gap-8">
          {NAV_LINKS.map((l) => (
            <li key={l.id}>
              <a
                href={`#${l.id}`}
                className={`text-sm font-light tracking-wide transition-colors hover:text-gold ${
                  scrolled ? 'text-ink-soft' : 'text-white/90 text-shadow-soft'
                }`}
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

// --- LANDING PAGE ---
function LandingPage({ data, user }) {
  const [rsvpForm, setRsvpForm] = useState(emptyRsvp);
  const [rsvpStatus, setRsvpStatus] = useState('idle');
  const [heroOffset, setHeroOffset] = useState(0);

  // Hjælpere til per-gæst-listen i S.U.-formularen
  const setGuest = (i, patch) => {
    const guests = rsvpForm.guests.map((g, idx) => (idx === i ? { ...g, ...patch } : g));
    setRsvpForm({ ...rsvpForm, guests });
  };
  const addGuest = () => setRsvpForm({ ...rsvpForm, guests: [...rsvpForm.guests, emptyGuest()] });
  const removeGuest = (i) =>
    setRsvpForm({ ...rsvpForm, guests: rsvpForm.guests.filter((_, idx) => idx !== i) });

  // Subtle hero parallax (respect reduced motion)
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    let raf = 0;
    const onScroll = () => {
      raf = requestAnimationFrame(() => setHeroOffset(Math.min(window.scrollY * 0.35, 260)));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);

  const handleRsvpSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setRsvpStatus('submitting');
    try {
      const rsvpsRef = collection(db, 'artifacts', appId, 'public', 'data', 'wedding_rsvps');
      // Kun gæster med et navn tælles med; ved afbud gemmes ingen gæsteliste.
      const guests =
        rsvpForm.attending === 'yes'
          ? rsvpForm.guests.filter((g) => g.name.trim())
          : [];
      await addDoc(rsvpsRef, {
        name: rsvpForm.name.trim(),
        attending: rsvpForm.attending,
        guests,
        guestCount: guests.length,
        message: rsvpForm.message.trim(),
        timestamp: new Date().toISOString(),
      });
      setRsvpStatus('success');
      setRsvpForm(emptyRsvp());
    } catch (error) {
      console.error("Fejl ved afsendelse af S.U.:", error);
      setRsvpStatus('idle');
    }
  };

  return (
    <div>
      <Nav names={data.names} />

      {/* ---------- HERO ---------- */}
      <section id="hjem" className="relative h-[100svh] min-h-[620px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src={data.heroImage}
            alt=""
            className="w-full h-[120%] object-cover"
            style={{ transform: `translateY(${heroOffset}px) scale(1.05)` }}
          />
          <div className="absolute inset-0 hero-scrim" />
        </div>

        <div className="relative z-10 text-center text-white px-6 max-w-3xl">
          <Reveal>
            <p className="tracking-widest2 uppercase text-xs md:text-sm mb-6 font-light text-white/85">
              Vi skal giftes
            </p>
          </Reveal>
          <Reveal delay={150}>
            <h1
              className="font-serif text-6xl md:text-8xl lg:text-9xl mb-6 font-medium text-shadow-soft"
              style={{ letterSpacing: '-0.02em', lineHeight: 1.02 }}
            >
              {data.names}
            </h1>
          </Reveal>
          <Reveal delay={300}>
            <div className="flex items-center justify-center gap-4 text-lg md:text-xl font-light tracking-wide text-white/90">
              <span className="w-8 h-px bg-white/40" />
              {data.date}
              <span className="w-8 h-px bg-white/40" />
            </div>
          </Reveal>
          <Reveal delay={450} className="mt-12">
            <Countdown target={data.eventDate} light />
          </Reveal>
          <Reveal delay={650} className="mt-10">
            <AddToCalendar data={data} />
          </Reveal>
        </div>

        <a
          href="#velkommen"
          aria-label="Rul ned"
          className="absolute bottom-9 left-1/2 -translate-x-1/2 text-white/70 animate-floaty"
        >
          <ChevronDown size={30} strokeWidth={1} />
        </a>
      </section>

      {/* ---------- INTRO / VELKOMMEN ---------- */}
      <section id="velkommen" className="max-w-3xl mx-auto px-6 pt-24 md:pt-32 text-center">
        <Reveal>
          <p className="text-[0.7rem] uppercase tracking-widest2 text-gold mb-6">Velkommen</p>
          <p
            className="font-serif text-2xl md:text-4xl leading-snug text-ink"
            style={{ letterSpacing: '-0.01em' }}
          >
            {data.intro}
          </p>
          <Heart className="mx-auto mt-8 text-blush fill-current" size={22} />
        </Reveal>
      </section>

      <div className="max-w-4xl mx-auto px-6 py-24 md:py-32 space-y-28 md:space-y-36">

        {/* ---------- TID & STED ---------- */}
        <section>
          <Reveal>
            <SectionHeading icon={MapPin} kicker="Ceremoni & Fest" title="Tid & Sted" />
            <p className="text-ink-soft leading-relaxed max-w-2xl mx-auto text-lg font-light text-center mt-8">
              {data.timeAndPlace}
            </p>
          </Reveal>
        </section>

        {/* ---------- PROGRAM ---------- */}
        <section id="program">
          <Reveal>
            <div className="bg-ivory-100 border border-line rounded-3xl shadow-soft p-8 md:p-14">
              <SectionHeading icon={Clock} kicker="Timeplan" title="Dagens Program" />
              <div className="max-w-md mx-auto relative mt-12 pl-8">
                <span className="absolute left-[6px] top-2 bottom-2 w-px bg-gradient-to-b from-gold/30 via-line to-transparent" />
                <div className="space-y-9">
                  {data.program.map((item, i) => (
                    <Reveal key={item.id} delay={i * 90}>
                      <div className="relative">
                        <span className="absolute -left-8 top-1.5 w-3.5 h-3.5 rounded-full bg-ivory border-2 border-gold" />
                        <h3 className="font-serif text-2xl text-ink leading-none">{item.time}</h3>
                        <p className="text-ink-soft font-light mt-1">{item.event}</p>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ---------- FIND VEJ / KORT ---------- */}
        <section id="rejse">
          <Reveal>
            <SectionHeading icon={Navigation} kicker="Praktisk" title="Find Vej" />
          </Reveal>
          {(() => {
            // Én lokation (vielse og fest samme sted) → vis ét bredt kort.
            const sameVenue =
              `${data.ceremonyName}|${data.ceremonyAddress}`.trim().toLowerCase() ===
              `${data.venueName}|${data.venueAddress}`.trim().toLowerCase();
            if (sameVenue) {
              return (
                <div className="max-w-xl mx-auto mt-12">
                  <MapCard
                    label="Ceremoni & Fest"
                    name={data.venueName}
                    address={data.venueAddress}
                  />
                </div>
              );
            }
            return (
              <div className="grid md:grid-cols-2 gap-6 md:gap-8 mt-12">
                <MapCard delay={0} label="Vielse" name={data.ceremonyName} address={data.ceremonyAddress} />
                <MapCard delay={120} label="Reception & Fest" name={data.venueName} address={data.venueAddress} />
              </div>
            );
          })()}
        </section>

        {/* ---------- OVERNATNING + ØNSKELISTE ---------- */}
        <section className="grid md:grid-cols-2 gap-14 md:gap-20">
          <Reveal>
            <div className="text-center md:text-left">
              <Home className="mx-auto md:mx-0 text-gold mb-5" size={28} strokeWidth={1.4} />
              <h2 className="font-serif text-3xl text-ink">Overnatning</h2>
              <div className="rule mt-4 mx-auto md:mx-0" />
              <p className="text-ink-soft leading-relaxed font-light mt-6">{data.accommodation}</p>
            </div>
          </Reveal>
          <Reveal delay={150}>
            <div className="text-center md:text-left">
              <Gift className="mx-auto md:mx-0 text-gold mb-5" size={28} strokeWidth={1.4} />
              <h2 className="font-serif text-3xl text-ink">Ønskeliste</h2>
              <div className="rule mt-4 mx-auto md:mx-0" />
              <ul className="text-ink-soft font-light space-y-4 mt-6">
                {data.wishlist.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 justify-center md:justify-start">
                    <Heart size={15} className="mt-1.5 flex-shrink-0 text-blush fill-current" />
                    {item.link ? (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="group inline-flex items-center gap-1 hover:text-ink transition-colors"
                      >
                        <span className="underline decoration-line underline-offset-4 group-hover:decoration-gold">
                          {item.item}
                        </span>
                        <ArrowUpRight size={13} className="text-gold" />
                      </a>
                    ) : (
                      <span>{item.item}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </section>

        {/* ---------- PRAKTISK / FAQ ---------- */}
        <section id="praktisk">
          <Reveal>
            <SectionHeading icon={HelpCircle} kicker="Godt at vide" title="Praktisk & FAQ" />
          </Reveal>
          <div className="mt-12">
            <FAQSection items={data.faq} />
          </div>
        </section>

        {/* ---------- S.U. ---------- */}
        <section id="su">
          <Reveal>
            <div className="relative overflow-hidden bg-ink text-ivory-100 p-8 md:p-16 rounded-[2rem] shadow-lift">
              <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gold/10 blur-3xl" />
              <div className="relative text-center">
                <p className="text-[0.7rem] uppercase tracking-widest2 text-gold-soft mb-4">Svar udbedes</p>
                <h2 className="font-serif text-4xl md:text-5xl mb-4">S.U.</h2>
                <p className="font-light text-ivory/70 mb-10 max-w-md mx-auto">
                  Vi håber meget, I vil fejre dagen med os. Svar venligst senest {data.rsvpDate}.
                </p>

                {rsvpStatus === 'success' ? (
                  <div className="py-12 flex flex-col items-center justify-center animate-fade-up">
                    <CheckCircle2 size={48} className="text-sage mb-4" />
                    <p className="text-2xl font-serif">Tak for dit svar!</p>
                    <p className="text-ivory/60 font-light mt-2">Vi glæder os til at se jer.</p>
                  </div>
                ) : (
                  <form onSubmit={handleRsvpSubmit} className="max-w-md mx-auto space-y-5 text-left">
                    <Field label="Hvem svarer? (kontaktperson)">
                      <input
                        required
                        type="text"
                        value={rsvpForm.name}
                        onChange={(e) => setRsvpForm({ ...rsvpForm, name: e.target.value })}
                        className="dark-input"
                        placeholder="Dit navn"
                      />
                    </Field>
                    <Field label="Deltager I?">
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { v: 'yes', t: 'Ja, med glæde' },
                          { v: 'no', t: 'Desværre ikke' },
                        ].map((o) => (
                          <button
                            key={o.v}
                            type="button"
                            onClick={() => setRsvpForm({ ...rsvpForm, attending: o.v })}
                            className={`btn-press rounded-xl py-3 text-sm font-medium border ${
                              rsvpForm.attending === o.v
                                ? 'bg-ivory-100 text-ink border-transparent'
                                : 'bg-white/5 text-ivory/80 border-white/15 hover:border-white/30'
                            }`}
                          >
                            {o.t}
                          </button>
                        ))}
                      </div>
                    </Field>
                    {rsvpForm.attending === 'yes' && (
                      <Field label="Hvem kommer? (navn + evt. allergi pr. person)">
                        <div className="space-y-2.5">
                          {rsvpForm.guests.map((g, i) => (
                            <div key={i} className="flex gap-2 items-center">
                              <input
                                type="text"
                                value={g.name}
                                onChange={(e) => setGuest(i, { name: e.target.value })}
                                className="dark-input flex-1"
                                placeholder={`Gæst ${i + 1}`}
                              />
                              <input
                                type="text"
                                value={g.diet}
                                onChange={(e) => setGuest(i, { diet: e.target.value })}
                                className="dark-input flex-1"
                                placeholder="Allergi/diæt"
                              />
                              {rsvpForm.guests.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeGuest(i)}
                                  aria-label="Fjern gæst"
                                  className="btn-press shrink-0 text-ivory/50 hover:text-white p-2"
                                >
                                  <X size={16} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={addGuest}
                          className="btn-press mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-gold-soft hover:text-white"
                        >
                          <UserPlus size={15} /> Tilføj gæst
                        </button>
                      </Field>
                    )}
                    <Field label="En lille hilsen (valgfrit)">
                      <textarea
                        rows={3}
                        value={rsvpForm.message}
                        onChange={(e) => setRsvpForm({ ...rsvpForm, message: e.target.value })}
                        className="dark-input resize-none"
                        placeholder="Vi glæder os..."
                      />
                    </Field>
                    <button
                      disabled={rsvpStatus === 'submitting'}
                      type="submit"
                      className="btn-press w-full bg-gold text-white font-medium py-4 rounded-xl hover:bg-gold-deep disabled:opacity-50"
                    >
                      {rsvpStatus === 'submitting' ? 'Sender...' : 'Send svar'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </Reveal>
        </section>
      </div>

      {/* ---------- FOOTER ---------- */}
      <footer className="relative text-center py-14 border-t border-line">
        <p className="font-serif text-3xl text-ink mb-2">{data.names}</p>
        <p className="text-ink-faint font-light text-sm tracking-wide">
          Vi glæder os til at se jer · {data.date}
        </p>
        <a
          href="#/admin"
          className="opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity absolute bottom-3 right-4 text-xs text-ink-faint"
        >
          Admin
        </a>
      </footer>

      {/* Scoped dark-input styling for the RSVP card */}
      <style>{`
        .dark-input {
          width: 100%;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 0.75rem;
          padding: 0.85rem 1rem;
          color: #FDFBF7;
          transition: border-color .2s ease, background-color .2s ease;
        }
        .dark-input::placeholder { color: rgba(253,251,247,0.4); }
        .dark-input:focus {
          outline: none;
          border-color: #C7A876;
          background: rgba(255,255,255,0.09);
        }
      `}</style>
    </div>
  );
}

// Small labelled field wrapper for the dark RSVP form
const Field = ({ label, children }) => (
  <div>
    <label className="block text-xs font-light text-ivory/60 mb-2 tracking-wide">{label}</label>
    {children}
  </div>
);

// --- TILFØJ TIL KALENDER ---
function AddToCalendar({ data }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const cal = buildCalendar(data);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  if (!cal) return null;

  const item = "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-ink text-left hover:bg-ivory-200 transition-colors";

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn-press inline-flex items-center gap-2 text-sm font-light tracking-wide text-white/90 border border-white/35 rounded-full px-5 py-2.5 backdrop-blur-sm hover:bg-white/10"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <CalendarPlus size={16} /> Tilføj til kalender
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-1/2 -translate-x-1/2 mt-2 w-60 bg-ivory-100 border border-line rounded-2xl shadow-lift p-1.5 z-20 animate-fade-up"
        >
          <a href={cal.googleUrl} target="_blank" rel="noreferrer" onClick={() => setOpen(false)} className={item} role="menuitem">
            <ExternalLink size={16} className="text-gold" /> Google Kalender
          </a>
          <button
            type="button"
            onClick={() => { downloadIcs(cal.ics, 'anders-og-julie-bryllup.ics'); setOpen(false); }}
            className={item}
            role="menuitem"
          >
            <Download size={16} className="text-gold" /> Apple / Outlook (.ics)
          </button>
        </div>
      )}
    </div>
  );
}

// --- MAP CARD (no API key — Google Maps embed) ---
function MapCard({ label, name, address, delay = 0 }) {
  const query = encodeURIComponent(`${name}, ${address}`);
  const embed = `https://www.google.com/maps?q=${query}&z=15&output=embed`;
  const link = `https://www.google.com/maps/search/?api=1&query=${query}`;

  return (
    <Reveal delay={delay}>
      <div className="group bg-ivory-100 border border-line rounded-3xl overflow-hidden shadow-soft hover:shadow-lift transition-shadow duration-500">
        <div className="relative h-52 bg-line/40">
          <iframe
            title={name}
            src={embed}
            className="w-full h-full grayscale-[0.15] contrast-[1.02]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
        <div className="p-6">
          <p className="text-[0.7rem] uppercase tracking-widest2 text-gold mb-2">{label}</p>
          <h3 className="font-serif text-2xl text-ink">{name}</h3>
          <p className="text-ink-soft font-light text-sm mt-1">{address}</p>
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="btn-press inline-flex items-center gap-2 mt-5 text-sm font-medium text-ink border border-line rounded-full px-4 py-2 hover:border-gold hover:text-gold-deep"
          >
            <Navigation size={14} /> Vis rute
          </a>
        </div>
      </div>
    </Reveal>
  );
}

// --- FAQ ACCORDION ---
function FAQSection({ items = [] }) {
  const [open, setOpen] = useState(null);
  if (!items.length) return null;
  return (
    <div className="max-w-2xl mx-auto border-y border-line">
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <Reveal key={it.id ?? i} delay={i * 60}>
            <div className="border-b border-line last:border-b-0">
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="btn-press w-full flex items-center justify-between gap-4 py-5 text-left"
              >
                <span className="font-serif text-xl md:text-2xl text-ink">{it.q}</span>
                <ChevronDown
                  size={20}
                  className={`shrink-0 text-gold transition-transform duration-300 ease-spring ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>
              <div className={`grid transition-all duration-300 ease-spring ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                  <p className="text-ink-soft font-light leading-relaxed pb-6 pr-8">{it.a}</p>
                </div>
              </div>
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}

// --- ADMIN PAGE ---
function AdminPage({ data, user }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [activeTab, setActiveTab] = useState('content');
  const [formData, setFormData] = useState(data);
  const [rsvps, setRsvps] = useState([]);
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    if (!user || !isAuthenticated) return;
    const rsvpsRef = collection(db, 'artifacts', appId, 'public', 'data', 'wedding_rsvps');
    const unsubscribe = onSnapshot(rsvpsRef, (snap) => {
      const rsvpData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      rsvpData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setRsvps(rsvpData);
    }, (error) => console.error("Error fetching rsvps", error));
    return () => unsubscribe();
  }, [user, isAuthenticated]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (pin === '2026') { setIsAuthenticated(true); setPinError(false); }
    else { setPinError(true); setPin(''); }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaveStatus('Gemmer...');
    try {
      const infoDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'wedding_info', 'main');
      await updateDoc(infoDocRef, formData);
      setSaveStatus('Gemt ✓');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (error) {
      console.error("Fejl ved gemning:", error);
      setSaveStatus('Fejl ved gemning');
    }
  };

  const set = (patch) => setFormData({ ...formData, ...patch });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ivory p-4">
        <form onSubmit={handleLogin} className="bg-ivory-100 border border-line p-10 rounded-3xl shadow-soft max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-full bg-ivory-200 flex items-center justify-center mx-auto mb-5">
            <Lock className="text-gold" size={24} strokeWidth={1.5} />
          </div>
          <h2 className="font-serif text-3xl text-ink mb-1">Admin</h2>
          <p className="text-ink-faint font-light text-sm mb-6">{data.names}</p>
          <input
            type="password"
            placeholder="Adgangskode"
            value={pin}
            onChange={(e) => { setPin(e.target.value); setPinError(false); }}
            className={`w-full text-center bg-white border rounded-xl p-3 mb-3 outline-none transition-colors ${
              pinError ? 'border-red-300 focus:border-red-400' : 'border-line focus:border-gold'
            }`}
          />
          {pinError && <p className="text-red-400 text-xs mb-3">Forkert adgangskode</p>}
          <button type="submit" className="btn-press w-full bg-ink text-white rounded-xl p-3 hover:bg-black">
            Log ind
          </button>
          <a href="#/" className="block mt-5 text-sm text-ink-faint underline underline-offset-4 hover:text-ink">
            Tilbage til siden
          </a>
        </form>
      </div>
    );
  }

  // Bagudkompatibel: gamle svar har kun name/diet, nye har en guests-liste.
  const guestsOf = (r) =>
    r.guests?.length ? r.guests : (r.name ? [{ name: r.name, diet: r.diet || '' }] : []);
  const countOf = (r) => r.guestCount ?? guestsOf(r).length;
  const attendingPeople = rsvps
    .filter((r) => r.attending === 'yes')
    .reduce((sum, r) => sum + countOf(r), 0);
  const notCount = rsvps.filter((r) => r.attending === 'no').length;

  return (
    <div className="min-h-screen bg-ivory p-4 md:p-8">
      <div className="max-w-5xl mx-auto bg-ivory-100 border border-line rounded-3xl shadow-soft overflow-hidden flex flex-col md:flex-row min-h-[80vh]">

        {/* Sidebar */}
        <div className="w-full md:w-64 bg-ivory-200/60 border-b md:border-b-0 md:border-r border-line p-6 flex flex-col">
          <h2 className="font-serif text-3xl text-ink mb-1">Oversigt</h2>
          <p className="text-ink-faint text-xs font-light mb-8 tracking-wide">Bryllupsadministration</p>
          <nav className="space-y-2 flex-grow">
            <TabButton active={activeTab === 'content'} onClick={() => setActiveTab('content')} icon={Edit3}>
              Rediger indhold
            </TabButton>
            <TabButton active={activeTab === 'rsvps'} onClick={() => setActiveTab('rsvps')} icon={Users} badge={rsvps.length}>
              S.U. besvarelser
            </TabButton>
          </nav>
          <a href="#/" className="mt-8 text-sm text-ink-soft hover:text-ink flex items-center gap-2 transition-colors">
            &larr; Tilbage til hjemmeside
          </a>
        </div>

        {/* Main */}
        <div className="flex-1 p-6 md:p-10 overflow-y-auto">
          {activeTab === 'content' && (
            <div className="space-y-9 max-w-2xl">
              <div className="flex justify-between items-center border-b border-line pb-5">
                <h1 className="text-3xl font-serif text-ink">Rediger hjemmeside</h1>
                <button onClick={handleSave} className="btn-press bg-gold text-white px-6 py-2.5 rounded-xl hover:bg-gold-deep font-medium">
                  {saveStatus || 'Gem ændringer'}
                </button>
              </div>

              <AdminGroup title="Generelt">
                <div className="grid grid-cols-2 gap-4">
                  <AInput label="Navne" value={formData.names} onChange={(v) => set({ names: v })} />
                  <AInput label="Dato (visning)" value={formData.date} onChange={(v) => set({ date: v })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <AInput label="Dato & tid til nedtælling" type="datetime-local"
                    value={toLocalInput(formData.eventDate)}
                    onChange={(v) => set({ eventDate: v })} />
                  <AInput label="S.U. frist" value={formData.rsvpDate} onChange={(v) => set({ rsvpDate: v })} />
                </div>
                <AInput label="Hero billede URL" value={formData.heroImage} onChange={(v) => set({ heroImage: v })} />
              </AdminGroup>

              <AdminGroup title="Tekster">
                <AArea label="Velkomst / intro" value={formData.intro} onChange={(v) => set({ intro: v })} />
                <AArea label="Tid & Sted" value={formData.timeAndPlace} onChange={(v) => set({ timeAndPlace: v })} />
                <AArea label="Overnatning" value={formData.accommodation} onChange={(v) => set({ accommodation: v })} />
              </AdminGroup>

              <AdminGroup title="Find vej (kort)">
                <div className="grid grid-cols-2 gap-4">
                  <AInput label="Vielse — sted" value={formData.ceremonyName} onChange={(v) => set({ ceremonyName: v })} />
                  <AInput label="Vielse — adresse" value={formData.ceremonyAddress} onChange={(v) => set({ ceremonyAddress: v })} />
                  <AInput label="Fest — sted" value={formData.venueName} onChange={(v) => set({ venueName: v })} />
                  <AInput label="Fest — adresse" value={formData.venueAddress} onChange={(v) => set({ venueAddress: v })} />
                </div>
              </AdminGroup>

              <AdminGroup title="Program">
                {formData.program.map((item, index) => (
                  <div key={item.id} className="flex gap-2 items-center bg-white p-2 rounded-xl border border-line">
                    <input className="w-24 border border-line rounded-lg p-2 text-sm outline-none focus:border-gold" placeholder="13:00"
                      value={item.time}
                      onChange={(e) => {
                        const p = [...formData.program]; p[index] = { ...p[index], time: e.target.value }; set({ program: p });
                      }} />
                    <input className="flex-1 border border-line rounded-lg p-2 text-sm outline-none focus:border-gold" placeholder="Begivenhed"
                      value={item.event}
                      onChange={(e) => {
                        const p = [...formData.program]; p[index] = { ...p[index], event: e.target.value }; set({ program: p });
                      }} />
                    <button onClick={() => set({ program: formData.program.filter((_, i) => i !== index) })}
                      className="p-2 text-ink-faint hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <AddButton onClick={() => set({ program: [...formData.program, { id: Date.now(), time: "", event: "" }] })}>
                  Tilføj punkt
                </AddButton>
              </AdminGroup>

              <AdminGroup title="Ønskeliste">
                {formData.wishlist.map((item, index) => (
                  <div key={item.id} className="flex gap-2 items-center bg-white p-2 rounded-xl border border-line">
                    <input className="flex-1 border border-line rounded-lg p-2 text-sm outline-none focus:border-gold" placeholder="Ønske"
                      value={item.item}
                      onChange={(e) => {
                        const w = [...formData.wishlist]; w[index] = { ...w[index], item: e.target.value }; set({ wishlist: w });
                      }} />
                    <input className="flex-1 border border-line rounded-lg p-2 text-sm outline-none focus:border-gold" placeholder="Link (valgfrit)"
                      value={item.link}
                      onChange={(e) => {
                        const w = [...formData.wishlist]; w[index] = { ...w[index], link: e.target.value }; set({ wishlist: w });
                      }} />
                    <button onClick={() => set({ wishlist: formData.wishlist.filter((_, i) => i !== index) })}
                      className="p-2 text-ink-faint hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <AddButton onClick={() => set({ wishlist: [...formData.wishlist, { id: Date.now(), item: "", link: "" }] })}>
                  Tilføj ønske
                </AddButton>
              </AdminGroup>

              <AdminGroup title="Praktisk / FAQ">
                {(formData.faq || []).map((item, index) => (
                  <div key={item.id} className="bg-white p-3 rounded-xl border border-line space-y-2">
                    <div className="flex gap-2 items-start">
                      <input className="flex-1 border border-line rounded-lg p-2 text-sm outline-none focus:border-gold font-medium" placeholder="Spørgsmål"
                        value={item.q}
                        onChange={(e) => {
                          const f = [...formData.faq]; f[index] = { ...f[index], q: e.target.value }; set({ faq: f });
                        }} />
                      <button onClick={() => set({ faq: formData.faq.filter((_, i) => i !== index) })}
                        className="p-2 text-ink-faint hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <textarea rows={2} className="w-full border border-line rounded-lg p-2 text-sm outline-none focus:border-gold resize-none" placeholder="Svar"
                      value={item.a}
                      onChange={(e) => {
                        const f = [...formData.faq]; f[index] = { ...f[index], a: e.target.value }; set({ faq: f });
                      }} />
                  </div>
                ))}
                <AddButton onClick={() => set({ faq: [...(formData.faq || []), { id: Date.now(), q: "", a: "" }] })}>
                  Tilføj spørgsmål
                </AddButton>
              </AdminGroup>
            </div>
          )}

          {activeTab === 'rsvps' && (
            <div className="space-y-6">
              <h1 className="text-3xl font-serif text-ink border-b border-line pb-5">S.U. besvarelser</h1>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard tone="sage" label="Gæster i alt" value={attendingPeople} />
                <StatCard tone="blush" label="Afbud" value={notCount} />
                <StatCard tone="ink" label="Besvarelser" value={rsvps.length} />
              </div>

              <div className="bg-white border border-line rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm min-w-[640px]">
                    <thead className="bg-ivory-200/60 border-b border-line">
                      <tr>
                        {['Svar fra', 'Status', 'Antal', 'Deltagere & allergi', 'Hilsen'].map((h) => (
                          <th key={h} className="p-4 font-medium text-ink-soft">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {rsvps.length === 0 ? (
                        <tr><td colSpan="5" className="p-10 text-center text-ink-faint font-light">Ingen besvarelser endnu.</td></tr>
                      ) : rsvps.map((rsvp) => {
                        const guests = guestsOf(rsvp);
                        const going = rsvp.attending === 'yes';
                        return (
                          <tr key={rsvp.id} className="hover:bg-ivory-200/40 transition-colors align-top">
                            <td className="p-4 font-medium text-ink">{rsvp.name}</td>
                            <td className="p-4">
                              {going
                                ? <span className="bg-sage/15 text-sage px-2.5 py-1 rounded-full text-xs font-medium">Deltager</span>
                                : <span className="bg-red-100 text-red-600 px-2.5 py-1 rounded-full text-xs font-medium">Afbud</span>}
                            </td>
                            <td className="p-4 text-ink-soft">{going ? countOf(rsvp) : '—'}</td>
                            <td className="p-4 text-ink-soft">
                              {going && guests.length ? (
                                <ul className="space-y-1">
                                  {guests.map((g, i) => (
                                    <li key={i}>
                                      {g.name || '—'}
                                      {g.diet && <span className="text-ink-faint"> · {g.diet}</span>}
                                    </li>
                                  ))}
                                </ul>
                              ) : '—'}
                            </td>
                            <td className="p-4 text-ink-soft max-w-xs truncate" title={rsvp.message}>{rsvp.message || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- ADMIN SUB-COMPONENTS ---
const TabButton = ({ active, onClick, icon: Icon, badge, children }) => (
  <button
    onClick={onClick}
    className={`btn-press w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left ${
      active ? 'bg-ink text-white' : 'hover:bg-ivory-200 text-ink-soft'
    }`}
  >
    {Icon && <Icon size={18} />} {children}
    {badge !== undefined && (
      <span className={`ml-auto text-xs py-0.5 px-2 rounded-full ${active ? 'bg-white/20' : 'bg-ink text-white'}`}>
        {badge}
      </span>
    )}
  </button>
);

const AdminGroup = ({ title, children }) => (
  <div className="space-y-4">
    <h3 className="font-serif text-xl text-ink border-t border-line pt-6 first:border-t-0 first:pt-0">{title}</h3>
    {children}
  </div>
);

const AInput = ({ label, value, onChange, type = 'text' }) => (
  <div>
    <label className="block text-xs text-ink-faint uppercase tracking-wider mb-1.5">{label}</label>
    <input
      type={type}
      className="w-full bg-white border border-line rounded-lg p-2.5 outline-none focus:border-gold transition-colors"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

const AArea = ({ label, value, onChange }) => (
  <div>
    <label className="block text-xs text-ink-faint uppercase tracking-wider mb-1.5">{label}</label>
    <textarea
      rows={3}
      className="w-full bg-white border border-line rounded-lg p-2.5 outline-none focus:border-gold transition-colors resize-none"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

const AddButton = ({ onClick, children }) => (
  <button onClick={onClick} className="text-sm font-medium text-gold-deep flex items-center gap-1.5 hover:text-gold transition-colors">
    <Plus size={16} /> {children}
  </button>
);

const StatCard = ({ tone, label, value }) => {
  const tones = {
    sage: 'bg-sage/12 text-sage',
    blush: 'bg-blush/40 text-ink',
    ink: 'bg-ink text-ivory-100',
  };
  return (
    <div className={`${tones[tone]} p-5 rounded-2xl`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-4xl font-serif mt-1">{value}</p>
    </div>
  );
};

// datetime-local expects "YYYY-MM-DDTHH:mm"
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return typeof iso === 'string' ? iso.slice(0, 16) : '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
