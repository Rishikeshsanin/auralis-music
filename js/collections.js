export const collections = [
  { id:'fresh-drops', title:'Fresh Drops', subtitle:'New releases worth hearing first', icon:'✦', accent:'violet', category:'discovery', source:'audius', loader:'bestNewReleases', query:'new releases' },
  { id:'underground', title:'Under the Radar', subtitle:'Low-key tracks before they blow up', icon:'◌', accent:'cyan', category:'discovery', source:'audius', loader:'underTheRadar', query:'underground indie' },
  { id:'most-loved', title:'Most Loved', subtitle:'Open-catalog favorites with repeat value', icon:'♥', accent:'rose', category:'discovery', source:'audius', loader:'mostLoved', query:'popular' },
  { id:'remix-radar', title:'Remix Radar', subtitle:'Reworks, edits and alternate energy', icon:'↻', accent:'amber', category:'discovery', source:'audius', loader:'remixables', query:'remix' },
  { id:'electronic-pulse', title:'Electronic Pulse', subtitle:'Synths, bass and bright circuits', icon:'ϟ', accent:'blue', category:'genre', source:'search', query:'electronic' },
  { id:'hip-hop-heat', title:'Hip-Hop Heat', subtitle:'Bars, beats and late-night rotation', icon:'◈', accent:'orange', category:'genre', source:'search', query:'hip hop' },
  { id:'night-drive', title:'Night Drive', subtitle:'City lights, deep bass, zero rush', icon:'☾', accent:'indigo', category:'mood', source:'search', query:'night drive hip hop electronic' },
  { id:'deep-focus', title:'Deep Focus', subtitle:'Instrumental momentum without noise', icon:'◎', accent:'mint', category:'focus', source:'search', query:'ambient focus instrumental' },
  { id:'chill-clouds', title:'Chill Clouds', subtitle:'Soft edges and slow afternoons', icon:'☁', accent:'sky', category:'mood', source:'search', query:'chill lofi' },
  { id:'indie-spectrum', title:'Indie Spectrum', subtitle:'Left-field voices and fresh textures', icon:'◇', accent:'pink', category:'genre', source:'search', query:'indie alternative' },
  { id:'rock-route', title:'Rock Route', subtitle:'Guitars from clean to chaotic', icon:'◆', accent:'red', category:'genre', source:'search', query:'rock alternative' },
  { id:'house-afterdark', title:'House Afterdark', subtitle:'Four-on-the-floor after midnight', icon:'◐', accent:'purple', category:'night', source:'search', query:'house dance' },
  { id:'jazz-room', title:'Jazz Room', subtitle:'Featured independent jazz selections', icon:'♬', accent:'gold', category:'genre', source:'jamendo', tag:'jazz', query:'jazz' },
  { id:'classical-space', title:'Classical Space', subtitle:'Piano, strings and cinematic calm', icon:'𝄞', accent:'silver', category:'genre', source:'jamendo', tag:'classical', query:'classical' },
  { id:'world-window', title:'World Window', subtitle:'Independent music beyond one scene', icon:'◉', accent:'green', category:'genre', source:'jamendo', tag:'world', query:'world music' },
  { id:'soundtrack-mode', title:'Soundtrack Mode', subtitle:'Cinematic energy for work and play', icon:'▣', accent:'teal', category:'focus', source:'jamendo', tag:'soundtrack', query:'soundtrack cinematic' },
  { id:'morning-glow', title:'Morning Glow', subtitle:'Warm starts, light acoustics, clear head', icon:'☀', accent:'amber', category:'mood', source:'search', query:'morning acoustic feel good' },
  { id:'late-night-rnb', title:'Late Night R&B', subtitle:'Smooth vocals after the lights go low', icon:'◒', accent:'purple', category:'night', source:'search', query:'rnb soul late night' },
  { id:'bass-mode', title:'Bass Mode', subtitle:'Low frequencies with nowhere to hide', icon:'▰', accent:'blue', category:'energy', source:'search', query:'bass dubstep drum and bass' },
  { id:'workout-charge', title:'Workout Charge', subtitle:'High-energy rotation for moving faster', icon:'▲', accent:'orange', category:'energy', source:'search', query:'workout edm high energy' },
  { id:'study-beats', title:'Study Beats', subtitle:'Low-distraction loops for long sessions', icon:'⌁', accent:'mint', category:'focus', source:'search', query:'lofi study instrumental' },
  { id:'acoustic-corner', title:'Acoustic Corner', subtitle:'Strings, voices and close-room detail', icon:'⌂', accent:'gold', category:'genre', source:'search', query:'acoustic singer songwriter' },
  { id:'soul-sessions', title:'Soul Sessions', subtitle:'Warm voices and deep grooves', icon:'●', accent:'rose', category:'genre', source:'search', query:'soul rnb groove' },
  { id:'metal-forge', title:'Metal Forge', subtitle:'Heavy riffs, pressure and release', icon:'✹', accent:'red', category:'genre', source:'search', query:'metal heavy rock' },
  { id:'punk-current', title:'Punk Current', subtitle:'Fast edges and no wasted motion', icon:'⚡', accent:'orange', category:'genre', source:'search', query:'punk rock' },
  { id:'techno-tunnel', title:'Techno Tunnel', subtitle:'Minimal repetition, maximum hypnosis', icon:'◍', accent:'violet', category:'night', source:'search', query:'techno minimal club' },
  { id:'trance-skyline', title:'Trance Skyline', subtitle:'Melodic lift for long horizons', icon:'△', accent:'sky', category:'energy', source:'search', query:'trance progressive electronic' },
  { id:'reggae-sun', title:'Reggae Sun', subtitle:'Easy rhythm and warm-weather motion', icon:'☼', accent:'green', category:'genre', source:'search', query:'reggae dub' },
  { id:'latin-motion', title:'Latin Motion', subtitle:'Percussion-forward movement and color', icon:'✺', accent:'rose', category:'genre', source:'search', query:'latin dance' },
  { id:'folk-trails', title:'Folk Trails', subtitle:'Storytelling, wood, strings and air', icon:'⌇', accent:'gold', category:'genre', source:'search', query:'folk acoustic' },
  { id:'piano-hours', title:'Piano Hours', subtitle:'Keys for reading, thinking and breathing', icon:'▤', accent:'silver', category:'focus', source:'jamendo', tag:'piano', query:'piano instrumental' },
  { id:'cinematic-rise', title:'Cinematic Rise', subtitle:'Big builds for bigger ideas', icon:'◭', accent:'teal', category:'energy', source:'jamendo', tag:'cinematic', query:'cinematic epic soundtrack' },
  { id:'dreamy-pop', title:'Dreamy Pop', subtitle:'Soft-focus hooks and bright haze', icon:'✧', accent:'pink', category:'mood', source:'search', query:'dream pop indie pop' },
  { id:'rainy-day', title:'Rainy Day', subtitle:'Quiet songs for grey windows', icon:'☂', accent:'sky', category:'mood', source:'search', query:'rainy day mellow acoustic' },
  { id:'euphoric', title:'Euphoric', subtitle:'Hands-up moments and pure lift', icon:'✷', accent:'violet', category:'mood', source:'search', query:'euphoric uplifting dance' },
  { id:'calm-down', title:'Calm Down', subtitle:'Slow the room without going silent', icon:'≈', accent:'mint', category:'mood', source:'search', query:'calm relaxing ambient' }
];

export const featuredCollectionIds = ['fresh-drops','underground','night-drive','deep-focus','hip-hop-heat','jazz-room','workout-charge','dreamy-pop'];

export const collectionCategories = [
  { id:'all', label:'All' },
  { id:'discovery', label:'Discovery' },
  { id:'genre', label:'Genres' },
  { id:'mood', label:'Moods' },
  { id:'focus', label:'Focus' },
  { id:'energy', label:'Energy' },
  { id:'night', label:'Night' }
];

export function getCollection(id) { return collections.find(collection => collection.id === id); }
