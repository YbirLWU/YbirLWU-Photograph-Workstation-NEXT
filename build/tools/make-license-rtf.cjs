const fs = require('fs')
const path = require('path')

const src = fs.readFileSync('build/license_zh_CN.txt', 'utf8').replace(/^\uFEFF/, '')
const lines = src.split(/\r?\n/).filter((l) => l.trim() !== '')

function rtfEscape(text) {
  let out = ''
  for (const ch of text) {
    const code = ch.codePointAt(0)
    if (ch === '\\' || ch === '{' || ch === '}') {
      out += '\\' + ch
    } else if (code < 128) {
      out += ch
    } else {
      const signed = code > 32767 ? code - 65536 : code
      out += `\\u${signed}?`
    }
  }
  return out
}

const C = {
  title: '\\cb1\\cf2 ',
  heading: '\\cb1\\cf3 ',
  body: '\\cb1\\cf4 ',
  foot: '\\cb1\\cf5 ',
}

const blocks = []
for (const raw of lines) {
  const line = raw.trimEnd()
  if (/^\d+\.\s/.test(line.trim())) {
    blocks.push({ kind: 'heading', text: line.trim() })
  } else if (/^[\s　]/.test(line)) {
    const prev = blocks[blocks.length - 1]
    if (prev && prev.kind === 'heading') {
      blocks.push({ kind: 'body', text: line.trim() })
    } else if (prev && prev.kind === 'body') {
      prev.text += line.trim()
    } else {
      blocks.push({ kind: 'body', text: line.trim() })
    }
  } else if (blocks.length && blocks[blocks.length - 1].kind === 'foot') {
    blocks[blocks.length - 1].text += '　' + line.trim()
  } else if (blocks.some((b) => b.kind === 'heading' || b.kind === 'body')) {
    blocks.push({ kind: 'foot', text: line.trim() })
  } else {
    blocks.push({ kind: 'title', text: line.trim() })
  }
}

let body = ''
for (const b of blocks) {
  const color = C[b.kind] || C.body
  const size = b.kind === 'title' ? '\\fs23' : b.kind === 'foot' ? '\\fs17' : b.kind === 'heading' ? '\\fs19' : '\\fs18'
  const bold = b.kind === 'title' || b.kind === 'heading' ? '\\b ' : ''
  const boldEnd = bold ? '\\b0 ' : ''
  const spacing = b.kind === 'title' ? '\\sa200' : b.kind === 'heading' ? '\\sa60' : '\\sa140'
  body += `{\\pard\\f0${size}${color}${bold}${spacing}\\sl276\\slmult1 ${rtfEscape(b.text)}${boldEnd}\\par}\n`
}

const rtf =
  '{\\rtf1\\ansi\\deff0\\uc1\n' +
  '{\\fonttbl{\\f0\\fnil\\fcharset134 Microsoft YaHei UI;}{\\f1\\fnil\\fcharset134 Microsoft YaHei;}}\n' +
  '{\\colortbl;\n' +
  '\\red255\\green255\\blue255;\n' +
  '\\red17\\green24\\blue39;\n' +
  '\\red31\\green78\\blue178;\n' +
  '\\red51\\green58\\blue70;\n' +
  '\\red124\\green132\\blue146;\n' +
  '}\n' +
  '\\viewkind4\\uc1\n' +
  body +
  '}'

fs.writeFileSync('build/license_zh_CN.rtf', rtf, 'utf8')
console.log('written build/license_zh_CN.rtf', rtf.length, 'chars,', blocks.length, 'blocks')
for (const b of blocks) console.log(' -', b.kind, ':', b.text.slice(0, 30))
