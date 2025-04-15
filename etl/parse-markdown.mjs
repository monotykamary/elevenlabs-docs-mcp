import fs from 'fs/promises';
import path from 'path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import { toString } from 'mdast-util-to-string';
// Consider adding remark-mdx and remark-frontmatter if needed
// import remarkMdx from 'remark-mdx';
// import remarkFrontmatter from 'remark-frontmatter';
import { findFiles } from './utils.mjs';

// Initialize the Markdown parser
// Add .use(remarkMdx) if you need to handle MDX specific syntax
// Add .use(remarkFrontmatter, ['yaml', 'toml']) to parse frontmatter
const parser = unified().use(remarkParse);

/**
 * Parses Markdown/MDX files found within a directory into structured data.
 * @param {string} basePath - Path to the documentation submodule root.
 * @returns {Promise<object[]>} - Array of structured data extracted from Markdown files.
 */
export async function parseMarkdownFiles(basePath) {
    console.log('Parsing Markdown/MDX files...');
    const markdownData = [];
    const files = await findFiles(basePath, /\.(md|mdx)$/i);

    for (const file of files) {
        const relativePath = path.relative(basePath, file);
        const fileName = path.basename(file);
        console.log(`Attempting to parse: ${relativePath}`);
        try {
            const content = await fs.readFile(file, 'utf-8');
            const ast = parser.parse(content);

            let currentHeadings = { h1: null, h2: null, h3: null };
            let blockOrder = 0; // Simple counter for ordering blocks within a file

            visit(ast, (node) => {
                // Track current headings
                if (node.type === 'heading') {
                    const headingText = toString(node).trim();
                    if (node.depth === 1) {
                        currentHeadings = { h1: headingText, h2: null, h3: null };
                    } else if (node.depth === 2) {
                        currentHeadings.h2 = headingText;
                        currentHeadings.h3 = null; // Reset lower levels
                    } else if (node.depth === 3) {
                        currentHeadings.h3 = headingText;
                    }
                    // Add more levels if needed
                }

                // Extract content blocks (customize node types as needed)
                const contentNodeTypes = ['paragraph', 'code', 'listItem', 'tableCell', 'blockquote'];
                if (contentNodeTypes.includes(node.type) && node.position) {
                    const extractedText = toString(node).trim();
                    // Skip empty blocks
                    if (!extractedText) return;

                    const lineNumber = node.position.start.line;
                    const language = node.type === 'code' ? node.lang || null : null;

                    markdownData.push({
                        filePath: relativePath,
                        fileName: fileName,
                        heading1: currentHeadings.h1,
                        heading2: currentHeadings.h2,
                        heading3: currentHeadings.h3,
                        contentType: node.type,
                        language: language,
                        content: extractedText,
                        lineNumber: lineNumber,
                        order: blockOrder++, // Store the order
                    });
                }
            });
            console.log(`Successfully parsed: ${relativePath}`);
        } catch (error) {
            console.error(`Failed to parse ${relativePath}:`, error);
        }
    }
    console.log(`Finished parsing Markdown files. Found ${markdownData.length} content blocks.`);
    return markdownData;
}
