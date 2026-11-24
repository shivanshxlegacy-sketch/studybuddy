// Builds chapter packs (notes and a 10-question paper per chapter) for teacher review.
// Chapter names come from content/syllabus/ (verified against ncert.nic.in), never from AI memory.
// Usage:  ANTHROPIC_API_KEY=... node scripts/generate-packs.js --class 9 --subject Maths
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'content', 'packs');
const SYL = path.join(ROOT, 'content', 'syllabus');
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const KEY = process.env.ANTHROPIC_API_KEY;
const SUBJECTS = ['Maths', 'Science', 'English', 'Social Studies', 'Hindi', 'Computer Science'];

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const classes = args.class ? [Number(args.class)] : Array.from({ length: 12 }, (_, i) => i + 1);
const subjects = args.subject ? [args.subject] : SUBJECTS;
if (!KEY) { console.error('Set ANTHROPIC_API_KEY first.'); process.exit(1); }
const slug = s => s.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');

async function ask(prompt) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 3000, messages: [{ role: 'user', content: prompt }] })
    });
    if (!r.ok) throw new Error('API ' + r.status);
    const text = (await r.json()).content.map(b => b.text || '').join('');
    try {
      const c = text.replace(/```json|```/g, '').trim();
      return JSON.parse(c.slice(c.indexOf('{'), c.lastIndexOf('}') + 1));
    } catch (e) { if (attempt === 2) throw e; }
  }
}

const RULES = 'Write original explanations and questions in your own words. Do not copy textbook text. Use age-appropriate language for the class.';
fs.mkdirSync(OUT, { recursive: true });
let calls = 0;

for (const cls of classes) {
  for (const subject of subjects) {
    const sylFile = path.join(SYL, `class-${cls}-${slug(subject)}.json`);
    if (!fs.existsSync(sylFile)) { console.log(`Skip Class ${cls} ${subject}: no syllabus file yet`); continue; }
    const syl = JSON.parse(fs.readFileSync(sylFile, 'utf8'));
    if (syl.verified !== true || !syl.chapters?.length) { console.log(`Skip Class ${cls} ${subject}: syllabus not verified yet`); continue; }

    const file = path.join(OUT, `class-${cls}-${slug(subject)}.json`);
    const pack = fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, 'utf8'))
      : { class: cls, subject, book: syl.book, edition: syl.edition, generated: new Date().toISOString(), reviewed: false, chapters: {} };
    console.log(`\nClass ${cls} ${subject} (${syl.book || 'book'}, ${syl.edition || ''})`);

    for (const chapter of syl.chapters.slice(0, 40)) {
      if (pack.chapters[chapter]?.notes && pack.chapters[chapter]?.paper) { console.log('  done: ' + chapter); continue; }
      try {
        const notes = await ask(`Write revision notes for the chapter "${chapter}" of the Class ${cls} ${subject} NCERT book "${syl.book}" (${syl.edition}). ${RULES}
Return ONLY valid JSON: {"notes":["key point"],"terms":[{"term":"","meaning":""}]}
Give 6 to 10 key points and 4 to 8 terms.`);
        const paper = await ask(`Create a 10-question practice paper for the chapter "${chapter}", Class ${cls} ${subject}, in NCERT exam style. ${RULES}
Each question has exactly 4 options and one correct answer. Mix recall and application.
Return ONLY valid JSON: {"topic":"${chapter}","qs":[{"q":"","options":["","","",""],"answer":0,"explain":""}]}`);
        calls += 2;
        pack.chapters[chapter] = { notes, paper };
        fs.writeFileSync(file, JSON.stringify(pack, null, 2));
        console.log('  saved: ' + chapter);
      } catch (e) { console.log('  skipped: ' + chapter + ' (' + e.message + ')'); }
    }
  }
}
console.log(`\nDone. About ${calls} AI calls. Teachers review each file, then set "reviewed": true.`);
