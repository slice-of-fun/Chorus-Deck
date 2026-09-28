const fs = require('fs');

const filePath = 'src/renderer/views/history/index.vue';
let content = fs.readFileSync(filePath, 'utf8');

// 1
content = content.replace(
  `v-for="tab in ['songs', 'playlists', 'albums', 'podcasts']"`,
  `v-for="tab in ['songs', 'playlists', 'albums']"`
);

// 2
content = content.replace(
  /\s*v-if="currentCategory !== 'podcasts'"/g,
  ''
);

// 3: Remove template block for podcasts
// Let's use a regex to match from `<template v-if="currentCategory === 'podcasts'">` 
// to the closing `</template>` that follows it. Since there are nested templates, regex might be tricky.
// Let's just remove everything between line 133 and 212 inclusive.
let lines = content.split('\n');
// We know lines 132 is index 131. The template starts at 133.
const startIndex = lines.findIndex(l => l.includes(`<template v-if="currentCategory === 'podcasts'">`));
if (startIndex !== -1) {
  let endIndex = startIndex;
  while (endIndex < lines.length && !lines[endIndex].includes('</template>') || (lines[endIndex].includes('</template>') && !lines[endIndex].match(/^\s*<\/template>\s*$/))) {
    // Wait, the closing tag is at line 212. Let's just look for the first </template> with the same indentation.
    const indent = lines[startIndex].match(/^\s*/)[0];
    if (lines[endIndex] === indent + '</template>') {
      break;
    }
    endIndex++;
  }
  lines.splice(startIndex, endIndex - startIndex + 1);
}
content = lines.join('\n');

// 4
content = content.replace(
  /import \{ mapDjProgramToSongResult \} from '@\/utils\/podcastUtils';\n/,
  ''
);

// 5
content = content.replace(
  `const currentCategory = ref<'songs' | 'playlists' | 'albums' | 'podcasts'>('songs');`,
  `const currentCategory = ref<'songs' | 'playlists' | 'albums'>('songs');`
);

// 6
content = content.replace(
  /const currentPodcastSubTab = ref<'episodes' \| 'radios'>\('episodes'\);\n/,
  ''
);

// 7
content = content.replace(
  /  \} else if \(currentCategory\.value === 'podcasts'\) \{\n    if \(currentPodcastSubTab\.value === 'episodes'\) \{\n      return playHistoryStore\.podcastHistory;\n    \} else \{\n      return playHistoryStore\.podcastRadioHistory;\n    \}\n/,
  ''
);

// 8
content = content.replace(
  `const handleCategoryChange = async (value: 'songs' | 'playlists' | 'albums' | 'podcasts') => {`,
  `const handleCategoryChange = async (value: 'songs' | 'playlists' | 'albums') => {`
);

// 9
content = content.replace(
  /  if \(value === 'podcasts'\) \{\n    currentTab\.value = 'local';\n  \}\n/,
  ''
);

// 10: methods
content = content.replace(
  /const mapDjProgramToSong = \(program: any\): SongResult => \{[\s\S]*?const handleDelPodcastRadio = \(item: any\) => \{\n  playHistoryStore\.delPodcastRadio\(item\);\n  displayList\.value = displayList\.value\.filter\(\(r\) => r\.id !== item\.id\);\n\};\n/,
  ''
);

// 11
content = content.replace(
  /    playHistoryStore\.podcastHistory,\n    playHistoryStore\.podcastRadioHistory\n/,
  ''
);
// Also remove the trailing comma from the previous element
content = content.replace(
  /    playHistoryStore\.albumHistory,\n/,
  '    playHistoryStore.albumHistory\n'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Cleaned history/index.vue');
