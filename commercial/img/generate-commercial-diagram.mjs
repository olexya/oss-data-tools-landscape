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
        width: 1200,
        height: 800,
        margin: { top: 50, right: 50, bottom: 50, left: 50 },
        platformHeight: 140,
        lineHeight: 16,
        subcategoryPadding: 10,
        toolsPadding: 10,
        logoWidth: 150,
        logoHeight: 50
    },
    fonts: {
        family: 'Helvetica',
        sizes: {
            title: '24px',
            category: '20px',
            subcategory: '14px',
            tools: 11
        }
    },
    colors: {
        background: '#fff5e6', // Orange très clair pour différencier de l'OSS
        border: '#000000',
        mainText: '#000000',
        titleText: '#000000',
        categoryText: '#E67E22', // Orange pour le commercial
        subcategoryText: '#000000',
        boxBackground: '#ffffff',
        subBoxBackground: '#FFF8F0'
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
    const averageCharWidth = fontSize * 0.55;

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
    const totalContentHeight = totalHeight + 25;
    const startY = y + (boxHeight - totalContentHeight) / 2 + 5;

    let actualHeight = 0;
    lines.forEach((line, i) => {
        if (i * CONFIG.dimensions.lineHeight < maxHeight) {
            svg.append('text')
                .attr('x', x)
                .attr('y', startY + 25 + (i * CONFIG.dimensions.lineHeight))
                .attr('text-anchor', 'middle')
                .attr('font-size', `${fontSize}px`)
                .attr('font-family', CONFIG.fonts.family)
                .text(line);
            actualHeight = (i + 1) * CONFIG.dimensions.lineHeight;
        }
    });

    return {
        totalHeight: actualHeight + 25,
        startY: startY,
        endY: startY + actualHeight + 25,
        titleY: startY + 15
    };
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
        // Try to load logo from parent img folder
        const parentLogoPath = path.join(SCRIPT_DIR, '..', '..', 'img', 'logo.png');
        if (fs.existsSync(parentLogoPath)) {
            const imageData = fs.readFileSync(parentLogoPath);
            const base64Image = embedImage(imageData);
            
            const logoX = CONFIG.dimensions.width - CONFIG.dimensions.margin.right - CONFIG.dimensions.logoWidth;
            const logoY = CONFIG.dimensions.margin.top - 40;

            svg.append('image')
                .attr('x', logoX)
                .attr('y', logoY)
                .attr('width', CONFIG.dimensions.logoWidth)
                .attr('height', CONFIG.dimensions.logoHeight)
                .attr('href', base64Image);
        }
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
        color: CONFIG.colors.subcategoryText
    });

    return toolsInfo;
}

// Commercial-specific data - hardcoded for reliability
function getCommercialData() {
    return {
        'Ingestion and Transport': {
            'ETL/ELT Platforms': [
                'Fivetran', 'Stitch', 'Matillion', 'Informatica IDMC', 
                'Hevo Data', 'Rivery', 'AWS Glue', 'Azure Data Factory'
            ],
            'Event Streaming': [
                'Confluent Cloud', 'Amazon Kinesis', 'Azure Event Hubs', 
                'Google Pub/Sub', 'Amazon MSK', 'Solace', 'WarpStream'
            ],
            'Log & Observability': [
                'Splunk', 'Datadog', 'New Relic', 'Elastic Cloud', 
                'Sumo Logic', 'Cribl', 'Coralogix'
            ],
            'CDC Solutions': [
                'Striim', 'Arcion', 'Qlik Replicate', 'HVR', 
                'AWS DMS', 'Google Datastream'
            ]
        },
        'Storage': {
            'Cloud Data Warehouses': [
                'Snowflake', 'BigQuery', 'Redshift', 'Azure Synapse', 
                'Databricks SQL', 'Firebolt', 'Teradata Vantage'
            ],
            'Data Lakehouse': [
                'Databricks Lakehouse', 'Dremio Cloud', 'Starburst Galaxy', 
                'Onehouse', 'Tabular'
            ],
            'Object Storage': [
                'Amazon S3', 'Azure Blob', 'Google Cloud Storage', 
                'Wasabi', 'Cloudflare R2'
            ],
            'Real-time OLAP': [
                'ClickHouse Cloud', 'Rockset', 'SingleStore', 
                'Imply (Druid)', 'Tinybird', 'Propel'
            ]
        },
        'Query and Processing': {
            'Stream Processing': [
                'Confluent ksqlDB', 'Kinesis Analytics', 'Azure Stream Analytics',
                'Google Dataflow', 'Decodable', 'Materialize Cloud'
            ],
            'Batch Processing': [
                'Databricks', 'AWS EMR', 'Google Dataproc', 
                'Qubole', 'Cloudera'
            ],
            'Transformation': [
                'dbt Cloud', 'Coalesce', 'Dataform', 
                'Prophecy', 'Alteryx'
            ],
            'Query Engines': [
                'Starburst Galaxy', 'Dremio', 'Athena', 
                'Snowflake', 'BigQuery'
            ]
        },
        'Analysis and Output': {
            'Enterprise BI': [
                'Tableau', 'Power BI', 'Looker', 'Qlik Sense', 
                'ThoughtSpot', 'MicroStrategy', 'Domo'
            ],
            'Modern BI': [
                'Mode', 'Sigma', 'Hex', 'Preset', 
                'Lightdash', 'Omni'
            ],
            'Monitoring': [
                'Grafana Cloud', 'Datadog Dashboards', 'New Relic', 
                'Elastic Kibana', 'Chronosphere'
            ],
            'Product Analytics': [
                'Amplitude', 'Mixpanel', 'Heap', 'Pendo', 
                'FullStory', 'Posthog Cloud'
            ]
        },
        'Platform Management': {
            'Orchestration': [
                'Astronomer', 'Dagster Cloud', 'Prefect Cloud', 
                'dbt Cloud', 'Kestra Cloud', 'Google Composer'
            ],
            'Data Catalog': [
                'Alation', 'Collibra', 'Atlan', 'Secoda', 
                'Select Star', 'Unity Catalog', 'Dataplex'
            ],
            'Data Quality': [
                'Monte Carlo', 'Bigeye', 'Soda Cloud', 'Anomalo', 
                'Metaplane', 'Great Expectations Cloud'
            ],
            'Security & Access': [
                'Immuta', 'Privacera', 'BigID', 'Securiti', 
                'Satori', 'Okera'
            ]
        }
    };
}

function generateDiagram(data) {
    const svg = createSVG();
    const { margin, width, height, platformHeight } = CONFIG.dimensions;
    
    // Main border
    drawBox(svg, margin.left, margin.top, width - margin.left - margin.right, 
        height - margin.top - margin.bottom, 'none', CONFIG.colors.border);

    // Add logo
    addLogo(svg, 'logo.png');

    // Main title - Commercial version
    drawTitle(svg, 'Commercial Data Tools Landscape', margin.left + 10, margin.top - 20, {
        fontSize: CONFIG.fonts.sizes.title,
        color: CONFIG.colors.titleText,
        anchor: 'left'
    });

    // Calculate layout dimensions
    const columnWidth = (width - margin.left - margin.right) / MAIN_CATEGORIES.length;
    const columnHeight = height - margin.top - margin.bottom - platformHeight - 40;

    // Draw main categories
    MAIN_CATEGORIES.forEach((category, i) => {
        const x = margin.left + (i * columnWidth);
        const y = margin.top + 40;
        
        // Category container
        drawBox(svg, x + 10, y, columnWidth - 20, columnHeight - 50, CONFIG.colors.boxBackground);
        
        // Category title
        drawTitle(svg, category, x + (columnWidth / 2), y - 10);

        // Draw subcategories
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
    drawTitle(svg, 'Platform Management', width / 2, platformY - 12);

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
        const svg = Buffer.from(svgString);
        
        await sharp(svg, {
            density: 400,
            background: { r: 255, g: 245, b: 230, alpha: 1 },
            limitInputPixels: false
        })
        .resize({
            width: 2400,
            height: 1600,
            fit: 'fill',
            position: 'center'
        })
        .png({
            compressionLevel: 9,
            palette: false,
            quality: 100,
            effort: 10,
            progressive: true,
            adaptiveFiltering: true,
            colours: 256
        })
        .withMetadata()
        .toFile(outputPath);

        console.log('PNG file generated successfully!');
    } catch (error) {
        console.error('Error converting SVG to PNG:', error);
        throw error;
    }
}

async function main() {
    try {
        const data = getCommercialData();
        const svg = generateDiagram(data);
        
        // Save SVG file
        const svgOutputPath = path.join(OUTPUT_DIR, 'commercial_infrastructure.svg');
        fs.writeFileSync(svgOutputPath, svg);
        console.log('SVG file generated successfully at:', svgOutputPath);

        // Save PNG file
        const pngOutputPath = path.join(OUTPUT_DIR, 'commercial_platform.png');
        await convertSvgToPng(svg, pngOutputPath);
        console.log('PNG file generated at:', pngOutputPath);
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

export { generateDiagram, getCommercialData };

