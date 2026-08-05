import React, { useEffect, useState, useRef } from 'react';

// Intro-overlay der spiller én gang, når siden åbnes:
// en håndtegnet alpe-linjetegning (nik til Val Thorens) tegner sig selv,
// mens navne, undertekst og dato toner frem — hvorefter overlayet opløses
// og afslører siden. Respekterer prefers-reduced-motion.
export default function IntroOverlay({ names, subtitle, date, onDone }) {
  const [leaving, setLeaving] = useState(false);
  const rootRef = useRef(null);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone?.();
  };

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const holdMs = reduce ? 1100 : 3600;
    const t = setTimeout(() => setLeaving(true), holdMs);
    // Sikkerhedsnet: hvis transitionend ikke fyrer, luk alligevel.
    const guard = setTimeout(finish, holdMs + 1400);
    return () => { clearTimeout(t); clearTimeout(guard); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTransitionEnd = (e) => {
    if (e.target === rootRef.current && e.propertyName === 'opacity' && leaving) finish();
  };

  return (
    <div
      ref={rootRef}
      className={`intro-overlay ${leaving ? 'intro-leaving' : ''}`}
      onTransitionEnd={onTransitionEnd}
      role="dialog"
      aria-label="Velkommen"
    >
      <button type="button" className="intro-skip" onClick={() => setLeaving(true)}>
        Spring over
      </button>

      <div className="intro-inner">
        <MountainArt />

        <div className="intro-text">
          <p className="intro-kicker">Val Thorens · hvor det hele begyndte</p>
          <h1 className="intro-names">{names}</h1>
          <div className="intro-date">
            <span className="intro-line" />
            {date}
            <span className="intro-line" />
          </div>
          {subtitle && <p className="intro-sub">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

// Håndtegnet, selv-tegnende alpe-skyline. pathLength="1" normaliserer alle
// stier, så stroke-dashoffset-animationen kan tegne dem ensartet.
function MountainArt() {
  return (
    <svg className="intro-mtn" viewBox="0 0 1600 520" fill="none" aria-hidden="true">
      {/* fjern sol/måne højt oppe */}
      <circle className="draw d0" cx="1300" cy="90" r="34" pathLength="1" />

      {/* fjerne bagerste tinder */}
      <path className="draw d1" pathLength="1"
        d="M0 300 L150 262 L250 286 L340 232 L430 270 L520 214 L610 260 L700 226 L800 262" />
      <path className="draw d1" pathLength="1"
        d="M840 258 L940 214 L1040 258 L1150 224 L1260 266 L1380 232 L1480 270 L1600 244" />

      {/* hovedmassiv med top */}
      <path className="draw d2" pathLength="1"
        d="M-20 452 L170 410 L330 356 L500 286 L650 200 L788 132 L900 196 L1050 292 L1210 360 L1380 402 L1620 452" />

      {/* top-nik: lille station + kors (som i skitsen) */}
      <path className="draw d3" pathLength="1" d="M770 132 L770 108 L816 108 L816 132" />
      <path className="draw d3" pathLength="1" d="M792 108 L792 84" />
      <path className="draw d3" pathLength="1" d="M781 96 L803 96" />

      {/* mellemrygge / snelinjer på massivet */}
      <path className="draw d3" pathLength="1" d="M540 300 L640 250 L720 268 L800 220" />
      <path className="draw d3" pathLength="1" d="M900 210 L980 262 L1080 300 L1150 330" />
      <path className="draw d3" pathLength="1" d="M470 330 L560 360 L650 356" />

      {/* forreste ryg */}
      <path className="draw d4" pathLength="1"
        d="M-20 512 L210 470 L420 496 L640 452 L860 488 L1080 456 L1300 492 L1620 470" />

      {/* forgrund: bløde skygge/kontur-strøg */}
      <path className="draw d4" pathLength="1" d="M120 486 L200 508" />
      <path className="draw d4" pathLength="1" d="M520 470 L600 500" />
      <path className="draw d4" pathLength="1" d="M980 470 L1060 500" />
      <path className="draw d4" pathLength="1" d="M1360 484 L1440 508" />
    </svg>
  );
}
