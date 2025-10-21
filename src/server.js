const path = require('path');
const fs = require('fs');
const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const expressLayouts = require('express-ejs-layouts');

const app = express();
const PORT = process.env.PORT || 3000;

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CONTENT_ROOT = process.env.CONTENT_ROOT
  ? path.resolve(process.env.CONTENT_ROOT)
  : PROJECT_ROOT;

const VALID_CATEGORIES = [
  '儒藏',
  '史藏',
  '子藏',
  '集藏',
  '艺藏',
  '道藏',
  '易藏',
  '诗藏',
  '佛藏',
  '医藏'
];

app.set('views', path.join(__dirname, '..', 'views'));
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layout');

app.use(helmet());
app.use(compression());
app.use(morgan('dev'));
app.use((req, res, next) => {
  res.locals.CATEGORIES = VALID_CATEGORIES;
  next();
});
app.use(express.static(path.join(__dirname, '..', 'public')));

function isSafeSubPath(base, target) {
  const rel = path.relative(base, target);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function listDirectory(absDir) {
  try {
    const entries = fs.readdirSync(absDir, { withFileTypes: true });
    const dirs = [];
    const files = [];
    for (const ent of entries) {
      if (ent.name.startsWith('.')) continue; // skip hidden
      const full = path.join(absDir, ent.name);
      if (ent.isDirectory()) {
        dirs.push({
          name: ent.name,
          size: null,
          mtimeMs: fs.statSync(full).mtimeMs
        });
      } else if (ent.isFile() && /\.txt$/i.test(ent.name)) {
        const st = fs.statSync(full);
        files.push({
          name: ent.name,
          size: st.size,
          mtimeMs: st.mtimeMs
        });
      }
    }
    dirs.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
    files.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
    return { dirs, files };
  } catch (e) {
    return { dirs: [], files: [] };
  }
}

function breadcrumb(category, relPath) {
  const crumbs = [{ label: '首页', href: '/' }];
  if (category) {
    crumbs.push({ label: category, href: `/category/${encodeURIComponent(category)}` });
  }
  if (relPath) {
    const parts = relPath.split('/').filter(Boolean);
    let acc = '';
    for (const p of parts) {
      acc = acc ? `${acc}/${p}` : p;
      crumbs.push({
        label: p,
        href: `/category/${encodeURIComponent(category)}/dir/${encodeURIComponent(acc)}`
      });
    }
  }
  return crumbs;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildContentAndToc(text) {
  const lines = text.split(/\r?\n/);
  const toc = [];
  const out = [];
  const headingRegexes = [
    /(第[一二三四五六七八九十百千〇零两0-9]+[回卷章节篇])/,
    /(卷[一二三四五六七八九十百千〇零两0-9]+)/
  ];
  let idx = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const escaped = escapeHtml(line);
    let isHeading = false;
    let titlePart = '';
    if (trimmed.length && trimmed.length <= 40) {
      for (const r of headingRegexes) {
        const m = trimmed.match(r);
        if (m) { isHeading = true; titlePart = trimmed; break; }
      }
    }
    if (isHeading) {
      const id = 'toc-' + (++idx);
      toc.push({ id, title: titlePart });
      out.push(`<h3 id="${id}" class="chapter-heading">${escaped}</h3>`);
    } else if (trimmed === '') {
      out.push('<p class="gap"></p>');
    } else {
      out.push(`<p>${escaped}</p>`);
    }
  }
  return { html: out.join('\n'), toc };
}

function markdownToHtml(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    if (/^######\s+/.test(line)) out.push('<h6>' + escapeHtml(line.replace(/^######\s+/, '')) + '</h6>');
    else if (/^#####\s+/.test(line)) out.push('<h5>' + escapeHtml(line.replace(/^#####\s+/, '')) + '</h5>');
    else if (/^####\s+/.test(line)) out.push('<h4>' + escapeHtml(line.replace(/^####\s+/, '')) + '</h4>');
    else if (/^###\s+/.test(line)) out.push('<h3>' + escapeHtml(line.replace(/^###\s+/, '')) + '</h3>');
    else if (/^##\s+/.test(line)) out.push('<h2>' + escapeHtml(line.replace(/^##\s+/, '')) + '</h2>');
    else if (/^#\s+/.test(line)) out.push('<h1>' + escapeHtml(line.replace(/^#\s+/, '')) + '</h1>');
    else if (line.trim() === '') out.push('<p class="gap"></p>');
    else out.push('<p>' + escapeHtml(line) + '</p>');
  }
  return out.join('\n');
}

app.get('/', (req, res) => {
  const cats = VALID_CATEGORIES.filter((c) => fs.existsSync(path.join(CONTENT_ROOT, c)))
    .map((c) => {
      const { dirs, files } = listDirectory(path.join(CONTENT_ROOT, c));
      return {
        name: c,
        countDirs: dirs.length,
        countFiles: files.length
      };
    });
  res.render('index', {
    title: '殆知阁古代文献在线检阅',
    categories: cats
  });
});

app.get('/category/:category', (req, res, next) => {
  const category = req.params.category;
  if (!VALID_CATEGORIES.includes(category)) return next();
  const base = path.join(CONTENT_ROOT, category);
  const { dirs, files } = listDirectory(base);
  res.render('list', {
    title: `${category} - 殆知阁古代文献在线检阅` ,
    category,
    relPath: '',
    entries: { dirs, files },
    breadcrumbs: breadcrumb(category, '')
  });
});

app.get('/category/:category/dir/:relPath(*)', (req, res, next) => {
  const category = req.params.category;
  const relPath = req.params.relPath || '';
  if (!VALID_CATEGORIES.includes(category)) return next();
  const base = path.join(CONTENT_ROOT, category);
  const abs = path.join(base, ...relPath.split('/'));
  if (!isSafeSubPath(base, abs) || !fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
    return next();
  }
  const { dirs, files } = listDirectory(abs);
  res.render('list', {
    title: `${category} / ${relPath} - 殆知阁古代文献在线检阅` ,
    category,
    relPath,
    entries: { dirs, files },
    breadcrumbs: breadcrumb(category, relPath)
  });
});

app.get('/file/:category/:relPath(*)', (req, res, next) => {
  const category = req.params.category;
  const relPath = req.params.relPath || '';
  if (!VALID_CATEGORIES.includes(category)) return next();
  const base = path.join(CONTENT_ROOT, category);
  const abs = path.join(base, ...relPath.split('/'));
  if (!isSafeSubPath(base, abs) || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    return next();
  }
  let content;
  try {
    content = fs.readFileSync(abs, { encoding: 'utf8' });
  } catch (e) {
    return next(e);
  }
  const built = buildContentAndToc(content);
  const fileName = path.basename(abs);
  res.render('view', {
    title: `${fileName} - 殆知阁古代文献在线检阅` ,
    category,
    relPath,
    breadcrumbs: breadcrumb(category, path.dirname(relPath) === '.' ? '' : path.dirname(relPath)),
    fileName,
    contentHtml: built.html,
    tocItems: built.toc
  });
});

app.get('/about', (req, res) => {
  let md = '';
  try {
    md = fs.readFileSync(path.join(PROJECT_ROOT, '使用须知.md'), { encoding: 'utf8' });
  } catch (e) {
    md = '# 使用须知\n暂不可用';
  }
  const html = markdownToHtml(md);
  res.render('about', { title: '使用须知 - 殆知阁古代文献在线检阅', contentHtml: html });
});

app.use((req, res) => {
  res.status(404).render('404', { title: '未找到 - 殆知阁古代文献在线检阅' });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Daizhige app listening on http://localhost:${PORT}`);
});
