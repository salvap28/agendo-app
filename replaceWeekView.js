/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const file = 'c:/Users/salva/Documents/AGENDO V0.2/components/calendar/WeekView.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/const newBlock = await createBlock\(\{\s*startAt: finalStart,\s*endAt: finalEnd,\s*title: ""\s*\}\);\s*if \(newBlock\) \{\s*setIsNewBlock\(true\);\s*setSelectedBlockId\(newBlock\.id\);\s*\}/g, "setCreateModalTimeRange({ start: finalStart, end: finalEnd });\n        setIsCreateModalOpen(true);");

content = content.replace(/const newBlock = await createBlock\(\{\s*startAt: startToUse,\s*endAt: endToUse\s*\}\);\s*\/\/[^\n]*\n\s*if \(newBlock\) \{\s*setIsNewBlock\(true\);\s*setSelectedBlockId\(newBlock\.id\);\s*\}/g, "setCreateModalTimeRange({ start: startToUse, end: endToUse });\n                setIsCreateModalOpen(true);");

if (!content.includes('<CreateBlockModal')) {
    content = content.replace(/<FocusPlannerModal[^>]*\/>\s*<\/div>\s*\)\;/g, match => {
        return match.replace('</div>', `
            <CreateBlockModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                initialStart={createModalTimeRange?.start}
                initialEnd={createModalTimeRange?.end}
            />
        </div>`);
    });
}

fs.writeFileSync(file, content);
