// One-off migration script: blog/*.html -> src/content/blog/*.md
// Run once, then delete (or keep for reference) — not part of the ongoing build.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import * as cheerio from 'cheerio';

const files = readdirSync('blog').filter((f) => f.endsWith('.html'));
mkdirSync('src/content/blog', { recursive: true });

function yamlString(s) {
  return JSON.stringify(s); // double-quoted YAML scalar, handles all special chars safely
}

let ok = 0;
const ambiguous = [];

for (const file of files) {
  const slug = file.replace(/\.html$/, '');
  const html = readFileSync(`blog/${file}`, 'utf8');
  const $ = cheerio.load(html);

  const title = $('h1').first().text().trim();
  const description = $('meta[name="description"]').attr('content') || '';
  const ogImage = $('meta[property="og:image"]').attr('content') || 'https://daintytrading.com/og-card.jpg';

  // JSON-LD BlogPosting block carries datePublished reliably for every post (verified: 38/38 have it)
  let publishedDate = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text());
      if (data['@type'] === 'BlogPosting' && data.datePublished) {
        publishedDate = data.datePublished;
      }
    } catch {}
  });
  if (!publishedDate) ambiguous.push(`${slug}: no datePublished in JSON-LD`);

  // category + readTime: from the post's own .meta-row chips ("Topic" / "Read time")
  let category = null;
  let readTime = null;
  $('.meta-row .chip').each((_, el) => {
    const strong = $(el).find('strong').text().trim();
    const full = $(el).text().trim();
    const value = full.replace(strong, '').trim();
    if (strong === 'Topic') category = value;
    if (strong === 'Read time') readTime = value;
  });
  if (!category) ambiguous.push(`${slug}: no Topic chip found`);
  if (!readTime) ambiguous.push(`${slug}: no Read time chip found`);

  const bodyHtml = $('article.prose').html().trim();

  const frontmatter = [
    '---',
    `title: ${yamlString(title)}`,
    `description: ${yamlString(description)}`,
    `category: ${yamlString(category || 'Engineering')}`,
    `publishedDate: ${yamlString(publishedDate || '2026-01-01')}`,
    `readTime: ${yamlString(readTime || '5 min')}`,
    `ogImage: ${yamlString(ogImage)}`,
    '---',
    '',
    bodyHtml,
    '',
  ].join('\n');

  writeFileSync(`src/content/blog/${slug}.md`, frontmatter);
  ok++;
}

console.log(`Wrote ${ok} of ${files.length} blog markdown files.`);
if (ambiguous.length) {
  console.log('\nAmbiguous extractions:');
  ambiguous.forEach((a) => console.log(' -', a));
} else {
  console.log('No ambiguous extractions.');
}
