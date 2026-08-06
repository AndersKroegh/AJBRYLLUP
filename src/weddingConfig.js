// Delt konfiguration + standarddata for bryllupssiden.
// Bruges både af appen (src/App.jsx) og seed-scriptet (scripts/seed.mjs),
// så de aldrig kommer ud af sync.

export const firebaseConfig = {
  apiKey: "AIzaSyC-baRY8ADfQ_oS0U51D80Bql_GKw8b8OU",
  authDomain: "bryllups-website.firebaseapp.com",
  projectId: "bryllups-website",
  storageBucket: "bryllups-website.firebasestorage.app",
  messagingSenderId: "614384539759",
  appId: "1:614384539759:web:2160ecc6dfb1b0711e559a"
};

// Unikt ID til databasen (sti: artifacts/{appId}/public/data/...)
export const appId = 'bryllups-website-app';

// Standarddata hvis databasen er tom (nye felter merges også ind over gammel data)
export const DEFAULT_DATA = {
  names: "Anders & Julie",
  date: "10. juli 2027",
  eventDate: "2027-07-10T13:00:00", // Bruges til nedtælling (ISO) — ret tidspunktet i admin
  rsvpDate: "1. maj 2027",
  heroImage: "https://images.unsplash.com/photo-1519741497674-611481863552?ixlib=rb-1.2.1&auto=format&fit=crop&w=2400&q=80",
  intro: "Vi har ventet på denne dag, og nu er den her. Kom og fejr vores bryllup sammen med os — midt i den smukke natur ved Ejstrupholm.",
  timeAndPlace: "Vi skal giftes på Sans & Samling, en unik eventlokation omgivet af skov og hede ved Ejstrupholm. Både vielse, reception og festen om aftenen holdes samme sted, så I bare kan slappe af og nyde dagen.",
  accommodation: "Sans & Samling tilbyder overnatning på selve stedet, så I kan blive og feste med os hele aftenen. Giv os gerne besked, hvis I ønsker at overnatte, så hjælper vi med det praktiske.",
  ceremonyName: "Sans & Samling",
  ceremonyAddress: "Ikastvej 7, 7361 Ejstrupholm",
  venueName: "Sans & Samling",
  venueAddress: "Ikastvej 7, 7361 Ejstrupholm",
  program: [
    { id: 1, time: "13:00", event: "Vielse" },
    { id: 2, time: "15:00", event: "Reception & Bryllupskage" },
    { id: 3, time: "18:00", event: "Middag & Fest" },
    { id: 4, time: "23:30", event: "Brudevals" }
  ],
  wishlist: [
    { id: 1, item: "Oplevelser & rejsegavekort", link: "" },
    { id: 2, item: "Bidrag til bryllupsrejsen", link: "" },
    { id: 3, item: "Gavekort til hjemmet", link: "" }
  ],
  faq: [
    { id: 1, q: "Hvad er dresscode?", a: "Vi ønsker os en festlig og elegant dag — tænk gerne jakkesæt og kjole. Undgå venligst helt hvidt af hensyn til bruden." },
    { id: 2, q: "Hvordan kommer jeg til Sans & Samling?", a: "Adressen er Ikastvej 7, 7361 Ejstrupholm. Der er gode parkeringsmuligheder på stedet — og overvej gerne at køre sammen med andre gæster." },
    { id: 3, q: "Er børn med til festen?", a: "Vi holder festen som en voksenfest. Sig endelig til, hvis I har brug for hjælp til at finde børnepasning i nærheden." },
    { id: 4, q: "Hvad med gaver?", a: "Jeres nærvær er den største gave. Har I alligevel lyst til at give noget, finder I et par idéer under Ønskeliste." },
    { id: 5, q: "Kan man overnatte?", a: "Ja — Sans & Samling har overnatning på selve stedet. Giv os besked, hvis I ønsker at blive natten over, så hjælper vi med det praktiske." }
  ]
};
