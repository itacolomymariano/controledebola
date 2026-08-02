const fs = require('fs');
const path = require('path');

const transcriptPath = path.join(
  process.env.USERPROFILE || '',
  '.cursor/projects/d-Ita-git-minhapelada/agent-transcripts/a15f71c5-4c61-411b-b83e-be7bb2c2bc12/a15f71c5-4c61-411b-b83e-be7bb2c2bc12.jsonl'
);

const mainPath = path.join(__dirname, '..', 'cloud', 'main.js');
const outputPath = path.join(__dirname, '..', 'cloud', 'source', '05-legends.js');

function extractFromMainJs(content) {
  const startMarkers = [
    'const LEGEND_ATHLETE_RELATIONSHIPS',
    "Parse.Cloud.define('createAmateurLegendAthlete'",
  ];
  const endMarkers = [
    "Parse.Cloud.define('getMyEventGateTicket'",
    'function isEventGateTicketControlEnabled',
    'const PUSH_APP_IDENTIFIER',
  ];

  let start = -1;
  for (const marker of startMarkers) {
    start = content.indexOf(marker);
    if (start >= 0) break;
  }
  if (start < 0) return null;

  let end = content.length;
  for (const marker of endMarkers) {
    const idx = content.indexOf(marker, start + 1);
    if (idx >= 0) {
      end = Math.min(end, idx);
    }
  }

  return content.slice(start, end).trimEnd();
}

function extractFromTranscript(text) {
  const marker = "Parse.Cloud.define('createAmateurLegendAthlete'";
  const idx = text.indexOf(marker);
  if (idx < 0) return null;

  let start = text.lastIndexOf('const LEGEND_ATHLETE_RELATIONSHIPS', idx);
  if (start < 0) {
    start = text.lastIndexOf('function legendPublicAcl', idx);
  }
  if (start < 0) start = idx;

  const endMarker = "Parse.Cloud.define('getMyEventGateTicket'";
  let end = text.indexOf(endMarker, idx);
  if (end < 0) {
    end = text.indexOf("Parse.Cloud.define('createProLegendAthlete'", idx);
    end = text.indexOf("Parse.Cloud.define('suggestFavoritePeladaTeams'", idx);
    if (end >= 0) {
      const next = text.indexOf('});', end);
      end = text.indexOf("Parse.Cloud.define(", next + 3);
      if (end < 0) end = next + 3;
    }
  }
  if (end < 0) return null;

  let chunk = text.slice(start, end);
  chunk = chunk.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"');
  return chunk.trimEnd();
}

function main() {
  if (fs.existsSync(mainPath)) {
    const main = fs.readFileSync(mainPath, 'utf8');
    const fromMain = extractFromMainJs(main);
    if (fromMain && fromMain.length > 1000) {
      fs.writeFileSync(
        outputPath,
        `/** Legendas amadoras e profissionais */\n\n${fromMain}\n`,
        'utf8'
      );
      console.log(`Recuperado de main.js (${fromMain.split(/\r?\n/).length} linhas)`);
      return;
    }
  }

  if (fs.existsSync(transcriptPath)) {
    const transcript = fs.readFileSync(transcriptPath, 'utf8');
    const fromTranscript = extractFromTranscript(transcript);
    if (fromTranscript && fromTranscript.length > 1000) {
      fs.writeFileSync(
        outputPath,
        `/** Legendas amadoras e profissionais */\n\n${fromTranscript}\n`,
        'utf8'
      );
      console.log(`Recuperado de transcript (${fromTranscript.split(/\r?\n/).length} linhas)`);
      return;
    }
  }

  console.error('Nao foi possivel recuperar 05-legends.js automaticamente.');
  process.exit(1);
}

main();
