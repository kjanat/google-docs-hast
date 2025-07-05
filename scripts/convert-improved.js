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

// Smart markdown conversion with structure preservation
function convertToMarkdown(tree) {
  // First, pre-process the tree to handle unsupported elements
  const cleanTree = JSON.parse(JSON.stringify(tree)) // Deep clone
  
  visit(cleanTree, (node, index, parent) => {
    if (node.type === 'element') {
      switch (node.tagName) {
        case 's':
          // Convert strikethrough to markdown
          if (node.children && node.children[0]?.type === 'text') {
            node.children[0].value = `~~${node.children[0].value}~~`
            node.tagName = 'span'
          }
          break
          
        case 'table':
          // Convert table to simple markdown table
          const tableMarkdown = convertTableToMarkdown(node)
          if (parent && typeof index === 'number') {
            parent.children[index] = {
              type: 'text',
              value: `\n\n${tableMarkdown}\n\n`
            }
          }
          break
          
        case 'u':
          // Underline not supported in markdown - keep as text
          node.tagName = 'span'
          break
          
        case 'sub':
        case 'sup':
          // Sub/superscript not well supported - keep as text
          node.tagName = 'span'
          break
          
        case 'span':
          // Handle complex styled spans
          if (node.properties?.style) {
            const style = node.properties.style
            // Try to extract basic formatting
            if (style.includes('font-weight: bold') || style.includes('font-weight: 700')) {
              node.tagName = 'strong'
              delete node.properties.style
            } else if (style.includes('font-style: italic')) {
              node.tagName = 'em'
              delete node.properties.style
            } else {
              // Keep as span but remove complex styling
              delete node.properties.style
            }
          }
          break
      }
    }
  })
  
  // Try conversion with cleaned tree
  try {
    const mdast = toMdast(cleanTree)
    return unified()
      .use(remarkStringify, {
        bullet: '-',
        fences: true,
        incrementListMarker: true
      })
      .stringify(mdast)
  } catch (error) {
    console.warn('Warning: Full markdown conversion still failed, using enhanced text extraction')
    console.warn('Error:', error.message)
    
    // Enhanced fallback with structure preservation
    return extractStructuredMarkdown(tree)
  }
}

// Convert HTML table to markdown table
function convertTableToMarkdown(tableNode) {
  const rows = []
  
  visit(tableNode, (node) => {
    if (node.type === 'element' && node.tagName === 'tr') {
      const cells = []
      visit(node, (cellNode) => {
        if (cellNode.type === 'element' && (cellNode.tagName === 'td' || cellNode.tagName === 'th')) {
          // Extract text from cell
          let cellText = ''
          visit(cellNode, (textNode) => {
            if (textNode.type === 'text') {
              cellText += textNode.value
            }
          })
          cells.push(cellText.trim() || ' ')
        }
      })
      if (cells.length > 0) {
        rows.push(cells)
      }
    }
  })
  
  if (rows.length === 0) return '[Empty Table]'
  
  // Create markdown table
  const maxCols = Math.max(...rows.map(row => row.length))
  const header = rows[0].map(cell => cell || 'Column').slice(0, maxCols)
  const separator = Array(maxCols).fill('---')
  
  let markdown = `| ${header.join(' | ')} |\n`
  markdown += `| ${separator.join(' | ')} |\n`
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i].slice(0, maxCols)
    while (row.length < maxCols) row.push('')
    markdown += `| ${row.join(' | ')} |\n`
  }
  
  return markdown
}

// Enhanced text extraction with structure
function extractStructuredMarkdown(tree) {
  let markdown = ''
  let currentSection = ''
  
  visit(tree, (node) => {
    if (node.type === 'element') {
      switch (node.tagName) {
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
          const level = parseInt(node.tagName[1])
          const headerText = extractText(node)
          if (headerText.trim()) {
            markdown += `\n${'#'.repeat(level)} ${headerText.trim()}\n\n`
          }
          break
          
        case 'p':
          const paragraphText = extractText(node)
          if (paragraphText.trim()) {
            markdown += `${paragraphText.trim()}\n\n`
          }
          break
          
        case 'ul':
        case 'ol':
          const listMarkdown = extractList(node, node.tagName === 'ol')
          if (listMarkdown) {
            markdown += `${listMarkdown}\n\n`
          }
          break
          
        case 'table':
          const tableMarkdown = convertTableToMarkdown(node)
          markdown += `${tableMarkdown}\n\n`
          break
      }
    }
  })
  
  return markdown.trim()
}

// Extract text from node
function extractText(node) {
  let text = ''
  visit(node, (textNode) => {
    if (textNode.type === 'text') {
      text += textNode.value
    }
  })
  return text
}

// Extract list structure
function extractList(listNode, isOrdered = false, level = 0) {
  let markdown = ''
  let itemIndex = 1
  
  visit(listNode, (node, index, parent) => {
    if (node.type === 'element' && node.tagName === 'li' && parent === listNode) {
      const indent = '  '.repeat(level)
      const bullet = isOrdered ? `${itemIndex}.` : '-'
      const itemText = extractText(node)
      
      if (itemText.trim()) {
        markdown += `${indent}${bullet} ${itemText.trim()}\n`
        itemIndex++
      }
      
      // Handle nested lists
      visit(node, (nestedNode) => {
        if (nestedNode.type === 'element' && (nestedNode.tagName === 'ul' || nestedNode.tagName === 'ol')) {
          const nestedMarkdown = extractList(nestedNode, nestedNode.tagName === 'ol', level + 1)
          markdown += nestedMarkdown
        }
      })
    }
  })
  
  return markdown
}

async function convert() {
  try {
    // Read and parse Google Docs JSON
    const docData = JSON.parse(fs.readFileSync(inputFile, 'utf8'))
    
    // Convert to HAST
    const tree = toHast(docData)
    
    let output
    
    if (format === 'html') {
      // Convert to HTML
      output = unified()
        .use(rehypeStringify, { collapseEmptyAttributes: true })
        .stringify(tree)
    } else if (format === 'md') {
      // Convert to Markdown with improved strategy
      output = convertToMarkdown(tree)
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