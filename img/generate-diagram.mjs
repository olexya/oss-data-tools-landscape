import * as d3 from 'd3';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

// ES modules fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants and Configuration
const SCRIPT_DIR = __dirname;
const OUTPUT_DIR = path.join(SCRIPT_DIR, '..');

const CONFIG = {
    dimensions: {
        width: 1600,
        height: 800,
        margin: { top: 70, right: 50, bottom: 40, left: 50 },
        platformHeight: 140,
        lineHeight: 16,
        subcategoryPadding: 10,
        toolsPadding: 10,
        logoWidth: 150,
        logoHeight: 50,
        // Mise en page dynamique
        catTitleSpace: 34,   // espace réservé au titre de catégorie
        subTitleH: 20,       // hauteur du titre de sous-catégorie
        subPad: 12,          // marge interne basse d'une sous-catégorie
        subGap: 12,          // espace vertical entre sous-catégories
        colGap: 24           // espace avant la bande Platform Management
    },
    fonts: {
        family: 'Helvetica',
        sizes: {
            title: '24px',
            category: '20px',
            subcategory: '15px',
            tools: 12
        }
    },
    colors: {
        background: '#e6fff0', // Plus foncé pour être sûr qu'il soit visible
        border: '#000000',
        mainText: '#000000',
        titleText: '#000000',
        categoryText: '#56D696',
        subcategoryText: '#000000',
        boxBackground: '#ffffff',
        subBoxBackground: '#F5F5F5'
    }
};

const MAIN_CATEGORIES = [
    'Ingestion and Transport',
    'Storage',
    'Query and Processing',
    'Analysis and Output'
];

// Utility Functions
const cleanToolName = tool => tool.replace(/Apache\s+/g, '').trim();
const formatToolsList = tools => tools.map(cleanToolName).join(', ');

function embedImage(imageData) {
    return `data:image/png;base64,${Buffer.from(imageData).toString('base64')}`;
}

function createSVG(width = CONFIG.dimensions.width, height = CONFIG.dimensions.height) {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    const svg = d3.select(dom.window.document.body)
        .append('svg')
        .attr('xmlns', 'http://www.w3.org/2000/svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('font-family', CONFIG.fonts.family);
    
    // Ajout d'un rectangle de fond pour forcer la couleur
    svg.append('rect')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('fill', CONFIG.colors.background);
        
    return svg;
}

function wrapText(text, maxWidth, fontSize) {
    if (!text) return [];
    
    const words = text.split(/,\s*/).filter(Boolean);
    const lines = [];
    let currentLine = [];
    let currentWidth = 0;
    const averageCharWidth = fontSize * 0.6;

    words.forEach((word, index) => {
        const wordWithComma = index < words.length - 1 ? word + ', ' : word;
        const wordWidth = wordWithComma.length * averageCharWidth;
        
        if (currentWidth + wordWidth > maxWidth) {
            if (currentLine.length > 0) {
                lines.push(currentLine.join(', '));
                currentLine = [word];
                currentWidth = word.length * averageCharWidth;
            } else {
                lines.push(word);
            }
        } else {
            currentLine.push(word);
            currentWidth += wordWidth;
        }
    });

    if (currentLine.length > 0) {
        lines.push(currentLine.join(', '));
    }

    return lines.map((line, index, array) => 
        index < array.length - 1 && !line.endsWith(', ') ? line + ',' : line
    );
}

// Mesure le nombre de lignes d'outils pour une largeur donnée (sert au calcul de hauteur).
function measureTools(tools, maxWidth) {
    return wrapText(formatToolsList(tools), maxWidth, CONFIG.fonts.sizes.tools);
}

// Hauteur de boîte nécessaire pour une sous-catégorie (titre + lignes + marge).
function subcatBoxHeight(lines) {
    const { subTitleH, lineHeight, subPad } = CONFIG.dimensions;
    return subTitleH + Math.max(1, lines.length) * lineHeight + subPad;
}

function drawBox(svg, x, y, width, height, fill = CONFIG.colors.subBoxBackground, stroke = '#E0E0E0') {
    return svg.append('rect')
        .attr('x', x)
        .attr('y', y)
        .attr('width', width)
        .attr('height', height)
        .attr('fill', fill)
        .attr('stroke', stroke);
}

function drawTitle(svg, text, x, y, { fontSize = CONFIG.fonts.sizes.category, color = CONFIG.colors.categoryText, weight = 'bold', anchor = 'middle' } = {}) {
    return svg.append('text')
        .attr('x', x)
        .attr('y', y)
        .attr('text-anchor', anchor)
        .attr('font-size', fontSize)
        .attr('font-weight', weight)
        .attr('font-family', CONFIG.fonts.family)
        .attr('fill', color)
        .text(text);
}

function addLogo(svg, logoPath) {
    try {
        const imageData = fs.readFileSync(path.join(SCRIPT_DIR, logoPath));
        const base64Image = embedImage(imageData);
        
        const logoX = CONFIG.dimensions.width - CONFIG.dimensions.margin.right - CONFIG.dimensions.logoWidth;
        const logoY = CONFIG.dimensions.margin.top - 40;

        svg.append('image')
            .attr('x', logoX)
            .attr('y', logoY)
            .attr('width', CONFIG.dimensions.logoWidth)
            .attr('height', CONFIG.dimensions.logoHeight)
            .attr('href', base64Image);
    } catch (error) {
        console.error('Error adding logo:', error);
    }
}

// Dessine une sous-catégorie : boîte dimensionnée au contenu, titre en haut,
// outils alignés sous le titre (jamais centrés → pas de débordement).
function drawSubcategory(svg, subcat, lines, position) {
    const { x, y, width, height } = position;
    const { subTitleH, lineHeight } = CONFIG.dimensions;

    drawBox(svg, x, y, width, height);

    drawTitle(svg, subcat, x + width / 2, y + 15, {
        fontSize: CONFIG.fonts.sizes.subcategory,
        color: CONFIG.colors.subcategoryText
    });

    lines.forEach((line, i) => {
        svg.append('text')
            .attr('x', x + width / 2)
            .attr('y', y + subTitleH + 14 + (i * lineHeight))
            .attr('text-anchor', 'middle')
            .attr('font-size', `${CONFIG.fonts.sizes.tools}px`)
            .attr('font-family', CONFIG.fonts.family)
            .text(line);
    });
}

function parseMarkdownFiles() {
    const files = {
        'ingestion': '../01.ingestion_and_transport.md',
        'storage': '../02.storage.md',
        'query': '../03.query_and_processing.md',
        'analysis': '../04.analysis_and_output.md',
        'platform': '../05.platform_management.md'
    };

    const categoryMapping = {
        'ingestion': 'Ingestion and Transport',
        'storage': 'Storage',
        'query': 'Query and Processing',
        'analysis': 'Analysis and Output',
        'platform': 'Platform Management'
    };

    const data = Object.values(categoryMapping).reduce((acc, cat) => ({ ...acc, [cat]: {} }), {});

    for (const [category, file] of Object.entries(files)) {
        try {
            const filePath = path.join(SCRIPT_DIR, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const sections = content.split('###');
            
            sections.forEach(section => {
                if (!section.trim()) return;
                
                const lines = section.trim().split('\n');
                const title = lines[0].trim();
                const tools = lines
                    .filter(line => line.includes('|'))
                    .filter(line => !line.includes('Tool |') && !line.includes('---|'))
                    .map(line => line.split('|')[1]?.trim())
                    .filter(Boolean);

                if (tools.length > 0) {
                    data[categoryMapping[category]][title] = tools;
                }
            });
        } catch (error) {
            console.error(`Error reading file ${file}:`, error);
        }
    }

    return data;
}

function generateDiagram(data) {
    const d = CONFIG.dimensions;
    const { margin } = d;
    const width = d.width;
    const usableWidth = width - margin.left - margin.right;
    const columnWidth = usableWidth / MAIN_CATEGORIES.length;
    const subWidthInner = columnWidth - 40;     // largeur d'une boîte de sous-catégorie
    const subTextWidth = subWidthInner - 16;    // largeur utile pour le texte (marge)

    // 1) Mesurer chaque colonne principale (hauteur dictée par le contenu)
    const colLayouts = MAIN_CATEGORIES.map(category => {
        const subcategories = data[category] || {};
        const subs = Object.entries(subcategories).map(([subcat, tools]) => {
            const lines = measureTools(tools, subTextWidth);
            return { subcat, lines, h: subcatBoxHeight(lines) };
        });
        const contentSum = subs.reduce((s, sub) => s + sub.h, 0);         // somme des boîtes
        const naturalH = contentSum + (subs.length + 1) * d.subGap;       // + intervalles
        return { category, subs, contentSum, naturalH };
    });
    // Hauteur commune = colonne la plus haute → les autres répartissent l'espace
    // en intervalles ÉGAUX (rééquilibrage vertical, pas de vide en bas).
    const maxColH = Math.max(1, ...colLayouts.map(c => c.naturalH));

    // 2) Mesurer la bande Platform Management (sous-catégories en ligne)
    const platformData = data['Platform Management'] || {};
    const pEntries = Object.entries(platformData);
    const platformWidth = usableWidth - 20;
    const pCellW = pEntries.length ? platformWidth / pEntries.length : platformWidth;
    const pSubs = pEntries.map(([subcat, tools]) => ({
        subcat, lines: measureTools(tools, pCellW - 24)
    }));
    const pMaxLines = Math.max(1, ...pSubs.map(s => s.lines.length));
    const platformBandH = Math.max(d.platformHeight, d.subTitleH + pMaxLines * d.lineHeight + d.subPad + 10);

    // 3) Hauteur de canvas dynamique
    const colTop = margin.top + d.catTitleSpace;
    const platformTitleH = 30;
    const canvasHeight = colTop + maxColH + d.colGap + platformTitleH + platformBandH + margin.bottom;

    const svg = createSVG(width, canvasHeight);

    // Cadre principal + logo + titre
    drawBox(svg, margin.left, margin.top, usableWidth, canvasHeight - margin.top - margin.bottom, 'none', CONFIG.colors.border);
    addLogo(svg, 'logo.png');
    drawTitle(svg, 'OSS Data Tools Landscape', margin.left + 10, margin.top - 24, {
        fontSize: CONFIG.fonts.sizes.title, color: CONFIG.colors.titleText, anchor: 'left'
    });

    // 4) Colonnes principales (sous-catégories empilées selon leur hauteur réelle)
    colLayouts.forEach((col, i) => {
        const x = margin.left + i * columnWidth;
        drawBox(svg, x + 10, colTop, columnWidth - 20, maxColH, CONFIG.colors.boxBackground);
        drawTitle(svg, col.category, x + columnWidth / 2, colTop - 10);
        const n = col.subs.length;
        const gap = n > 0 ? (maxColH - col.contentSum) / (n + 1) : d.subGap;  // intervalles égaux
        let cursorY = colTop + gap;
        col.subs.forEach(sub => {
            drawSubcategory(svg, sub.subcat, sub.lines, { x: x + 20, y: cursorY, width: subWidthInner, height: sub.h });
            cursorY += sub.h + gap;
        });
    });

    // 5) Platform Management (bande horizontale dynamique)
    const platformY = colTop + maxColH + d.colGap + platformTitleH;
    drawBox(svg, margin.left + 10, platformY, platformWidth, platformBandH, CONFIG.colors.boxBackground);
    drawTitle(svg, 'Platform Management', width / 2, platformY - 12);
    pSubs.forEach((sub, i) => {
        drawSubcategory(svg, sub.subcat, sub.lines, {
            x: margin.left + 20 + i * pCellW, y: platformY + 10, width: pCellW - 20, height: platformBandH - 20
        });
    });

    return svg.node().outerHTML;
}

async function convertSvgToPng(svgString, outputPath, scale = 2) {
    try {
        const svg = Buffer.from(svgString);
        // Dimensions réelles lues sur le SVG racine (layout dynamique) → resize proportionnel.
        const m = svgString.match(/<svg[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"/);
        const baseW = m ? parseInt(m[1], 10) : CONFIG.dimensions.width;
        const baseH = m ? parseInt(m[2], 10) : CONFIG.dimensions.height;

        await sharp(svg, {
            density: 200, // DPI raisonnable (les images peuvent être hautes)
            background: { r: 255, g: 255, b: 255, alpha: 1 },
            limitInputPixels: false
        })
        .resize({
            width: Math.round(baseW * scale),
            height: Math.round(baseH * scale),
            fit: 'fill',
            position: 'center'
        })
        .png({
            compressionLevel: 9, // Compression maximale
            palette: false, // Pas de palette pour garder la qualité maximale
            quality: 100,
            effort: 10, // Effort maximal de compression
            progressive: true,
            adaptiveFiltering: true, // Filtre adaptatif pour une meilleure compression
            colours: 256 // Nombre de couleurs optimal pour le web
        })
        .withMetadata() // Préserve les métadonnées
        .toFile(outputPath);

        console.log('PNG file generated successfully!');
    } catch (error) {
        console.error('Error converting SVG to PNG:', error);
        throw error;
    }
}

async function main() {
    try {
        const data = parseMarkdownFiles();
        const svg = generateDiagram(data);
        
        // Save SVG file
        const svgOutputPath = path.join(OUTPUT_DIR, 'data_infrastructure.svg');
        fs.writeFileSync(svgOutputPath, svg);
        console.log('SVG file generated successfully!');

        // Save PNG file
        const pngOutputPath = path.join(OUTPUT_DIR, 'platform.png');
        await convertSvgToPng(svg, pngOutputPath);
    } catch (error) {
        console.error('Error in generation process:', error);
        process.exit(1);
    }
}

// Only run if this file is being executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

export { generateDiagram, parseMarkdownFiles };