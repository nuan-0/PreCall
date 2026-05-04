import { readFileSync } from 'fs';
async function test() {
  const config = JSON.parse(readFileSync('firebase-applet-config.json', 'utf8'));
  const dbId = config.firestoreDatabaseId || '(default)';
  const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${dbId}/documents/bundles/subjects`;
  const res = await fetch(url);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
test();
