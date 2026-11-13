/* ==========================================================================
   ZÉLL-V NMN — "Power Up Your Body with NAD+"
   ALL editable copy, organ data and game settings live in this file.

   HOW TO EDIT
   - Change text between the quotes only. Keep the quotes, commas and keys.
   - Lines marked  // REVIEW  are health-related explanations that must be
     approved by the brand / regulatory team before the event.
   - "ms" (Bahasa Melayu) and "zh" (Simplified Chinese) are full draft
     translations. If you change an English line, update those two as well.
   - Any key missing from "ms" or "zh" automatically falls back to English.
   - After editing, reload the page twice (the offline cache updates in the
     background on the first reload).
   ========================================================================== */

/* -------------------------------------------------------------------------
   GAME SETTINGS
   ------------------------------------------------------------------------- */
export const CONFIG = {
  // The "correct answer" organs used for scoring on the Reveal screen.
  // The guest gets one NAD+ orb per organ in this list (4 here), so to change
  // the number of orbs just add or remove organs.
  // Allowed ids: skin, brain, eyes, lungs, heart, liver, stomach, kidneys, intestines, muscles
  topPicks: ['heart', 'brain', 'muscles', 'liver'],

  // Idle auto-reset (kiosk friendliness).
  idle: {
    enabled: true,
    timeoutSeconds: 60, // total seconds without interaction before the game resets
    warningSeconds: 5,  // the "Still there?" countdown shown at the end of that time
    kioskOnly: false,   // true = only auto-reset when the URL has ?kiosk=1
  },

  // Languages shown in the switcher, in order. Remove one to hide it.
  languages: ['en', 'ms', 'zh'],
  defaultLanguage: 'en',

  // Badge thresholds: the first rule whose "min" score is met wins.
  badges: [
    { min: 4, key: 'expert' },
    { min: 2, key: 'pro' },
    { min: 0, key: 'explorer' },
  ],

  // Hidden admin screen: tap the logo this many times quickly.
  adminTapCount: 5,

  // Game 2: AstaReal® Astaxanthin shield game
  shield: {
    durationSeconds: 50, // survive this long to win
    lives: 3,            // hearts
    // Difficulty ramps from "start" to "end" over the game.
    startSpawnSeconds: 1.15, // seconds between free radicals at the start
    endSpawnSeconds: 0.5,    // ...and at the end
    startSpeed: 0.24,        // fall speed, in screen-heights per second
    endSpeed: 0.44,
    shieldWidth: 0.27,       // shield width as a fraction of the play area
    // Badge: first rule that matches wins
    badges: [
      { survived: true, minLives: 3, key: 'guardian' },
      { survived: true, minLives: 1, key: 'defender' },
      { survived: false, minLives: 0, key: 'brave' },
    ],
  },
};

/* -------------------------------------------------------------------------
   ENGLISH (master copy)
   ------------------------------------------------------------------------- */
const en = {
  langName: 'English',
  langShort: 'EN', // label on the language switcher
  brand: 'ZÉLL-V NMN',

  start: {
    eyebrow: 'ZÉLL-V NMN presents',
    title: 'Power Up Your Body with NAD+',
    tab: 'NAD+ Body Game', // game tab on the start screen
    hook: 'Your cells run on NAD+. Where does your body need it most?',
    button: 'Start',
  },

  howto: {
    title: 'How to play',
    text: 'Drag each NAD+ orb onto the part of the body you think needs it most.',
    tapHint: 'Prefer tapping? Tap an orb, then tap a body part.',
    button: "Let's go",
  },

  play: {
    instruction: 'Drag the NAD+ orbs onto the body',
    instructionSelected: 'Now tap a body part to place your orb',
    remaining: (n) => (n === 1 ? '1 orb left' : `${n} orbs left`),
    allPlaced: 'All orbs placed!',
    undo: 'Undo',
    reveal: 'Reveal',
    orbLabel: (i) => `NAD+ orb ${i}. Tap to select, or drag onto the body.`,
    alreadyFilled: (organ) => `${organ} already has an orb — try another spot!`,
    placed: (organ) => `NAD+ placed on ${organ}`,
    returned: 'Orb returned to the tray',
  },

  reveal: {
    title: 'The Reveal',
    perfectTitle: (total) => `Perfect Match! ${total}/${total}`,
    perfectText: 'You found every one of our top picks. Impressive!',
    scoreTitle: (n, total) => `You matched ${n}/${total}`,
    // Shown when the guest did not get a perfect score. Keep it positive.
    positiveTwist: 'Every organ you chose is right — every cell in your body needs NAD+.',
    topLabel: (total) => `Our top ${total}`,
    yourPicksLabel: 'Your picks',
    wholeBody: 'In fact, your whole body runs on NAD+',
    button: 'Learn why',
  },

  learn: {
    title: 'Why NAD+ matters',
    swipeHint: 'Swipe to explore',
    howNmnLabel: 'How NMN fits in',
    topPickTag: 'Top pick',
    yourPickTag: 'Your pick',
    prev: 'Previous',
    next: 'Next',
    button: 'Finish',
    cardOf: (i, n) => `Card ${i} of ${n}`,
  },

  // Intro cards shown first on the Learn screen.
  intro: [
    {
      id: 'nad',
      title: 'What is NAD+?',
      text: 'NAD+ (nicotinamide adenine dinucleotide) is a coenzyme found in every living cell. It plays a central role in turning the food you eat into the energy your cells use.', // REVIEW
      extra: 'Research suggests that natural NAD+ levels tend to decline as we get older.', // REVIEW
    },
    {
      id: 'nmn',
      title: 'What is NMN?',
      text: 'NMN (nicotinamide mononucleotide) is a precursor — a building block your body uses to make NAD+. Small amounts are found in foods like broccoli, edamame and avocado.', // REVIEW
      extra: 'NMN supplements are one way to support your body’s own NAD+ production.', // REVIEW
    },
  ],

  // One entry per organ. "name" appears on the body and on cards.
  organs: {
    skin: {
      name: 'Skin',
      text: 'Your skin is constantly renewing itself, and that takes cellular energy. NAD+ plays a role in the energy and repair processes that help skin cells maintain themselves.', // REVIEW
      nmn: 'NMN is a building block your body uses to make NAD+, helping to support the NAD+ your skin cells rely on.', // REVIEW
    },
    brain: {
      name: 'Brain',
      text: 'Your brain is one of the most energy-hungry organs in your body. NAD+ plays a key role in the energy production that helps brain cells keep working.', // REVIEW
      nmn: 'NMN is a precursor your body converts into NAD+, supporting the energy supply your brain cells depend on.', // REVIEW
    },
    eyes: {
      name: 'Eyes',
      text: 'The light-sensing cells in your eyes are some of the busiest cells in the body. NAD+ plays a role in the energy production that helps them maintain normal function.', // REVIEW
      nmn: 'NMN is a building block for NAD+, helping to support the NAD+ that eye cells use every moment you see.', // REVIEW
    },
    lungs: {
      name: 'Lungs',
      text: 'Every breath brings in the oxygen your cells use to make energy — a process in which NAD+ plays a central role. NAD+ also supports the everyday upkeep of lung cells.', // REVIEW
      nmn: 'NMN is a precursor your body uses to make NAD+, helping to maintain the NAD+ your lung cells need.', // REVIEW
    },
    heart: {
      name: 'Heart',
      text: 'Your heart beats around 100,000 times a day, powered by muscle cells packed with mitochondria. NAD+ plays a key role in the mitochondrial energy production that supports them.', // REVIEW
      nmn: 'NMN is a building block your body uses to make NAD+, supporting the energy needs of your hard-working heart cells.', // REVIEW
    },
    liver: {
      name: 'Liver',
      text: 'Your liver handles hundreds of everyday tasks, from processing nutrients to breaking down substances. Many of these reactions rely on NAD+.', // REVIEW
      nmn: 'NMN is a precursor your body converts into NAD+, helping to support your liver’s busy metabolism.', // REVIEW
    },
    stomach: {
      name: 'Stomach',
      text: 'Digestion is hard work, and the cells lining your stomach renew often. NAD+ plays a role in the energy metabolism behind that renewal.', // REVIEW
      nmn: 'NMN is a building block for NAD+, helping to support the NAD+ your digestive cells use.', // REVIEW
    },
    kidneys: {
      name: 'Kidneys',
      text: 'Your kidneys filter your blood around the clock, which takes a lot of energy. NAD+ plays a role in the energy metabolism that helps kidney cells maintain normal function.', // REVIEW
      nmn: 'NMN is a precursor your body uses to make NAD+, supporting the energy your kidneys need for their non-stop work.', // REVIEW
    },
    intestines: {
      name: 'Intestines',
      text: 'Your gut lining renews itself every few days. NAD+ plays a role in the energy metabolism that supports this constant renewal.', // REVIEW
      nmn: 'NMN is a building block for NAD+, helping to support the NAD+ your gut cells rely on.', // REVIEW
    },
    muscles: {
      name: 'Muscles',
      text: 'Every move you make uses energy produced in your muscle mitochondria. NAD+ plays a central role in that energy production and supports normal muscle function.', // REVIEW
      nmn: 'NMN is a precursor your body converts into NAD+, helping to support the energy your muscles use.', // REVIEW
    },
  },

  // ---------- Game 2: AstaReal® Astaxanthin shield ----------
  shield: {
    tab: 'Astaxanthin Shield',
    eyebrow: 'Featuring AstaReal® Astaxanthin',
    title: 'Shield Your Cells',
    hook: (s) => `Free radicals are on the attack. Can you hold the shield for ${s} seconds?`,
    howtoTitle: 'How to defend',
    howtoText: (s, lives) => `Drag left and right to move your shield. Block the free radicals before they reach your cells — you have ${lives} hearts. Survive ${s} seconds!`,
    howtoButton: 'Ready!',
    blocked: (n) => `${n} blocked`,
    seconds: (s) => `${s}s`,
    ready: 'Ready…',
    go: 'Go!',
    cellsLabel: 'Your cells',
    shieldLabel: 'AstaReal® Astaxanthin',
    hit: 'Ouch! A free radical got through.',
    hearts: (n) => (n === 1 ? '1 heart left' : `${n} hearts left`),
    winTitle: 'You survived!',
    winText: (n, s) => `You held off ${n} free radical${n === 1 ? '' : 's'} for the full ${s} seconds.`,
    loseTitle: 'Great defence!',
    loseText: (n, s) => `You blocked ${n} free radical${n === 1 ? '' : 's'} in ${s} seconds.`,
    resultButton: 'What did that mean?',
    learnTitle: 'Your shield was AstaReal® Astaxanthin',
    // Explanation cards shown after the game (swipe). icon: meaning | radical | asta | membrane | together
    cards: [
      {
        icon: 'meaning',
        title: 'What the game means',
        text: 'The free radicals represent unstable molecules that form in your body every day. The shield you moved represents AstaReal® Astaxanthin — an antioxidant that helps protect your cells from free radical damage.', // REVIEW
      },
      {
        icon: 'radical',
        title: 'What are free radicals?',
        text: 'Free radicals (oxidants) are unstable molecules made naturally when your body turns food and oxygen into energy. UV light, pollution, smoking and stress can add to them.', // REVIEW
        extra: 'When free radicals outnumber the body’s antioxidant defences, the result is oxidative stress, which can damage cells over time.', // REVIEW
      },
      {
        icon: 'asta',
        title: 'What is AstaReal® Astaxanthin?',
        text: 'Astaxanthin is a natural red carotenoid pigment — it gives salmon and flamingos their colour. AstaReal® astaxanthin is produced from the microalgae Haematococcus pluvialis.', // REVIEW
        extra: 'As an antioxidant, astaxanthin helps neutralise free radicals and helps protect cells against oxidative stress.', // REVIEW
      },
      {
        icon: 'membrane',
        title: 'A shield across the cell',
        text: 'Astaxanthin’s long molecular structure can span the cell membrane, so it helps protect both the inner and outer layers of the cell — just like your shield guarded your cells.', // REVIEW
      },
      {
        icon: 'together',
        title: 'NMN + Astaxanthin',
        text: 'NMN supports your cells’ NAD+ energy production, while astaxanthin helps protect cells from oxidative stress — energy and protection, side by side.', // REVIEW
      },
    ],
    badges: {
      guardian: { title: 'Antioxidant Guardian', text: 'Flawless! Not a single free radical got through.' },
      defender: { title: 'Cell Defender', text: 'You protected your cells right to the end.' },
      brave: { title: 'Brave Defender', text: 'Every block counts — antioxidants work the same way.' },
    },
    scoreLine: (n, lives) => `Blocked: ${n} · Hearts left: ${lives}`,
  },

  badges: {
    expert: { title: 'NAD+ Expert', text: 'You know exactly where NAD+ matters most.' },
    pro: { title: 'NAD+ Pro', text: 'Great instincts — you’re powered up!' },
    explorer: { title: 'NAD+ Explorer', text: 'Now you know: every cell needs NAD+.' },
  },

  end: {
    title: 'You’re powered up!',
    scoreLine: (n, total) => `Score: ${n}/${total}`,
    ctaTitle: 'Claim your gift',
    ctaText: 'Show this screen at the ZÉLL-V counter to claim your gift.',
    playedAt: 'Played',
    button: 'Play again',
  },

  // Footer disclaimer shown on the Learn and End screens. // REVIEW
  disclaimer: 'This game is for general education only and is not medical advice. ZÉLL-V NMN is a dietary supplement and is not intended to diagnose, treat, cure or prevent any disease. [Placeholder — final wording to be approved by the regulatory team.]', // REVIEW

  idle: {
    title: 'Still there?',
    text: (s) => `Restarting in ${s}…`,
    button: 'I’m still playing',
  },

  admin: {
    title: 'Booth stats',
    plays: 'Total plays',
    perfect: 'Perfect matches',
    rate: 'Perfect rate',
    popular: 'Most picked',
    reset: 'Reset stats',
    confirmReset: 'Reset all stats on this device?',
    close: 'Close',
    storageOff: 'Storage is unavailable in this browser — stats will not be saved.',
    shieldPlays: 'Shield plays',
    shieldWins: 'Shield survived',
  },

  a11y: {
    body: 'Human body. Choose a body part to place a NAD+ orb.',
    language: 'Language',
    games: 'Choose a game',
    fullscreen: 'Full screen',
    exitFullscreen: 'Exit full screen',
    fullscreenHint: 'For full screen on iPhone: tap Share, then “Add to Home Screen”, and open the game from its icon.',
    selected: 'Selected',
    filled: 'has a NAD+ orb',
  },
};

/* -------------------------------------------------------------------------
   BAHASA MELAYU
   Draft translation — have a native speaker and the regulatory team check
   it before the event (health lines are marked // REVIEW).
   Any key you delete here falls back to English automatically.
   ------------------------------------------------------------------------- */
const ms = {
  langName: 'Bahasa Melayu',
  langShort: 'BM',
  brand: 'ZÉLL-V NMN',

  start: {
    eyebrow: 'ZÉLL-V NMN mempersembahkan',
    title: 'Tenagakan Tubuh Anda dengan NAD+',
    tab: 'Permainan NAD+',
    hook: 'Sel anda bergantung pada NAD+. Di manakah tubuh anda paling memerlukannya?',
    button: 'Mula',
  },

  howto: {
    title: 'Cara bermain',
    text: 'Seret setiap bola NAD+ ke bahagian tubuh yang anda rasa paling memerlukannya.',
    tapHint: 'Lebih suka ketik? Ketik bola, kemudian ketik bahagian tubuh.',
    button: 'Jom mula',
  },

  play: {
    instruction: 'Seret bola NAD+ ke tubuh',
    instructionSelected: 'Kini ketik bahagian tubuh untuk meletakkan bola anda',
    remaining: (n) => `${n} bola lagi`,
    allPlaced: 'Semua bola telah diletakkan!',
    undo: 'Buat asal',
    reveal: 'Lihat jawapan',
    orbLabel: (i) => `Bola NAD+ ${i}. Ketik untuk pilih, atau seret ke tubuh.`,
    alreadyFilled: (organ) => `${organ} sudah ada bola — cuba tempat lain!`,
    placed: (organ) => `NAD+ diletakkan pada ${organ}`,
    returned: 'Bola dikembalikan ke dulang',
  },

  reveal: {
    title: 'Jawapannya',
    perfectTitle: (total) => `Padanan Sempurna! ${total}/${total}`,
    perfectText: 'Anda menemui semua pilihan utama kami. Hebat!',
    scoreTitle: (n, total) => `Anda memadankan ${n}/${total}`,
    positiveTwist: 'Setiap organ yang anda pilih adalah betul — setiap sel dalam tubuh anda memerlukan NAD+.',
    topLabel: (total) => `${total} pilihan utama kami`,
    yourPicksLabel: 'Pilihan anda',
    wholeBody: 'Malah, seluruh tubuh anda bergantung pada NAD+',
    button: 'Ketahui sebabnya',
  },

  learn: {
    title: 'Mengapa NAD+ penting',
    swipeHint: 'Leret untuk meneroka',
    howNmnLabel: 'Peranan NMN',
    topPickTag: 'Pilihan utama',
    yourPickTag: 'Pilihan anda',
    prev: 'Sebelumnya',
    next: 'Seterusnya',
    button: 'Selesai',
    cardOf: (i, n) => `Kad ${i} daripada ${n}`,
  },

  intro: [
    {
      id: 'nad',
      title: 'Apakah NAD+?',
      text: 'NAD+ (nikotinamida adenina dinukleotida) ialah koenzim yang terdapat dalam setiap sel hidup. Ia memainkan peranan utama dalam menukar makanan yang anda makan kepada tenaga yang digunakan oleh sel anda.', // REVIEW
      extra: 'Kajian menunjukkan bahawa paras NAD+ semula jadi cenderung menurun apabila kita meningkat usia.', // REVIEW
    },
    {
      id: 'nmn',
      title: 'Apakah NMN?',
      text: 'NMN (nikotinamida mononukleotida) ialah prekursor — bahan binaan yang digunakan oleh tubuh anda untuk menghasilkan NAD+. Sejumlah kecil NMN terdapat dalam makanan seperti brokoli, edamame dan avokado.', // REVIEW
      extra: 'Suplemen NMN ialah salah satu cara untuk menyokong penghasilan NAD+ semula jadi tubuh anda.', // REVIEW
    },
  ],

  organs: {
    skin: {
      name: 'Kulit',
      text: 'Kulit anda sentiasa memperbaharui dirinya, dan proses ini memerlukan tenaga sel. NAD+ memainkan peranan dalam proses tenaga dan pembaikan yang membantu sel kulit mengekalkan dirinya.', // REVIEW
      nmn: 'NMN ialah bahan binaan yang digunakan oleh tubuh untuk menghasilkan NAD+, membantu menyokong NAD+ yang diperlukan oleh sel kulit anda.', // REVIEW
    },
    brain: {
      name: 'Otak',
      text: 'Otak ialah antara organ yang paling banyak menggunakan tenaga dalam tubuh anda. NAD+ memainkan peranan penting dalam penghasilan tenaga yang membantu sel otak terus berfungsi.', // REVIEW
      nmn: 'NMN ialah prekursor yang ditukar oleh tubuh kepada NAD+, menyokong bekalan tenaga yang diperlukan oleh sel otak anda.', // REVIEW
    },
    eyes: {
      name: 'Mata',
      text: 'Sel pengesan cahaya dalam mata anda adalah antara sel yang paling sibuk dalam tubuh. NAD+ memainkan peranan dalam penghasilan tenaga yang membantu sel-sel ini mengekalkan fungsi normal.', // REVIEW
      nmn: 'NMN ialah bahan binaan bagi NAD+, membantu menyokong NAD+ yang digunakan oleh sel mata setiap kali anda melihat.', // REVIEW
    },
    lungs: {
      name: 'Paru-paru',
      text: 'Setiap nafas membawa masuk oksigen yang digunakan oleh sel untuk menghasilkan tenaga — satu proses di mana NAD+ memainkan peranan utama. NAD+ juga menyokong penjagaan harian sel paru-paru.', // REVIEW
      nmn: 'NMN ialah prekursor yang digunakan oleh tubuh untuk menghasilkan NAD+, membantu mengekalkan NAD+ yang diperlukan oleh sel paru-paru anda.', // REVIEW
    },
    heart: {
      name: 'Jantung',
      text: 'Jantung anda berdegup kira-kira 100,000 kali sehari, digerakkan oleh sel otot yang dipenuhi mitokondria. NAD+ memainkan peranan penting dalam penghasilan tenaga mitokondria yang menyokong sel-sel ini.', // REVIEW
      nmn: 'NMN ialah bahan binaan yang digunakan oleh tubuh untuk menghasilkan NAD+, menyokong keperluan tenaga sel jantung anda yang bekerja keras.', // REVIEW
    },
    liver: {
      name: 'Hati',
      text: 'Hati anda mengendalikan ratusan tugas harian, daripada memproses nutrien hingga menguraikan pelbagai bahan. Banyak tindak balas ini bergantung pada NAD+.', // REVIEW
      nmn: 'NMN ialah prekursor yang ditukar oleh tubuh kepada NAD+, membantu menyokong metabolisme hati anda yang sibuk.', // REVIEW
    },
    stomach: {
      name: 'Perut',
      text: 'Pencernaan ialah kerja keras, dan sel yang melapisi perut anda kerap diperbaharui. NAD+ memainkan peranan dalam metabolisme tenaga di sebalik pembaharuan ini.', // REVIEW
      nmn: 'NMN ialah bahan binaan bagi NAD+, membantu menyokong NAD+ yang digunakan oleh sel pencernaan anda.', // REVIEW
    },
    kidneys: {
      name: 'Buah pinggang',
      text: 'Buah pinggang anda menapis darah sepanjang masa, dan ini memerlukan banyak tenaga. NAD+ memainkan peranan dalam metabolisme tenaga yang membantu sel buah pinggang mengekalkan fungsi normal.', // REVIEW
      nmn: 'NMN ialah prekursor yang digunakan oleh tubuh untuk menghasilkan NAD+, menyokong tenaga yang diperlukan oleh buah pinggang untuk bekerja tanpa henti.', // REVIEW
    },
    intestines: {
      name: 'Usus',
      text: 'Lapisan usus anda memperbaharui dirinya setiap beberapa hari. NAD+ memainkan peranan dalam metabolisme tenaga yang menyokong pembaharuan berterusan ini.', // REVIEW
      nmn: 'NMN ialah bahan binaan bagi NAD+, membantu menyokong NAD+ yang diperlukan oleh sel usus anda.', // REVIEW
    },
    muscles: {
      name: 'Otot',
      text: 'Setiap pergerakan anda menggunakan tenaga yang dihasilkan dalam mitokondria otot. NAD+ memainkan peranan utama dalam penghasilan tenaga ini dan menyokong fungsi otot yang normal.', // REVIEW
      nmn: 'NMN ialah prekursor yang ditukar oleh tubuh kepada NAD+, membantu menyokong tenaga yang digunakan oleh otot anda.', // REVIEW
    },
  },

  shield: {
    tab: 'Perisai Astaxanthin',
    eyebrow: 'Menampilkan AstaReal® Astaxanthin',
    title: 'Lindungi Sel Anda',
    hook: (s) => `Radikal bebas sedang menyerang. Bolehkah anda mempertahankan perisai selama ${s} saat?`,
    howtoTitle: 'Cara bertahan',
    howtoText: (s, lives) => `Seret ke kiri dan kanan untuk menggerakkan perisai. Halang radikal bebas sebelum ia sampai ke sel anda — anda ada ${lives} nyawa. Bertahan selama ${s} saat!`,
    howtoButton: 'Sedia!',
    blocked: (n) => `${n} dihalang`,
    seconds: (s) => `${s}s`,
    ready: 'Sedia…',
    go: 'Mula!',
    cellsLabel: 'Sel anda',
    shieldLabel: 'AstaReal® Astaxanthin',
    hit: 'Aduh! Radikal bebas berjaya menembusi.',
    hearts: (n) => `${n} nyawa lagi`,
    winTitle: 'Anda berjaya bertahan!',
    winText: (n, s) => `Anda menghalang ${n} radikal bebas selama ${s} saat penuh.`,
    loseTitle: 'Pertahanan yang hebat!',
    loseText: (n, s) => `Anda menghalang ${n} radikal bebas dalam ${s} saat.`,
    resultButton: 'Apakah maksudnya?',
    learnTitle: 'Perisai anda ialah AstaReal® Astaxanthin',
    cards: [
      {
        icon: 'meaning',
        title: 'Maksud permainan ini',
        text: 'Radikal bebas mewakili molekul tidak stabil yang terbentuk dalam tubuh setiap hari. Perisai yang anda gerakkan mewakili AstaReal® Astaxanthin — antioksidan yang membantu melindungi sel anda daripada kerosakan radikal bebas.', // REVIEW
      },
      {
        icon: 'radical',
        title: 'Apakah radikal bebas?',
        text: 'Radikal bebas (oksidan) ialah molekul tidak stabil yang terhasil secara semula jadi apabila tubuh menukar makanan dan oksigen kepada tenaga. Cahaya UV, pencemaran, merokok dan tekanan boleh menambahkannya.', // REVIEW
        extra: 'Apabila radikal bebas melebihi pertahanan antioksidan tubuh, ia membawa kepada tekanan oksidatif yang boleh merosakkan sel dari semasa ke semasa.', // REVIEW
      },
      {
        icon: 'asta',
        title: 'Apakah AstaReal® Astaxanthin?',
        text: 'Astaxanthin ialah pigmen karotenoid merah semula jadi — ia memberikan warna kepada ikan salmon dan burung flamingo. AstaReal® astaxanthin dihasilkan daripada mikroalga Haematococcus pluvialis.', // REVIEW
        extra: 'Sebagai antioksidan, astaxanthin membantu meneutralkan radikal bebas dan membantu melindungi sel daripada tekanan oksidatif.', // REVIEW
      },
      {
        icon: 'membrane',
        title: 'Perisai merentasi sel',
        text: 'Struktur molekul astaxanthin yang panjang boleh merentasi membran sel, jadi ia membantu melindungi lapisan dalam dan luar sel — sama seperti perisai anda melindungi sel anda.', // REVIEW
      },
      {
        icon: 'together',
        title: 'NMN + Astaxanthin',
        text: 'NMN menyokong penghasilan tenaga NAD+ dalam sel anda, manakala astaxanthin membantu melindungi sel daripada tekanan oksidatif — tenaga dan perlindungan, seiring.', // REVIEW
      },
    ],
    badges: {
      guardian: { title: 'Penjaga Antioksidan', text: 'Sempurna! Tiada satu pun radikal bebas yang menembusi.' },
      defender: { title: 'Pelindung Sel', text: 'Anda melindungi sel anda sehingga ke akhirnya.' },
      brave: { title: 'Pembela Berani', text: 'Setiap halangan penting — antioksidan juga berfungsi begitu.' },
    },
    scoreLine: (n, lives) => `Dihalang: ${n} · Nyawa berbaki: ${lives}`,
  },

  badges: {
    expert: { title: 'Pakar NAD+', text: 'Anda tahu di mana NAD+ paling penting.' },
    pro: { title: 'NAD+ Pro', text: 'Naluri yang hebat — anda sudah bertenaga!' },
    explorer: { title: 'Penjelajah NAD+', text: 'Kini anda tahu: setiap sel memerlukan NAD+.' },
  },

  end: {
    title: 'Anda sudah bertenaga!',
    scoreLine: (n, total) => `Skor: ${n}/${total}`,
    ctaTitle: 'Tuntut hadiah anda',
    ctaText: 'Tunjukkan skrin ini di kaunter ZÉLL-V untuk menuntut hadiah anda.',
    playedAt: 'Dimainkan',
    button: 'Main lagi',
  },

  disclaimer: 'Permainan ini hanya untuk pendidikan umum dan bukan nasihat perubatan. ZÉLL-V NMN ialah suplemen makanan dan tidak bertujuan untuk mendiagnosis, merawat, menyembuhkan atau mencegah sebarang penyakit. [Teks sementara — kata-kata akhir perlu diluluskan oleh pasukan kawal selia.]', // REVIEW

  idle: {
    title: 'Masih di sana?',
    text: (s) => `Bermula semula dalam ${s}…`,
    button: 'Saya masih bermain',
  },

  admin: {
    title: 'Statistik gerai',
    plays: 'Jumlah permainan',
    perfect: 'Padanan sempurna',
    rate: 'Kadar sempurna',
    popular: 'Paling banyak dipilih',
    reset: 'Set semula statistik',
    confirmReset: 'Set semula semua statistik pada peranti ini?',
    close: 'Tutup',
    storageOff: 'Storan tidak tersedia dalam pelayar ini — statistik tidak akan disimpan.',
    shieldPlays: 'Permainan perisai',
    shieldWins: 'Berjaya bertahan',
  },

  a11y: {
    body: 'Tubuh manusia. Pilih bahagian tubuh untuk meletakkan bola NAD+.',
    language: 'Bahasa',
    games: 'Pilih permainan',
    fullscreen: 'Skrin penuh',
    exitFullscreen: 'Keluar skrin penuh',
    fullscreenHint: 'Untuk skrin penuh di iPhone: ketik Kongsi, kemudian “Tambah ke Skrin Utama”, dan buka permainan dari ikonnya.',
    selected: 'Dipilih',
    filled: 'mempunyai bola NAD+',
  },
};

/* -------------------------------------------------------------------------
   中文 (简体) — Simplified Chinese
   Draft translation — have a native speaker and the regulatory team check
   it before the event (health lines are marked // REVIEW).
   Any key you delete here falls back to English automatically.
   ------------------------------------------------------------------------- */
const zh = {
  langName: '中文',
  langShort: '中文',
  brand: 'ZÉLL-V NMN',

  start: {
    eyebrow: 'ZÉLL-V NMN 呈献',
    title: '用 NAD+ 为身体充能',
    tab: 'NAD+ 身体游戏',
    hook: '你的细胞依靠 NAD+ 运作。你的身体哪里最需要它？',
    button: '开始',
  },

  howto: {
    title: '玩法说明',
    text: '把每颗 NAD+ 能量球拖到你认为最需要它的身体部位。',
    tapHint: '不方便拖动？先点一下能量球，再点身体部位。',
    button: '开始吧',
  },

  play: {
    instruction: '把 NAD+ 能量球拖到身体上',
    instructionSelected: '现在点一下身体部位来放置能量球',
    remaining: (n) => `还剩 ${n} 颗`,
    allPlaced: '能量球已全部放好！',
    undo: '撤销',
    reveal: '揭晓答案',
    orbLabel: (i) => `NAD+ 能量球 ${i}。点击选择，或拖到身体上。`,
    alreadyFilled: (organ) => `${organ}已经有能量球了——换个位置试试！`,
    placed: (organ) => `NAD+ 已放到${organ}`,
    returned: '能量球已放回',
  },

  reveal: {
    title: '揭晓时刻',
    perfectTitle: (total) => `完美配对！${total}/${total}`,
    perfectText: '我们的首选你全部答中，太厉害了！',
    scoreTitle: (n, total) => `你答中了 ${n}/${total}`,
    positiveTwist: '你选的每个器官都没错——身体里的每个细胞都需要 NAD+。',
    topLabel: (total) => `我们的前 ${total} 名`,
    yourPicksLabel: '你的选择',
    wholeBody: '其实，你的全身都依靠 NAD+ 运作',
    button: '了解原因',
  },

  learn: {
    title: 'NAD+ 为什么重要',
    swipeHint: '左右滑动查看',
    howNmnLabel: 'NMN 的作用',
    topPickTag: '首选',
    yourPickTag: '你的选择',
    prev: '上一张',
    next: '下一张',
    button: '完成',
    cardOf: (i, n) => `第 ${i} 张，共 ${n} 张`,
  },

  intro: [
    {
      id: 'nad',
      title: 'NAD+ 是什么？',
      text: 'NAD+（烟酰胺腺嘌呤二核苷酸）是一种存在于每个活细胞中的辅酶，在把食物转化为细胞可用能量的过程中发挥核心作用。', // REVIEW
      extra: '研究显示，体内天然的 NAD+ 水平往往会随着年龄增长而下降。', // REVIEW
    },
    {
      id: 'nmn',
      title: 'NMN 是什么？',
      text: 'NMN（烟酰胺单核苷酸）是一种前体——身体用来合成 NAD+ 的原料。西兰花、毛豆和牛油果等食物中含有少量 NMN。', // REVIEW
      extra: '补充 NMN 是支持身体自身合成 NAD+ 的方式之一。', // REVIEW
    },
  ],

  organs: {
    skin: {
      name: '皮肤',
      text: '皮肤时刻都在自我更新，这需要细胞能量。NAD+ 参与能量与修复过程，有助于皮肤细胞维持自身状态。', // REVIEW
      nmn: 'NMN 是身体合成 NAD+ 的原料，有助于支持皮肤细胞所需的 NAD+。', // REVIEW
    },
    brain: {
      name: '大脑',
      text: '大脑是全身最耗能的器官之一。NAD+ 在能量生成中发挥关键作用，帮助脑细胞持续运作。', // REVIEW
      nmn: 'NMN 是身体可转化为 NAD+ 的前体，支持脑细胞所依赖的能量供应。', // REVIEW
    },
    eyes: {
      name: '眼睛',
      text: '眼睛里的感光细胞是全身最忙碌的细胞之一。NAD+ 参与能量生成，有助于这些细胞维持正常功能。', // REVIEW
      nmn: 'NMN 是合成 NAD+ 的原料，有助于支持眼部细胞在你每次看东西时所用的 NAD+。', // REVIEW
    },
    lungs: {
      name: '肺',
      text: '每一次呼吸都为细胞带来产生能量所需的氧气，而 NAD+ 在这一过程中发挥核心作用。NAD+ 也支持肺部细胞的日常维护。', // REVIEW
      nmn: 'NMN 是身体合成 NAD+ 的前体，有助于维持肺部细胞所需的 NAD+。', // REVIEW
    },
    heart: {
      name: '心脏',
      text: '心脏每天跳动约 10 万次，由富含线粒体的心肌细胞提供动力。NAD+ 在线粒体能量生成中发挥关键作用，为这些细胞提供支持。', // REVIEW
      nmn: 'NMN 是身体合成 NAD+ 的原料，支持辛勤工作的心脏细胞的能量需求。', // REVIEW
    },
    liver: {
      name: '肝脏',
      text: '肝脏每天处理数百项任务，从加工营养到分解各种物质。其中许多反应都依赖 NAD+。', // REVIEW
      nmn: 'NMN 是身体可转化为 NAD+ 的前体，有助于支持肝脏繁忙的代谢。', // REVIEW
    },
    stomach: {
      name: '胃',
      text: '消化是一项辛苦的工作，胃壁细胞更新频繁。NAD+ 参与支持这种更新的能量代谢。', // REVIEW
      nmn: 'NMN 是合成 NAD+ 的原料，有助于支持消化细胞所用的 NAD+。', // REVIEW
    },
    kidneys: {
      name: '肾脏',
      text: '肾脏全天候过滤血液，需要大量能量。NAD+ 参与能量代谢，有助于肾脏细胞维持正常功能。', // REVIEW
      nmn: 'NMN 是身体合成 NAD+ 的前体，支持肾脏持续工作所需的能量。', // REVIEW
    },
    intestines: {
      name: '肠道',
      text: '肠道内壁每隔几天就会自我更新。NAD+ 参与支持这种持续更新的能量代谢。', // REVIEW
      nmn: 'NMN 是合成 NAD+ 的原料，有助于支持肠道细胞所依赖的 NAD+。', // REVIEW
    },
    muscles: {
      name: '肌肉',
      text: '你的每一个动作都需要肌肉线粒体产生的能量。NAD+ 在这一能量生成过程中发挥核心作用，并支持正常的肌肉功能。', // REVIEW
      nmn: 'NMN 是身体可转化为 NAD+ 的前体，有助于支持肌肉所用的能量。', // REVIEW
    },
  },

  shield: {
    tab: '虾青素护盾',
    eyebrow: '特别呈献 AstaReal® 虾青素',
    title: '守护你的细胞',
    hook: (s) => `自由基来袭！你能守住护盾 ${s} 秒吗？`,
    howtoTitle: '防御方法',
    howtoText: (s, lives) => `左右拖动来移动护盾，在自由基碰到细胞前挡住它们——你有 ${lives} 颗心。坚持 ${s} 秒就能获胜！`,
    howtoButton: '准备好了！',
    blocked: (n) => `已挡住 ${n}`,
    seconds: (s) => `${s} 秒`,
    ready: '准备…',
    go: '开始！',
    cellsLabel: '你的细胞',
    shieldLabel: 'AstaReal® 虾青素',
    hit: '哎呀！有自由基突破了防线。',
    hearts: (n) => `剩下 ${n} 颗心`,
    winTitle: '你成功守住了！',
    winText: (n, s) => `你在整整 ${s} 秒内挡住了 ${n} 个自由基。`,
    loseTitle: '防守得很棒！',
    loseText: (n, s) => `你在 ${s} 秒内挡住了 ${n} 个自由基。`,
    resultButton: '这代表什么？',
    learnTitle: '你的护盾就是 AstaReal® 虾青素',
    cards: [
      {
        icon: 'meaning',
        title: '游戏的含义',
        text: '游戏中的自由基代表身体每天都会产生的不稳定分子；你移动的护盾代表 AstaReal® 虾青素——一种有助于保护细胞免受自由基损伤的抗氧化物。', // REVIEW
      },
      {
        icon: 'radical',
        title: '什么是自由基？',
        text: '自由基（氧化物）是身体把食物和氧气转化为能量时自然产生的不稳定分子。紫外线、污染、吸烟和压力都可能使其增加。', // REVIEW
        extra: '当自由基超过身体的抗氧化防御时，就会形成氧化压力，久而久之可能损伤细胞。', // REVIEW
      },
      {
        icon: 'asta',
        title: '什么是 AstaReal® 虾青素？',
        text: '虾青素是一种天然的红色类胡萝卜素——三文鱼和火烈鸟的颜色就来自它。AstaReal® 虾青素来自雨生红球藻（Haematococcus pluvialis）微藻。', // REVIEW
        extra: '作为抗氧化物，虾青素有助于中和自由基，帮助保护细胞免受氧化压力。', // REVIEW
      },
      {
        icon: 'membrane',
        title: '横跨细胞的护盾',
        text: '虾青素细长的分子结构能够横跨细胞膜，因此有助于同时保护细胞膜的内层和外层——就像你的护盾守护细胞一样。', // REVIEW
      },
      {
        icon: 'together',
        title: 'NMN + 虾青素',
        text: 'NMN 支持细胞的 NAD+ 能量生成，而虾青素有助于保护细胞免受氧化压力——能量与保护，相辅相成。', // REVIEW
      },
    ],
    badges: {
      guardian: { title: '抗氧化守护者', text: '完美！没有一个自由基突破防线。' },
      defender: { title: '细胞守卫', text: '你一直守护细胞直到最后。' },
      brave: { title: '勇敢守卫', text: '每一次阻挡都很重要——抗氧化物也是这样发挥作用的。' },
    },
    scoreLine: (n, lives) => `挡住：${n} · 剩余心数：${lives}`,
  },

  badges: {
    expert: { title: 'NAD+ 专家', text: '你很清楚 NAD+ 在哪里最重要。' },
    pro: { title: 'NAD+ 高手', text: '直觉很准——你已经充满能量！' },
    explorer: { title: 'NAD+ 探索者', text: '现在你知道了：每个细胞都需要 NAD+。' },
  },

  end: {
    title: '你已充满能量！',
    scoreLine: (n, total) => `得分：${n}/${total}`,
    ctaTitle: '领取你的礼品',
    ctaText: '请到 ZÉLL-V 柜台出示此画面，领取你的礼品。',
    playedAt: '游戏时间',
    button: '再玩一次',
  },

  disclaimer: '本游戏仅供一般教育用途，不构成医疗建议。ZÉLL-V NMN 为膳食补充品，并非用于诊断、治疗、治愈或预防任何疾病。［暂定文字——最终措辞须经监管团队批准。］', // REVIEW

  idle: {
    title: '还在吗？',
    text: (s) => `${s} 秒后重新开始…`,
    button: '我还在玩',
  },

  admin: {
    title: '展位统计',
    plays: '总游戏次数',
    perfect: '完美配对',
    rate: '完美率',
    popular: '最常选择',
    reset: '重置统计',
    confirmReset: '确定重置本设备的所有统计？',
    close: '关闭',
    storageOff: '此浏览器无法使用存储——统计数据将不会保存。',
    shieldPlays: '护盾游戏次数',
    shieldWins: '成功守住',
  },

  a11y: {
    body: '人体图。选择一个身体部位放置 NAD+ 能量球。',
    language: '语言',
    games: '选择游戏',
    fullscreen: '全屏',
    exitFullscreen: '退出全屏',
    fullscreenHint: '在 iPhone 上全屏：点按“分享”，选择“添加到主屏幕”，然后从图标打开游戏。',
    selected: '已选择',
    filled: '已有 NAD+ 能量球',
  },
};

export const CONTENT = { en, ms, zh };

/* Display order of organs (used for the "whole body lights up" sequence,
   top to bottom). Normally no need to change. */
export const ORGAN_ORDER = ['brain', 'eyes', 'lungs', 'heart', 'liver', 'stomach', 'kidneys', 'intestines', 'muscles', 'skin'];
