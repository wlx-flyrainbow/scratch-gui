#!/usr/bin/env node
/**
 * Copies BMAD skills from canonical paths under _bmad/ (see _bmad/_config/skill-manifest.csv)
 * into IDE-local skill folders. Edit skills only in _bmad/; run `npm run bmad:sync` after pull or changes.
 */
import { readFileSync, existsSync, mkdirSync, rmSync, cpSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(projectRoot, '_bmad', '_config', 'skill-manifest.csv');

const SKILL_TARGETS = [
    path.join(projectRoot, '.cursor', 'skills'),
    path.join(projectRoot, '.opencode', 'skills'),
    path.join(projectRoot, '.trae', 'skills')
];

function parseManifestLines (text) {
    const rows = [];
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
        if (!line.trim() || line.startsWith('canonicalId')) {
            continue;
        }
        const pathMatch = line.match(/"(_bmad\/[^"]+\/SKILL\.md)"/);
        const nameMatch = line.match(/^"([^"]+)"/);
        if (!pathMatch || !nameMatch) {
            continue;
        }
        rows.push({
            name: nameMatch[1],
            skillFile: pathMatch[1]
        });
    }
    return rows;
}

function sync () {
    if (!existsSync(manifestPath)) {
        console.error(`bmad-sync-skills: missing manifest at ${manifestPath}`);
        process.exit(1);
    }
    const text = readFileSync(manifestPath, 'utf8');
    const rows = parseManifestLines(text);
    if (rows.length === 0) {
        console.error('bmad-sync-skills: no skills parsed from manifest');
        process.exit(1);
    }

    for (const { name, skillFile } of rows) {
        const relDir = path.dirname(skillFile);
        const srcDir = path.join(projectRoot, relDir);
        if (!existsSync(path.join(srcDir, 'SKILL.md'))) {
            console.error(`bmad-sync-skills: missing ${path.join(relDir, 'SKILL.md')}`);
            process.exit(1);
        }

        for (const base of SKILL_TARGETS) {
            const destDir = path.join(base, name);
            mkdirSync(base, { recursive: true });
            if (existsSync(destDir)) {
                rmSync(destDir, { recursive: true, force: true });
            }
            cpSync(srcDir, destDir, { recursive: true });
        }
    }

    console.log(`bmad-sync-skills: synced ${rows.length} skills to ${SKILL_TARGETS.length} IDE skill roots.`);
}

sync();
