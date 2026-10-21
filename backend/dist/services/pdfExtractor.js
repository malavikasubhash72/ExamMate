"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.inferSubjectFromFilename = inferSubjectFromFilename;
exports.extractSyllabusFromPDF = extractSyllabusFromPDF;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const pdf_parse_1 = __importDefault(require("pdf-parse"));
/**
 * Get subject name from filename when the frontend does not provide one.
 */
function inferSubjectFromFilename(fileName) {
    const baseName = path_1.default.basename(fileName, path_1.default.extname(fileName));
    const cleanName = baseName
        .replace(/^(syllabus[_\-\s]*|course[_\-\s]*)/i, '')
        .replace(/([_\-\s]*syllabus|[_\-\s]*course|[_\-\s]*20\d\d)$/i, '')
        .replace(/[_\-]+/g, ' ')
        .trim();
    if (cleanName.length > 2) {
        return cleanName
            .split(/\s+/)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    return 'General Subject';
}
/**
 * Clean text extracted from PDF.
 */
function cleanText(text) {
    return text
        .replace(/\u00a0/g, ' ')
        .replace(/[‐-‒–—]/g, '-')
        .replace(/[•●▪]/g, '-')
        .replace(/\s+/g, ' ')
        .trim();
}
/**
 * Split a syllabus description into actual topics.
 *
 * Example:
 * "Demand: Factors determining demand - Law of Demand - Demand curve"
 *
 * becomes:
 * Demand
 * Factors determining demand
 * Law of Demand
 * Demand curve
 */
function splitIntoTopics(text) {
    let cleaned = cleanText(text);
    // Remove contact-hour numbers accidentally attached at the end.
    cleaned = cleaned.replace(/\s+\d+\s*$/, '');
    // Normalize common separators.
    cleaned = cleaned
        .replace(/\s+-\s+/g, '|')
        .replace(/\s*;\s*/g, '|')
        .replace(/\s*\|\s*/g, '|');
    const pieces = cleaned
        .split('|')
        .map((item) => item.trim())
        .filter((item) => item.length >= 3);
    const topics = [];
    for (const piece of pieces) {
        // Sometimes one topic contains a colon followed by subtopics.
        // Example: Demand: Factors determining demand
        const colonParts = piece
            .split(':')
            .map((x) => x.trim())
            .filter((x) => x.length >= 3);
        if (colonParts.length > 1) {
            for (const part of colonParts) {
                addTopic(topics, part);
            }
        }
        else {
            addTopic(topics, piece);
        }
    }
    return topics;
}
/**
 * Add topic after filtering obvious non-topic text.
 */
function addTopic(topics, value) {
    let topic = value
        .replace(/^[0-9.\-*\s]+/, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (topic.length < 3 || topic.length > 150) {
        return;
    }
    // Reject metadata / administrative information.
    const ignoredPatterns = [
        /^semester\b/i,
        /^course code\b/i,
        /^cie marks\b/i,
        /^ese marks\b/i,
        /^teaching hours\b/i,
        /^contact hours\b/i,
        /^credits?\b/i,
        /^exam hours\b/i,
        /^prerequisites?\b/i,
        /^course type\b/i,
        /^course objectives?\b/i,
        /^course outcomes?\b/i,
        /^course assessment\b/i,
        /^continuous internal evaluation\b/i,
        /^end semester examination\b/i,
        /^text books?\b/i,
        /^reference books?\b/i,
        /^model question paper\b/i,
        /^part a\b/i,
        /^part b\b/i,
        /^total\b/i,
        /^attendance\b/i,
        /^assignment\b/i,
        /^internal examination\b/i,
    ];
    if (ignoredPatterns.some((pattern) => pattern.test(topic))) {
        return;
    }
    // Ignore lines that are only numbers.
    if (/^\d+$/.test(topic)) {
        return;
    }
    // Ignore very obvious table headings.
    if (/^(module no\.?|syllabus description|contact hours)$/i.test(topic)) {
        return;
    }
    if (!topics.some((t) => t.toLowerCase() === topic.toLowerCase())) {
        topics.push(topic);
    }
}
/**
 * Extract module blocks from syllabus text.
 *
 * Supports:
 * Module 1
 * Module I
 * Unit 1
 * Unit I
 * Chapter 1
 * Part 1
 */
function extractModuleBlocks(syllabusText) {
    const normalized = syllabusText
        .replace(/\r/g, '\n')
        .replace(/[‐-‒–—]/g, '-');
    const lines = normalized
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    const moduleRegex = /^(module|unit|chapter|part)\s*([0-9]+|[ivxlcdm]+)\s*[:.\-]?\s*(.*)$/i;
    const blocks = [];
    let current = null;
    for (const line of lines) {
        const match = line.match(moduleRegex);
        if (match) {
            if (current) {
                blocks.push(current);
            }
            const type = match[1];
            const number = match[2];
            const title = match[3]?.trim();
            current = {
                name: `${type} ${number}${title ? `: ${title}` : ''}`,
                description: '',
            };
            continue;
        }
        if (current) {
            current.description += ` ${line}`;
        }
    }
    if (current) {
        blocks.push(current);
    }
    return blocks;
}
/**
 * Special parser for university syllabus tables.
 *
 * Handles text such as:
 *
 * 1
 * Basic economic problems - Production Possibility Curve - Utility ...
 * 6
 *
 * 2
 * Cost - Cost concepts - Private cost ...
 * 6
 */
function extractNumberedSyllabusModules(syllabusText) {
    const lines = syllabusText
        .replace(/\r/g, '\n')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    const modules = [];
    let currentModule = null;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // A line containing only 1, 2, 3, 4... is likely a module number.
        const numberMatch = line.match(/^(\d{1,2})$/);
        if (numberMatch) {
            const number = Number(numberMatch[1]);
            if (number >= 1 && number <= 20) {
                if (currentModule) {
                    modules.push(currentModule);
                }
                currentModule = {
                    name: `Module ${number}`,
                    description: '',
                };
                continue;
            }
        }
        if (currentModule) {
            // Ignore contact-hour number.
            if (/^\d{1,2}$/.test(line)) {
                continue;
            }
            currentModule.description += ` ${line}`;
        }
    }
    if (currentModule) {
        modules.push(currentModule);
    }
    return modules;
}
/**
 * Extract the actual syllabus portion of the PDF.
 */
function getSyllabusSection(rawText) {
    const text = rawText.replace(/\r/g, '\n');
    const syllabusMatch = text.search(/\bSYLLABUS\b/i);
    if (syllabusMatch === -1) {
        return '';
    }
    const afterSyllabus = text.substring(syllabusMatch);
    // Stop before administrative sections that follow the syllabus.
    const endPatterns = [
        /\bCourse Assessment Method\b/i,
        /\bCourse Outcomes\b/i,
        /\bCO-PO Mapping Table\b/i,
        /\bText Books\b/i,
        /\bReference Books\b/i,
        /\bMODEL QUESTION PAPER\b/i,
    ];
    let endIndex = afterSyllabus.length;
    for (const pattern of endPatterns) {
        const match = afterSyllabus.search(pattern);
        if (match !== -1 && match > 20) {
            endIndex = Math.min(endIndex, match);
        }
    }
    return afterSyllabus.substring(0, endIndex);
}
/**
 * Main PDF syllabus extraction.
 */
async function extractSyllabusFromPDF(filePath, fileName, providedSubjectName) {
    const dataBuffer = fs_1.default.readFileSync(filePath);
    const pdfData = await (0, pdf_parse_1.default)(dataBuffer);
    const rawText = pdfData.text || '';
    const inferredSubjectName = providedSubjectName || inferSubjectFromFilename(fileName);
    // ---------------------------------------------------------
    // STEP 1: Extract ONLY the syllabus section.
    // ---------------------------------------------------------
    const syllabusText = getSyllabusSection(rawText);
    const subjects = [];
    // ---------------------------------------------------------
    // STEP 2: Try "Module 1 / Module 2" style PDFs.
    // ---------------------------------------------------------
    let moduleBlocks = extractModuleBlocks(syllabusText);
    // ---------------------------------------------------------
    // STEP 3: If that failed, try numbered syllabus tables.
    // ---------------------------------------------------------
    if (moduleBlocks.length === 0) {
        moduleBlocks = extractNumberedSyllabusModules(syllabusText);
    }
    // ---------------------------------------------------------
    // STEP 4: Convert module descriptions into topics.
    // ---------------------------------------------------------
    const modules = [];
    for (const block of moduleBlocks) {
        const topics = splitIntoTopics(block.description);
        if (topics.length > 0) {
            modules.push({
                name: block.name,
                topics: topics.map((name) => ({ name })),
            });
        }
    }
    // ---------------------------------------------------------
    // STEP 5: Create subject.
    // ---------------------------------------------------------
    if (modules.length > 0) {
        subjects.push({
            name: inferredSubjectName,
            modules,
        });
    }
    // ---------------------------------------------------------
    // STEP 6: Safe fallback.
    // ---------------------------------------------------------
    if (subjects.length === 0) {
        subjects.push({
            name: inferredSubjectName,
            modules: [
                {
                    name: 'Module 1',
                    topics: [
                        { name: 'Syllabus topics could not be automatically detected' },
                    ],
                },
            ],
        });
    }
    return {
        inferredSubjectName,
        subjects,
        rawText,
    };
}
