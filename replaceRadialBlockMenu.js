/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
let content = fs.readFileSync('components/calendar/RadialBlockMenu.tsx', 'utf8');

// The original section is:
//                             <div className="flex flex-col gap-2">
//                                 <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30 ml-1">
//                                     Planning metadata
//                                 </span>

content = content.replace(
    /(\n\s*)<div className="flex flex-col gap-2">\s*<span className="text-\[10px\] font-semibold uppercase tracking-widest text-white\/30 ml-1">\s*Planning metadata\s*<\/span>/g,
    `$1{!isNewBlock && (\n$1<div className="flex flex-col gap-2">\n$1    <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30 ml-1">\n$1        Planning metadata\n$1    </span>`
);

// We need to close the `{!isNewBlock && (...)}` wrapper at the end of the Planning metadata `</div>` which usually is before the Recurrence selector.
// Let's find Recurrence selector to insert the closing bracket.
//                             {/* Recurrence Selector */}

content = content.replace(
    /(\n\s*){\/\* Recurrence Selector \*\//g,
    `$1)}\n$1{/* Recurrence Selector */`
);

fs.writeFileSync('components/calendar/RadialBlockMenu.tsx', content);
console.log('Done RadialBlockMenu replacement.');
