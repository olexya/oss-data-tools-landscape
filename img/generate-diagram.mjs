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
        height: 1000,
        margin: { top: 70, right: 60, bottom: 60, left: 60 },
        platformHeight: 180,
        lineHeight: 20,
        subcategoryPadding: 15,
        toolsPadding: 15,
        logoWidth: 180,
        logoHeight: 60
    },
    fonts: {
        family: 'Arial, Helvetica, sans-serif',
        sizes: {
            title: '32px',
            category: '24px',
            subcategory: '18px',
            tools: 16
        },
        weights: {
            title: 700,
            category: 600,
            subcategory: 600,
            tools: 400
        }
    },
    colors: {
        background: '#FFFFFF',
        border: '#2C3E50',
        mainText: '#2C3E50',
        titleText: '#1A237E',
        categoryText: '#1976D2',
        subcategoryText: '#2C3E50',
        boxBackground: '#FFFFFF',
        subBoxBackground: '#F5F8FA'
    },
    export: {
        density: 300,
        quality: 100
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

function createSVG() {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    const svg = d3.select(dom.window.document.body)
        .append('svg')
        .attr('xmlns', 'http://www.w3.org/2000/svg')
        .attr('width', CONFIG.dimensions.width)
        .attr('height', CONFIG.dimensions.height)
        .attr('viewBox', `0 0 ${CONFIG.dimensions.width} ${CONFIG.dimensions.height}`)
        .style('font-family', CONFIG.fonts.family);
    
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

function addWrappedText(svg, text, x, y, maxWidth, fontSize, maxHeight, boxHeight) {
    const lines = wrapText(text, maxWidth, fontSize);
    const totalHeight = lines.length * CONFIG.dimensions.lineHeight;
    const totalContentHeight = totalHeight + 30;
    const startY = y + (boxHeight - totalContentHeight) / 2 + 5;

    let actualHeight = 0;
    lines.forEach((line, i) => {
        if (i * CONFIG.dimensions.lineHeight < maxHeight) {
            svg.append('text')
                .attr('x', x)
                .attr('y', startY + 30 + (i * CONFIG.dimensions.lineHeight))
                .attr('text-anchor', 'middle')
                .attr('font-size', `${fontSize}px`)
                .attr('font-weight', CONFIG.fonts.weights.tools)
                .attr('font-family', CONFIG.fonts.family)
                .text(line)
                .style('letter-spacing', '0.3px');
            actualHeight = (i + 1) * CONFIG.dimensions.lineHeight;
        }
    });

    return {
        totalHeight: actualHeight + 30,
        startY: startY,
        endY: startY + actualHeight + 30,
        titleY: startY + 20
    };
}

function drawBox(svg, x, y, width, height, fill = CONFIG.colors.subBoxBackground, stroke = '#E0E0E0') {
    return svg.append('rect')
        .attr('x', x)
        .attr('y', y)
        .attr('width', width)
        .attr('height', height)
        .attr('fill', fill)
        .attr('stroke', stroke)
        .attr('rx', 4) // Added rounded corners
        .attr('ry', 4);
}

function drawTitle(svg, text, x, y, { fontSize = CONFIG.fonts.sizes.category, color = CONFIG.colors.categoryText, weight = CONFIG.fonts.weights.category, anchor = 'middle' } = {}) {
    return svg.append('text')
        .attr('x', x)
        .attr('y', y)
        .attr('text-anchor', anchor)
        .attr('font-size', fontSize)
        .attr('font-weight', weight)
        .attr('font-family', CONFIG.fonts.family)
        .attr('fill', color)
        .style('letter-spacing', '0.5px')
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

function drawSubcategory(svg, subcat, tools, position) {
    const { x, y, width, height, maxWidth, maxHeight } = position;
    
    drawBox(svg, x, y, width, height);
    
    const formattedTools = formatToolsList(tools);
    const toolsInfo = addWrappedText(
        svg,
        formattedTools,
        x + width / 2,
        y,
        maxWidth,
        CONFIG.fonts.sizes.tools,
        maxHeight,
        height
    );

    drawTitle(svg, subcat, x + width / 2, toolsInfo.titleY - 5, {
        fontSize: CONFIG.fonts.sizes.subcategory,
        color: CONFIG.colors.subcategoryText,
        weight: CONFIG.fonts.weights.subcategory
    });

    return toolsInfo;
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
    const svg = createSVG();
    const { margin, width, height, platformHeight } = CONFIG.dimensions;
    
    // Main border
    drawBox(svg, margin.left, margin.top, width - margin.left - margin.right, 
        height - margin.top - margin.bottom, 'none', CONFIG.colors.border);

    // Add logo
    addLogo(svg, 'logo.png');

    // Main title
    drawTitle(svg, 'OSS Data Tools Landscape', margin.left + 10, margin.top - 20, {
        fontSize: CONFIG.fonts.sizes.title,
        color: CONFIG.colors.titleText,
        weight: CONFIG.fonts.weights.title,
        anchor: 'left'
    });

    // Calculate layout dimensions
    const columnWidth = (width - margin.left - margin.right) / MAIN_CATEGORIES.length;
    const columnHeight = height - margin.top - margin.bottom - platformHeight - 40;

    // Draw main categories
    MAIN_CATEGORIES.forEach((category, i) => {
        const x = margin.left + (i * columnWidth);
        const y = margin.top + 40;
        
        drawBox(svg, x + 10, y, columnWidth - 20, columnHeight - 50, CONFIG.colors.boxBackground);
        
        drawTitle(svg, category, x + (columnWidth / 2), y - 10, {
            weight: CONFIG.fonts.weights.category
        });

        const subcategories = data[category];
        if (subcategories) {
            const numSubcats = Object.keys(subcategories).length;
            const subHeight = (columnHeight - 70) / numSubcats;
            
            Object.entries(subcategories).forEach(([subcat, tools], j) => {
                drawSubcategory(svg, subcat, tools, {
                    x: x + 20,
                    y: y + (j * subHeight) + 15,
                    width: columnWidth - 40,
                    height: subHeight - 10,
                    maxWidth: columnWidth - CONFIG.dimensions.toolsPadding,
                    maxHeight: subHeight - 2 * CONFIG.dimensions.subcategoryPadding - 10
                });
            });
        }
    });

    // Platform Management section
    const platformY = height - margin.bottom - platformHeight - 10;
    const platformWidth = width - margin.left - margin.right - 20;
    
    drawBox(svg, margin.left + 10, platformY, platformWidth, platformHeight, CONFIG.colors.boxBackground);
    drawTitle(svg, 'Platform Management', width / 2, platformY - 12, {
        weight: CONFIG.fonts.weights.category
    });

    const platformData = data['Platform Management'];
    if (platformData) {
        const subWidth = platformWidth / Object.keys(platformData).length;
        
        Object.entries(platformData).forEach(([subcat, tools], i) => {
            drawSubcategory(svg, subcat, tools, {
                x: margin.left + 20 + (i * subWidth),
                y: platformY + 10,
                width: subWidth - 20,
                height: platformHeight - 20,
                maxWidth: subWidth - CONFIG.dimensions.toolsPadding,
                maxHeight: platformHeight - 40
            });
        });
    }

    return svg.node().outerHTML;
}

async function convertSvgToPng(svgString, outputPath) {
    try {
        await sharp(Buffer.from(svgString))
            .png({
                quality: CONFIG.export.quality,
                density: CONFIG.export.density
            })
            .toFile(outputPath);
        console.log('High-quality PNG file generated successfully!');
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