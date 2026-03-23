const fs = require('fs');
let content = fs.readFileSync('components/calendar/GlassCalendarDashboard.tsx', 'utf8');

// The original content had:
//         setCreateModalTimeRange({
//             start: startToUse,
//             end: addMinutes(startToUse, 60),
//         });
//         setIsCreateModalOpen(true);

content = content.replace(
    /setCreateModalTimeRange\(\{\s*start: startToUse,\s*end: addMinutes\(startToUse, 60\),\s*\}\);\s*setIsCreateModalOpen\(true\);/,
    `        const enriched = enrichNewBlockWithPlanningMetadata({
            startAt: startToUse,
            endAt: addMinutes(startToUse, 60),
            title: "",
            type: "other"
        });
        const newBlock = createBlock(enriched);
        if (newBlock) onOpenBlock(newBlock.id, true);`
);

// We also need to add the import if it's missing:
if (!content.includes('enrichNewBlockWithPlanningMetadata')) {
    content = content.replace(
        /import \{ findNextFreeSlot, snapTo15 \} from "@\/lib\/utils\/scheduling";/,
        `import { findNextFreeSlot, snapTo15 } from "@/lib/utils/scheduling";\nimport { enrichNewBlockWithPlanningMetadata } from "@/lib/utils/blockEnrichment";`
    );
}

// And remove CreateBlockModal
content = content.replace(/import \{ CreateBlockModal \}.*;\n/, '');
content = content.replace(/<CreateBlockModal[^>]+initialStart=\{createModalTimeRange\?\.start\}[^>]+initialEnd=\{createModalTimeRange\?\.end\}[^>]*\/>/, '');
// And remove state definitions if possible, but leaving them unused is fine.

fs.writeFileSync('components/calendar/GlassCalendarDashboard.tsx', content);
console.log('Done GlassCalendarDashboard replacement.');
