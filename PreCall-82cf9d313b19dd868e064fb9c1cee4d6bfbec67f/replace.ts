import fs from 'fs';
import path from 'path';

const walk = (dir: string): string[] => {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        results.push(file);
      }
    }
  });
  return results;
};

const files = walk('./src');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Custom replacements to avoid "Topic Topics"
  let newContent = content
    .replace(/Topic Modules/g, 'Topics')
    .replace(/Topic modules/g, 'Topics')
    .replace(/topic modules/g, 'topics')
    .replace(/Modules/g, 'Topics')
    .replace(/modules/g, 'topics')
    .replace(/Module/g, 'Topic')
    .replace(/module/g, 'topic');
  
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log(`Updated ${file}`);
  }
});
