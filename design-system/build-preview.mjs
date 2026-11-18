// Build a portable review artifact; never edits product files or version metadata.
import fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const root=path.dirname(fileURLToPath(import.meta.url))
const read=name=>fs.readFile(path.join(root,name),'utf8')
const [template,tokens,components,icons,script,regular,bold]=await Promise.all([
  read('preview.template.html'),read('tokens.css'),read('components.css'),read('icons.svg'),read('preview.js'),
  fs.readFile(path.join(root,'../platform/public/fonts/Dana-Regular.woff2')),
  fs.readFile(path.join(root,'../platform/public/fonts/Dana-Bold.woff2'))
])
const fonts=[[400,regular],[700,bold]].map(([weight,bytes])=>`@font-face{font-family:Dana;src:url(data:font/woff2;base64,${bytes.toString('base64')}) format('woff2');font-weight:${weight};font-display:swap}`).join('\n')
const sprite=icons.replace('<svg ', '<svg aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden" ')
let html=template
for(const [marker,value]of Object.entries({'/*__FONTS__*/':fonts,'/*__TOKENS__*/':tokens,'/*__COMPONENTS__*/':components,'<!--__ICONS__-->':sprite,'/*__SCRIPT__*/':script})){
  if(!html.includes(marker))throw Error('Missing preview marker: '+marker)
  html=html.replace(marker,()=>value)
}
await fs.writeFile(path.join(root,'preview.html'),html)
console.log('Created design-system/preview.html (standalone; local fonts included)')
