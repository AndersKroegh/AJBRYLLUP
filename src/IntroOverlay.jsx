import React, { useEffect, useRef, useState } from 'react';
import waxSeal from './assets/wax-seal.png';

// Åbnings-overlay: gæsten mødes af en lukket kuvert med vores vokssegl.
// Et tryk bryder seglet, flappen folder op, invitationskortet glider op,
// og overlayet opløses og afslører siden. Respekterer prefers-reduced-motion.

// Kuvertens koordinatsystem (SVG viewBox). Proportion 3:2.
const W = 300;
const H = 200;
const TIP = 124; // hvor langt flappens spids når ned

// Bølget ("scalloped") kant fra punkt a til b, bygget af n buer der buer udad.
function scallops([x1, y1], [x2, y2], n) {
  const len = Math.hypot(x2 - x1, y2 - y1) / n;
  const r = (len * 0.7).toFixed(2);
  let d = '';
  for (let i = 1; i <= n; i++) {
    const x = (x1 + ((x2 - x1) * i) / n).toFixed(2);
    const y = (y1 + ((y2 - y1) * i) / n).toFixed(2);
    d += ` A${r} ${r} 0 0 0 ${x} ${y}`;
  }
  return d;
}

const FLAP_PATH =
  `M0 0${scallops([0, 0], [134, TIP - 10], 3)}` +
  ` Q150 ${TIP + 8} 166 ${TIP - 10}` +
  `${scallops([166, TIP - 10], [W, 0], 3)} Z`;

// Forlommen dækker alt undtagen V'et øverst, så kortet ser ud til at ligge i kuverten.
const POCKET_PATH = `M0 0 L150 ${TIP - 6} L${W} 0 V${H} H0 Z`;

// Tidslinje (ms efter tryk)
const STEPS = [
  { stage: 1, at: 0 },     // seglet brydes
  { stage: 2, at: 260 },   // flappen folder op
  { stage: 3, at: 640 },   // flappen lægger sig bag kortet
  { stage: 4, at: 1000 },  // kortet glider op
  { stage: 5, at: 2700 },  // overlayet toner ud
];
const DONE_AT = 3600;

export default function IntroOverlay({ names, date, onDone }) {
  const [stage, setStage] = useState(0);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const open = () => {
    if (stage > 0) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const steps = reduce ? [{ stage: 5, at: 0 }] : STEPS;
    timers.current = steps.map((s) => setTimeout(() => setStage(s.stage), s.at));
    timers.current.push(setTimeout(() => onDone?.(), reduce ? 700 : DONE_AT));
  };

  const [first, second] = names.split('&').map((s) => s.trim());
  const cls = [
    'env-overlay',
    stage >= 1 && 'is-cracked',
    stage >= 2 && 'is-open',
    stage >= 3 && 'is-flipped',
    stage >= 4 && 'is-risen',
    stage >= 5 && 'is-leaving',
  ].filter(Boolean).join(' ');

  return (
    <div className={cls} role="dialog" aria-modal="true" aria-label="Invitation">
      <div className="env-scene">
        <header className="env-head">
          <p className="env-kicker">Et kærlighedsbrev fra</p>
          <h1 className="env-names">
            {first}
            {second && <><span className="env-amp"> &amp; </span>{second}</>}
          </h1>
        </header>

        <div className="env-float">
          <button
            type="button"
            className="env"
            onClick={open}
            aria-label="Åbn invitationen"
            disabled={stage > 0}
          >
            {/* Kuvertens inderside (ses når flappen er åben) */}
            <svg className="env-layer env-back" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
              <defs>
                <linearGradient id="env-inside" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="var(--env-inside-dark)" />
                  <stop offset="0.7" stopColor="var(--env-inside)" />
                </linearGradient>
                <filter id="env-grain" x="0" y="0" width="100%" height="100%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7" result="n" />
                  <feColorMatrix in="n" type="matrix"
                    values="0 0 0 0 0.42  0 0 0 0 0.34  0 0 0 0 0.27  0 0 0 0.07 0" result="g" />
                  <feComposite in="g" in2="SourceGraphic" operator="in" result="gi" />
                  <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="gi" /></feMerge>
                </filter>
              </defs>
              <rect width={W} height={H} rx="3" fill="url(#env-inside)" />
            </svg>

            {/* Invitationskortet */}
            <div className="env-letter" aria-hidden="true">
              <p className="letter-kicker">Vi skal giftes</p>
              <p className="letter-names">{names}</p>
              <span className="letter-rule" />
              <p className="letter-date">{date}</p>
            </div>

            {/* Forlomme med folder */}
            <svg className="env-layer env-pocket" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
              <path d={POCKET_PATH} className="paper" filter="url(#env-grain)" />
              <path d={`M0 ${H} L138 ${TIP - 14}`} className="fold" />
              <path d={`M${W} ${H} L162 ${TIP - 14}`} className="fold" />
            </svg>

            {/* Flappen: to sider i 3D, så indersiden ses, når den foldes op */}
            <div className="env-flap" aria-hidden="true">
              <svg className="flap-face flap-outer" viewBox={`0 0 ${W} ${TIP + 10}`}>
                <path d={FLAP_PATH} className="paper paper-flap" filter="url(#env-grain)" />
              </svg>
              <svg className="flap-face flap-inner" viewBox={`0 0 ${W} ${TIP + 10}`}>
                <path d={FLAP_PATH} className="paper-inner" />
              </svg>
            </div>

            {/* Voksseglet – deles i to, når kuverten åbnes */}
            <span className="env-seal" aria-hidden="true">
              <img src={waxSeal} alt="" className="seal-half seal-l" draggable="false" />
              <img src={waxSeal} alt="" className="seal-half seal-r" draggable="false" />
            </span>
          </button>
        </div>

        <p className="env-cta" aria-hidden="true">Åbn invitationen</p>
      </div>
    </div>
  );
}
