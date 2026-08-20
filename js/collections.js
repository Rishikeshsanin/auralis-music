export const collections = [
  { id:'fresh-drops', title:'Fresh Drops', subtitle:'New releases worth hearing first', icon:'✦', accent:'violet', source:'audius', loader:'bestNewReleases', query:'new releases' },
  { id:'underground', title:'Under the Radar', subtitle:'Low-key tracks before they blow up', icon:'◌', accent:'cyan', source:'audius', loader:'underTheRadar', query:'underground indie' },
  { id:'most-loved', title:'Most Loved', subtitle:'Open-catalog favorites with repeat value', icon:'♥', accent:'rose', source:'audius', loader:'mostLoved', query:'popular' },
  { id:'remix-radar', title:'Remix Radar', subtitle:'Reworks, edits and alternate energy', icon:'↻', accent:'amber', source:'audius', loader:'remixables', query:'remix' },
  { id:'electronic-pulse', title:'Electronic Pulse', subtitle:'Synths, bass and bright circuits', icon:'ϟ', accent:'blue', source:'search', query:'electronic' },
  { id:'hip-hop-heat', title:'Hip-Hop Heat', subtitle:'Bars, beats and late-night rotation', icon:'◈', accent:'orange', source:'search', query:'hip hop' },
  { id:'night-drive', title:'Night Drive', subtitle:'City lights, deep bass, zero rush', icon:'☾', accent:'indigo', source:'search', query:'night drive hip hop electronic' },
  { id:'deep-focus', title:'Deep Focus', subtitle:'Instrumental momentum without noise', icon:'◎', accent:'mint', source:'search', query:'ambient focus instrumental' },
  { id:'chill-clouds', title:'Chill Clouds', subtitle:'Soft edges and slow afternoons', icon:'☁', accent:'sky', source:'search', query:'chill lofi' },
  { id:'indie-spectrum', title:'Indie Spectrum', subtitle:'Left-field voices and fresh textures', icon:'◇', accent:'pink', source:'search', query:'indie alternative' },
  { id:'rock-route', title:'Rock Route', subtitle:'Guitars from clean to chaotic', icon:'◆', accent:'red', source:'search', query:'rock alternative' },
  { id:'house-afterdark', title:'House Afterdark', subtitle:'Four-on-the-floor after midnight', icon:'◐', accent:'purple', source:'search', query:'house dance' },
  { id:'jazz-room', title:'Jazz Room', subtitle:'Featured independent jazz selections', icon:'♬', accent:'gold', source:'jamendo', tag:'jazz', query:'jazz' },
  { id:'classical-space', title:'Classical Space', subtitle:'Piano, strings and cinematic calm', icon:'𝄞', accent:'silver', source:'jamendo', tag:'classical', query:'classical' },
  { id:'world-window', title:'World Window', subtitle:'Independent music beyond one scene', icon:'◉', accent:'green', source:'jamendo', tag:'world', query:'world music' },
  { id:'soundtrack-mode', title:'Soundtrack Mode', subtitle:'Cinematic energy for work and play', icon:'▣', accent:'teal', source:'jamendo', tag:'soundtrack', query:'soundtrack cinematic' }
];

export const featuredCollectionIds = ['fresh-drops','underground','night-drive','deep-focus','hip-hop-heat','jazz-room'];

export function getCollection(id) {
  return collections.find(collection => collection.id === id);
}
