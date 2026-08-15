const fs = require('fs');

const transcriptPath = 'C:\\Users\\computer\\.gemini\\antigravity\\brain\\0d4feb7a-af24-4cbb-81db-765618e3c224\\.system_generated\\logs\\transcript.jsonl';
const lines = fs.readFileSync(transcriptPath, 'utf-8').split('\n');

let oldestContent = null;

// The file was created yesterday or earlier. Let's find the FIRST time we successfully read garcom.html or wrote it completely today, OR we can look for step_index 1352 which gave us the structure.
// Actually, I can just parse all 'view_file' responses for garcom.html and pick the one with 363 lines (from yesterday).
for (let line of lines) {
    if (!line.trim()) continue;
    try {
        const step = JSON.parse(line);
        if (step.type === 'VIEW_FILE' && step.content.includes('Total Lines: 363')) {
            // This is the view_file step! But wait, view_file only shows some lines.
            // But wait, if it was written, let's find the `write_to_file` call from yesterday.
        }
        if (step.type === 'PLANNER_RESPONSE') {
            const calls = step.tool_calls || [];
            for (let call of calls) {
                if (call.name === 'write_to_file') {
                    const args = call.args || {};
                    if (args.TargetFile && args.TargetFile.includes('garcom.html')) {
                        const content = args.CodeContent;
                        // Pick the one that is likely the old version (no #screen-login glassmorphism, no QR reader).
                        // Let's just output it.
                        if (content && !content.includes('Html5Qrcode') && content.includes('bottom-nav')) {
                           oldestContent = content;
                        }
                    }
                }
            }
        }
    } catch (e) {}
}

if (oldestContent) {
    fs.writeFileSync('garcom.html', oldestContent);
    console.log('Restored old version of garcom.html from log!');
} else {
    console.log('Could not find the old version without QR code in the log.');
}
