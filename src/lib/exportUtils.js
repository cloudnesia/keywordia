import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { get } from 'svelte/store';
import { mindMap } from './store';

// Helper to sanitize filename
function getSanitizedTitle() {
    const mapData = get(mindMap);
    const title = mapData.text || 'mindmap';
    return title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

// Markdown Export
function generateMarkdownRecursive(node, depth = 0) {
    const indent = '  '.repeat(depth);
    let md = `${indent}- ${node.text}\n`;

    if (node.children && node.children.length > 0) {
        node.children.forEach(child => {
            md += generateMarkdownRecursive(child, depth + 1);
        });
    }
    return md;
}

export function exportToMarkdown() {
    const mapData = get(mindMap);
    const markdown = `# ${mapData.text}\n\n` + generateMarkdownRecursive(mapData);

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${getSanitizedTitle()}.md`;
    a.click();
    URL.revokeObjectURL(url);
}

// Image Export (PNG)
export async function exportToImage(elementId = 'map-container', options = {}) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error('Map element not found');
        return;
    }

    try {
        // Use provided background color or default to white
        // For dark mode, we might want #111827 (gray-900) or #ffffff
        const backgroundColor = options.backgroundColor || '#ffffff';

        const dataUrl = await toPng(element, { backgroundColor });
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${getSanitizedTitle()}.png`;
        a.click();
    } catch (error) {
        console.error('Error generating image:', error);
        throw error;
    }
}

// PDF Export
export async function exportToPDF(elementId = 'map-container', options = {}) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error('Map element not found');
        return;
    }

    try {
        const backgroundColor = options.backgroundColor || '#ffffff';
        const dataUrl = await toPng(element, { backgroundColor });

        // Calculate dimensions
        const img = new Image();
        img.src = dataUrl;
        await img.decode();

        // A4 landscape dimensions in mm
        const pdfWidth = 297;
        const pdfHeight = 210;

        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        // Scale image to fit within A4 landscape
        const imgWidth = img.width;
        const imgHeight = img.height;
        const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);

        const outputWidth = imgWidth * ratio;
        const outputHeight = imgHeight * ratio;

        const x = (pdfWidth - outputWidth) / 2;
        const y = (pdfHeight - outputHeight) / 2;

        doc.addImage(dataUrl, 'PNG', x, y, outputWidth, outputHeight);
        doc.save(`${getSanitizedTitle()}.pdf`);
    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    }
}
