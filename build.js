const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Create build directory if it doesn't exist
if (!fs.existsSync('build')) {
    fs.mkdirSync('build');
}

// Read the main HTML file
let html = fs.readFileSync('index.html', 'utf8');
const $ = cheerio.load(html);

// Helper function to create a safe regex pattern
function createSafeRegex(pattern) {
    try {
        return new RegExp(pattern, 'g');
    } catch (error) {
        console.error('Invalid regex pattern:', pattern);
        return null;
    }
}

// Function to read and inline JavaScript files
async function inlineJavaScript() {
    const scripts = $('script[type="text/babel"][src]');

    // Identify utility files first to handle them specially
    const utilFilePaths = [];
    const fileContents = {};
    const componentFiles = new Set();

    scripts.each((i, elem) => {
        const src = $(elem).attr('src');
        if (src && !src.startsWith('http')) {
            const content = fs.readFileSync(src, 'utf8');
            fileContents[src] = content;

            // Identify utility files and component files
            if (src.includes('/utils') || src.includes('sdk.js') || src.includes('/models/')) {
                utilFilePaths.push(src);
            }
            if (src.includes('/components/')) {
                componentFiles.add(src);
            }
            $(elem).remove();
        }
    });

    // Process utility files to extract common functions and classes
    const commonDeclarations = {};
    const processedUtils = {};

    // Start building combined JS with common utilities defined once
    let combinedJs = '// Common utilities\n';
    combinedJs += 'const React = window.React;\n';
    combinedJs += 'const ReactDOM = window.ReactDOM;\n\n';

    // Add window object initialization
    combinedJs += '// Initialize window object with shared classes and components\n';
    combinedJs += 'window.Models = window.Models || {};\n';
    combinedJs += 'window.Components = window.Components || {};\n\n';

    // Helper function to extract React components
    function extractReactComponents(content, filePath) {
        // Match both function and const component declarations
        const functionComponents = content.match(/function\s+([A-Z]\w*)\s*\([^)]*\)\s*\{[^]*?\n\}/g) || [];
        const constComponents = content.match(/const\s+([A-Z]\w*)\s*=\s*(?:function|\([^)]*\)\s*=>)\s*\{[^]*?\n\}/g) || [];

        [...functionComponents, ...constComponents].forEach(match => {
            let componentName;
            if (match.startsWith('function')) {
                componentName = match.match(/function\s+([A-Z]\w*)/)[1];
            } else {
                componentName = match.match(/const\s+([A-Z]\w*)/)[1];
            }

            if (!commonDeclarations[componentName]) {
                commonDeclarations[componentName] = {
                    type: 'component',
                    count: 1,
                    firstFile: filePath,
                    code: match,
                    isGlobal: true
                };
            } else {
                commonDeclarations[componentName].count++;
            }
        });
    }

    // First pass: Process utility files and extract common declarations
    utilFilePaths.forEach(filePath => {
        const content = fileContents[filePath];

        // Extract function declarations (excluding React components)
        const functionMatches = content.match(/function\s+([a-z]\w*)\s*\([^)]*\)\s*\{[^]*?\n\}/g) || [];
        functionMatches.forEach(match => {
            const funcName = match.match(/function\s+([a-z]\w*)/)[1];
            if (!commonDeclarations[funcName]) {
                commonDeclarations[funcName] = {
                    type: 'function',
                    count: 1,
                    firstFile: filePath,
                    code: match
                };
            } else {
                commonDeclarations[funcName].count++;
            }
        });

        // Extract class declarations
        const classMatches = content.match(/class\s+(\w+)(?:\s+extends\s+\w+)?\s*\{[^]*?\n\}/g) || [];
        classMatches.forEach(match => {
            const className = match.match(/class\s+(\w+)/)[1];
            const windowAssignment = content.match(new RegExp(`window\\.${className}\\s*=\\s*${className}`));

            if (!commonDeclarations[className]) {
                commonDeclarations[className] = {
                    type: 'class',
                    count: 1,
                    firstFile: filePath,
                    code: match,
                    isGlobal: !!windowAssignment
                };
            } else {
                commonDeclarations[className].count++;
                commonDeclarations[className].isGlobal = commonDeclarations[className].isGlobal || !!windowAssignment;
            }
        });

        // Mark this file as processed
        processedUtils[filePath] = true;
    });

    // Second pass: Process component files
    componentFiles.forEach(filePath => {
        const content = fileContents[filePath];
        extractReactComponents(content, filePath);
    });

    // Add common declarations that appear multiple times
    Object.entries(commonDeclarations).forEach(([name, info]) => {
        if (info.count > 1 || info.isGlobal) {
            combinedJs += `// ${name} ${info.type} extracted from ${info.firstFile}\n`;
            combinedJs += info.code + '\n';

            if (info.type === 'component') {
                combinedJs += `window.Components.${name} = ${name};\n\n`;
            } else if (info.type === 'class' && info.isGlobal) {
                combinedJs += `window.Models.${name} = ${name};\n\n`;
            } else {
                combinedJs += '\n';
            }
        }
    });

    // Process all files
    scripts.each((i, elem) => {
        const src = $(elem).attr('src');
        if (src && !src.startsWith('http')) {
            let content = fileContents[src];

            // Skip processed utility files to avoid duplication
            if (processedUtils[src] || componentFiles.has(src)) {
                // Remove duplicate declarations and window assignments
                Object.entries(commonDeclarations).forEach(([name, info]) => {
                    if (info.count > 1 || info.isGlobal) {
                        let pattern;
                        if (info.type === 'component') {
                            // Handle both function and const component declarations
                            const funcPattern = createSafeRegex(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{[^]*?\\n\\}`);
                            const constPattern = createSafeRegex(`const\\s+${name}\\s*=\\s*(?:function|\\([^)]*\\)\\s*=>)\\s*\\{[^]*?\\n\\}`);

                            if (funcPattern) content = content.replace(funcPattern, `// ${name} component is defined globally`);
                            if (constPattern) content = content.replace(constPattern, `// ${name} component is defined globally`);
                        } else if (info.type === 'class') {
                            pattern = createSafeRegex(`class\\s+${name}(?:\\s+extends\\s+\\w+)?\\s*\\{[^]*?\\n\\}`);
                            const windowPattern = createSafeRegex(`window\\.${name}\\s*=\\s*${name};?\\n?`);

                            if (pattern) content = content.replace(pattern, `// ${name} is defined globally`);
                            if (windowPattern) content = content.replace(windowPattern, '');
                        } else if (info.type === 'function') {
                            pattern = createSafeRegex(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{[^]*?\\n\\}`);
                            if (pattern) content = content.replace(pattern, `// ${name} is defined globally`);
                        }
                    }
                });
            }

            // Skip React and ReactDOM declarations in all files
            content = content.replace(/const\s+React\s*=\s*window\.React\s*;/g, '// React is defined globally');
            content = content.replace(/const\s+ReactDOM\s*=\s*window\.ReactDOM\s*;/g, '// ReactDOM is defined globally');

            // Add file content
            combinedJs += `\n/* ${src} */\n${content}\n`;
        }
    });

    // Add combined JavaScript before closing body tag with proper type
    if (combinedJs) {
        $('body').append(`
            <script type="text/babel">
                ${combinedJs}
            </script>
        `);
    }
}

// Function to inline styles
function inlineStyles() {
    const styles = $('link[rel="stylesheet"]');
    let combinedCss = '';

    styles.each((i, elem) => {
        const href = $(elem).attr('href');
        if (href && !href.startsWith('http')) {
            const content = fs.readFileSync(href, 'utf8');
            combinedCss += `\n/* ${href} */\n${content}\n`;
            $(elem).remove();
        }
    });

    if (combinedCss) {
        $('head').append(`
            <style>
                ${combinedCss}
            </style>
        `);
    }
}

// Function to ensure proper MIME types
function ensureProperMimeTypes() {
    // Add proper MIME type meta tag
    $('head').prepend('<meta http-equiv="Content-Type" content="text/javascript; charset=utf-8">');

    // Update script tags to have proper type
    $('script').each((i, elem) => {
        const type = $(elem).attr('type');
        if (type === 'text/babel') {
            $(elem).attr('type', 'text/babel');
        } else if (!type) {
            $(elem).attr('type', 'text/javascript');
        }
    });
}

async function build() {
    try {
        // Inline JavaScript and CSS
        await inlineJavaScript();
        inlineStyles();
        ensureProperMimeTypes();

        // Write the final HTML file
        fs.writeFileSync('build/final.html', $.html());
        console.log('Build completed successfully! Output: build/final.html');
    } catch (error) {
        console.error('Build failed:', error);
    }
}

build(); 