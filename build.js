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

// Function to read and inline JavaScript files
async function inlineJavaScript() {
    const scripts = $('script[type="text/babel"][src]');
    let combinedJs = '';

    scripts.each((i, elem) => {
        const src = $(elem).attr('src');
        if (src && !src.startsWith('http')) {
            const content = fs.readFileSync(src, 'utf8');
            combinedJs += `\n/* ${src} */\n${content}\n`;
            $(elem).remove();
        }
    });

    // Add combined JavaScript before closing body tag
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

async function build() {
    try {
        // Inline JavaScript and CSS
        await inlineJavaScript();
        inlineStyles();

        // Write the final HTML file
        fs.writeFileSync('build/final.html', $.html());
        console.log('Build completed successfully! Output: build/final.html');
    } catch (error) {
        console.error('Build failed:', error);
    }
}

build(); 