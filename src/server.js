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
  res.render('view', {
    title: `${path.basename(abs)} - 殆知阁古代文献在线检阅` ,
    category,
    relPath,
    breadcrumbs: breadcrumb(category, path.dirname(relPath) === '.' ? '' : path.dirname(relPath)),
    fileName: path.basename(abs),
    content
  });
});

app.use((req, res) => {
  res.status(404).render('404', { title: '未找到 - 殆知阁古代文献在线检阅' });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Daizhige app listening on http://localhost:${PORT}`);
});
