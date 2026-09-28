// Writes CHANGELOG.md from public/version.json (the same list the app shows in "What's new").
//   node tools/changelog.js
const fs = require('fs'), path = require('path');
const v = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'version.json'), 'utf8'));
let md = `# BiteWise change log

Every release is tagged in git (\`v1.4.0\`, \`v1.3.0\`, …), so any version can be brought back.
The app shows this same list under **Me → Version → What's new**. Edit \`public/version.json\`, not this file.

## Going back to an earlier version

\`\`\`sh
git tag                          # list versions
git checkout v1.3.0              # look at an old version (read-only)
cf push                          # optional: run that old version live
git checkout main                # return to the newest code
\`\`\`

To undo one release but keep everything after it: \`git revert <commit>\` (see \`git log v1.3.0..v1.4.0\` for a release's commits).

## Releasing a new version

1. Bump \`version\` and add an entry at the top of \`history\` in \`public/version.json\`.
2. Set \`APP_VERSION\` in \`public/app.js\` to the same number, and bump \`VERSION\` in \`public/sw.js\`.
3. \`npm test\`. Everything must pass.
4. \`node tools/changelog.js\`, then commit, tag (\`git tag v1.x.y\`), push, and deploy with \`cf push --strategy rolling\` (no downtime).
`;
for (const h of v.history) {
  md += `\n## ${h.version} · ${h.title}\n_${h.date} · git tag \`v${h.version}\`_\n\n`;
  md += h.changes.map(c => `- ${c}`).join('\n') + '\n';
}
fs.writeFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), md);
console.log('wrote CHANGELOG.md (' + v.history.length + ' versions)');
