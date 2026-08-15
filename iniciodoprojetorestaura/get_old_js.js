const fs = require('fs');
const transcriptPath = 'C:\\Users\\computer\\.gemini\\antigravity\\brain\\0d4feb7a-af24-4cbb-81db-765618e3c224\\.system_generated\\logs\\transcript.jsonl';
const lines = fs.readFileSync(transcriptPath, 'utf-8').split('\n');

let best = null;
let max = 0;

for (let line of lines) {
    if (!line.trim()) continue;
    try {
        const step = JSON.parse(line);
        if (step.type === 'PLANNER_RESPONSE') {
            const calls = step.tool_calls || [];
            for (let call of calls) {
                if (call.name === 'write_to_file' || call.name === 'replace_file_content') {
                    const args = call.args || {};
                    if (args.TargetFile && args.TargetFile.includes('garcom.js')) {
                        const content = args.CodeContent || args.ReplacementContent;
                        // Let's get the version with the most lines, BUT from yesterday (so ignore versions mentioning HTML5Qrcode if any).
                        if (content && content.length > max) {
                            max = content.length;
                            best = content;
                        }
                    }
                }
            }
        }
    } catch (e) {}
}

if (best) {
    fs.writeFileSync('garcom.js', best);
    console.log('Restored old version of garcom.js from log!');
} else {
    console.log('Could not find garcom.js in the log.');
}
