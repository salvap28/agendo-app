/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
let content = fs.readFileSync('components/calendar/WeekView.tsx', 'utf8');

content = content.replace(
    /setCreateModalTimeRange\(\{ start: startToUse, end: endToUse \}\);\s*setIsCreateModalOpen\(true\);/,
    `const enriched = enrichNewBlockWithPlanningMetadata({
                    startAt: startToUse,
                    endAt: endToUse,
                    title: "",
                    type: "other"
                });
                const newBlock = createBlock(enriched);
                if (newBlock) {
                    setIsNewBlock(true);
                    setSelectedBlockId(newBlock.id);
                }`
);

fs.writeFileSync('components/calendar/WeekView.tsx', content);
console.log('Done WeekView replacement.');
