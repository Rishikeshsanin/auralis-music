export const genres = [
  { id:'electronic', label:'Electronic', icon:'ϟ', query:'electronic', accent:'blue', detail:'Synths, circuits and future-facing production' },
  { id:'hip-hop', label:'Hip-Hop', icon:'◈', query:'hip hop', accent:'orange', detail:'Bars, beats, drill, boom-bap and beyond' },
  { id:'pop', label:'Pop', icon:'✺', query:'pop', accent:'pink', detail:'Hooks, bright production and replay value' },
  { id:'rock', label:'Rock', icon:'◆', query:'rock alternative', accent:'red', detail:'Guitars from clean to chaotic' },
  { id:'indie', label:'Indie', icon:'◇', query:'indie alternative', accent:'violet', detail:'Independent voices and left-field textures' },
  { id:'house', label:'House', icon:'◐', query:'house dance', accent:'purple', detail:'Four-on-the-floor club motion' },
  { id:'techno', label:'Techno', icon:'◍', query:'techno minimal', accent:'violet', detail:'Hypnotic repetition and machine rhythm' },
  { id:'trance', label:'Trance', icon:'△', query:'trance progressive', accent:'sky', detail:'Melodic lift and long-form builds' },
  { id:'ambient', label:'Ambient', icon:'◎', query:'ambient atmospheric', accent:'mint', detail:'Space, texture and slow movement' },
  { id:'lofi', label:'Lo-fi', icon:'⌁', query:'lofi chillhop', accent:'mint', detail:'Dusty loops and low-distraction beats' },
  { id:'jazz', label:'Jazz', icon:'♬', query:'jazz', accent:'gold', detail:'Improvisation, swing and modern fusion' },
  { id:'classical', label:'Classical', icon:'𝄞', query:'classical', accent:'silver', detail:'Piano, strings, chamber and orchestral' },
  { id:'rnb', label:'R&B', icon:'◒', query:'rnb rhythm blues', accent:'rose', detail:'Smooth vocals, groove and late-night soul' },
  { id:'soul', label:'Soul', icon:'●', query:'soul groove', accent:'rose', detail:'Warm voices and deep-pocket rhythm' },
  { id:'reggae', label:'Reggae', icon:'☼', query:'reggae dub', accent:'green', detail:'Easy rhythm, bass and dub space' },
  { id:'metal', label:'Metal', icon:'✹', query:'metal heavy rock', accent:'red', detail:'Heavy riffs, speed and pressure' },
  { id:'punk', label:'Punk', icon:'⚡', query:'punk rock', accent:'orange', detail:'Fast edges and direct energy' },
  { id:'folk', label:'Folk', icon:'⌇', query:'folk acoustic', accent:'gold', detail:'Storytelling, wood, strings and air' },
  { id:'acoustic', label:'Acoustic', icon:'⌂', query:'acoustic singer songwriter', accent:'gold', detail:'Close-room voices and natural instruments' },
  { id:'latin', label:'Latin', icon:'✦', query:'latin dance', accent:'rose', detail:'Rhythm-forward music across Latin scenes' },
  { id:'world', label:'World', icon:'◉', query:'world music', accent:'green', detail:'Independent music beyond one scene' },
  { id:'soundtrack', label:'Soundtrack', icon:'▣', query:'soundtrack cinematic', accent:'teal', detail:'Scores, cinematic builds and atmosphere' },
  { id:'dnb', label:'Drum & Bass', icon:'▰', query:'drum and bass jungle', accent:'blue', detail:'Fast breaks and low-end momentum' },
  { id:'dubstep', label:'Dubstep', icon:'▥', query:'dubstep bass', accent:'purple', detail:'Bass pressure, drops and sound design' }
];

export const moods = [
  { id:'chill', label:'Chill', icon:'☁', query:'chill lofi mellow', accent:'sky', detail:'Soft edges and slower breathing' },
  { id:'focus', label:'Focus', icon:'◎', query:'ambient focus instrumental', accent:'mint', detail:'Quiet momentum for deep work' },
  { id:'energy', label:'Energy', icon:'ϟ', query:'high energy electronic workout', accent:'orange', detail:'Move faster and turn it up' },
  { id:'night-drive', label:'Night Drive', icon:'☾', query:'night drive electronic hip hop', accent:'indigo', detail:'City lights and deep bass' },
  { id:'feel-good', label:'Feel Good', icon:'✺', query:'feel good upbeat pop', accent:'pink', detail:'Easy replay and brighter rooms' },
  { id:'melancholy', label:'Melancholy', icon:'◌', query:'melancholy sad indie', accent:'silver', detail:'Beautifully low-key and reflective' },
  { id:'romantic', label:'Romantic', icon:'♥', query:'romantic love rnb acoustic', accent:'rose', detail:'Warm, close and unhurried' },
  { id:'dreamy', label:'Dreamy', icon:'✧', query:'dreamy dream pop ambient', accent:'violet', detail:'Soft-focus sound and bright haze' },
  { id:'rainy', label:'Rainy Day', icon:'☂', query:'rainy day mellow acoustic', accent:'sky', detail:'Grey-window comfort' },
  { id:'workout', label:'Workout', icon:'▲', query:'workout edm high energy', accent:'orange', detail:'Momentum without a dip' },
  { id:'morning', label:'Morning', icon:'☀', query:'morning acoustic feel good', accent:'amber', detail:'Warm starts and clear headspace' },
  { id:'late-night', label:'Late Night', icon:'◒', query:'late night rnb soul chill', accent:'purple', detail:'Smooth rotation after dark' },
  { id:'euphoric', label:'Euphoric', icon:'✷', query:'euphoric uplifting dance', accent:'violet', detail:'Big lift and hands-up moments' },
  { id:'calm', label:'Calm', icon:'≈', query:'calm relaxing ambient piano', accent:'mint', detail:'Slow the room without silence' },
  { id:'adventure', label:'Adventure', icon:'◭', query:'cinematic adventure epic', accent:'teal', detail:'Soundtrack energy for moving forward' },
  { id:'nostalgic', label:'Nostalgic', icon:'↶', query:'nostalgic retro synthwave old school', accent:'amber', detail:'Memory, warmth and familiar colors' }
];

export function getGenre(id) { return genres.find(item => item.id === id); }
export function getMood(id) { return moods.find(item => item.id === id); }
