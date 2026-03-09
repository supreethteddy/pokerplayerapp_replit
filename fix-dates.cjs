const fs = require('fs');
const path = require('path');

function replaceDates(filePath) {
    let code = fs.readFileSync(filePath, 'utf8');

    // Add import if not present
    if (!code.includes('import { parseSafeDate }')) {
        // find the last import
        const importRegex = /import\s+.*?;\n/g;
        let match;
        let lastImportIndex = 0;
        while ((match = importRegex.exec(code)) !== null) {
            lastImportIndex = match.index + match[0].length;
        }

        // Add our import after the last import
        code = code.slice(0, lastImportIndex) + `import { parseSafeDate } from "@/lib/utils";\n` + code.slice(lastImportIndex);
    }

    // Replace new Date(variable) with parseSafeDate(variable)
    // Be careful to not replace new Date() (no arguments)
    code = code.replace(/\bnew Date\(([^)]+)\)/g, 'parseSafeDate($1)');

    fs.writeFileSync(filePath, code, 'utf8');
    console.log(`Updated ${filePath}`);
}

const files = [
    path.join(__dirname, 'client/src/components/PlayerDashboard.tsx'),
    path.join(__dirname, 'client/src/components/NotificationPopup.tsx')
];

files.forEach(replaceDates);
