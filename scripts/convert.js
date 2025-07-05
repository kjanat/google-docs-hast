#!/usr/bin/env node

import fs from 'fs'
import { unified } from 'unified'
import rehypeStringify from 'rehype-stringify'
import { toHast } from '../dist/index.js'
import { visit } from 'unist-util-visit'

// For markdown conversion
import { toMdast } from 'hast-util-to-mdast'
import remarkStringify from 'remark-stringify'

const [,, format, inputFile, outputFile] = process.argv

if (!format || !inputFile || !outputFile) {
  console.error('Usage: node convert.js <format> <input_file> <output_file>')
  console.error('Format: html or md')
  process.exit(1)
}

async function convert() {
try {
  // Read and parse Google Docs JSON
  const docData = JSON.parse(fs.readFileSync(inputFile, 'utf8'))

  // Convert to HAST
  const tree = toHast(docData)

  // Clean tree for markdown conversion by removing problematic nodes
  if (format === 'md') {
    visit(tree, (node, index, parent) => {
      // Convert unsupported elements that cause markdown conversion issues
      if (node.type === 'element' && ['s', 'del', 'delete'].includes(node.tagName)) {
        // Convert strikethrough to ~~text~~ by wrapping children
        if (parent && typeof index === 'number') {
          const textContent = node.children.map(child => 
            child.type === 'text' ? child.value : ''
          ).join('')
          
          // Replace with text node with markdown strikethrough
          parent.children[index] = {
            type: 'text',
            value: `~~${textContent}~~`
          }
        }
      }
    })
  }

  let output

  if (format === 'html') {
    // Convert to HTML
    output = unified()
      .use(rehypeStringify, { collapseEmptyAttributes: true })
      .stringify(tree)
  } else if (format === 'md') {
    // Convert to Markdown with fallback to text extraction
    try {
      const mdast = toMdast(tree)
      output = unified()
        .use(remarkStringify)
        .stringify(mdast)
    } catch (mdError) {
      console.warn('Warning: Full markdown conversion failed, extracting text content instead')
      console.warn('Error:', mdError.message)
      
      // Fallback: extract text content and basic structure
      const { toString } = await import('hast-util-to-string')
      let textContent = toString(tree)
      
      // Add some basic markdown structure
      textContent = textContent
        .replace(/^(.*?)$/gm, (match) => {
          // Simple heuristic for headers (lines that are short and likely titles)
          if (match.length < 50 && /^[A-Z]/.test(match.trim()) && !/[.!?]$/.test(match.trim())) {
            return `# ${match.trim()}`
          }
          return match
        })
      
      output = textContent
    }
  } else {
    throw new Error(`Unsupported format: ${format}`)
  }

  // Write output
  fs.writeFileSync(outputFile, output)
  console.log(`✓ Converted ${inputFile} to ${format.toUpperCase()}`)
  console.log(`✓ Output saved to ${outputFile}`)
} catch (error) {
  console.error('Error during conversion:', error.message)
  process.exit(1)
}
}

// Run the conversion
convert()
