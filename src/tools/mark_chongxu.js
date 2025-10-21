const fs = require('fs');
const path = require('path');

function insertMarkersForChongxu(srcPath, destPath) {
  const raw = fs.readFileSync(srcPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const out = [];

  const chapterTitles = new Set([
    '天瑞第一', '黄帝第二', '周穆王第三', '仲尼第四', '汤问第五', '力命第六', '杨朱第七', '说符第八'
  ]);

  let openChapter = false;
  let openVolume = false;
  let bookMarked = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!bookMarked) {
      // At the very beginning, add book marker once, before first non-empty line
      if (trimmed.length) {
        out.push('<<DG_BOOK title="冲虚至德真经">>');
        bookMarked = true;
      }
    }

    // Volume start
    if (trimmed === '冲虚至德真经卷上') {
      if (openChapter) { out.push('<<DG_CHAPTER_END>>'); openChapter = false; }
      if (openVolume) { out.push('<<DG_VOLUME_END title="卷上">>'); openVolume = false; }
      out.push('<<DG_VOLUME_START title="卷上">>');
      openVolume = true;
    } else if (trimmed === '冲虚至德真经卷中') {
      if (openChapter) { out.push('<<DG_CHAPTER_END>>'); openChapter = false; }
      if (openVolume) { out.push('<<DG_VOLUME_END title="卷中">>'); openVolume = false; }
      out.push('<<DG_VOLUME_START title="卷中">>');
      openVolume = true;
    } else if (trimmed === '冲虚至德真经卷下') {
      if (openChapter) { out.push('<<DG_CHAPTER_END>>'); openChapter = false; }
      if (openVolume) { out.push('<<DG_VOLUME_END title="卷下">>'); openVolume = false; }
      out.push('<<DG_VOLUME_START title="卷下">>');
      openVolume = true;
    }

    // Volume end lines
    if (trimmed === '冲虚至德真经卷上竟') {
      if (openChapter) { out.push('<<DG_CHAPTER_END>>'); openChapter = false; }
      if (openVolume) { out.push('<<DG_VOLUME_END title="卷上">>'); openVolume = false; }
    } else if (trimmed === '冲虚至德真经卷中竟') {
      if (openChapter) { out.push('<<DG_CHAPTER_END>>'); openChapter = false; }
      if (openVolume) { out.push('<<DG_VOLUME_END title="卷中">>'); openVolume = false; }
    } else if (trimmed === '冲虚至德真经卷下竟') {
      if (openChapter) { out.push('<<DG_CHAPTER_END>>'); openChapter = false; }
      if (openVolume) { out.push('<<DG_VOLUME_END title="卷下">>'); openVolume = false; }
    }

    // Chapters
    if (chapterTitles.has(trimmed)) {
      if (openChapter) {
        out.push('<<DG_CHAPTER_END>>');
      }
      out.push(`<<DG_CHAPTER title="${trimmed}">>`);
      openChapter = true;
    }

    // Always push the original line
    out.push(line);
  }

  // Close any open markers at EOF
  if (openChapter) out.push('<<DG_CHAPTER_END>>');
  if (openVolume) out.push('<<DG_VOLUME_END title="(自动)">>');

  const outStr = out.join('\n');
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, outStr, 'utf8');
}

if (require.main === module) {
  const src = path.resolve(__dirname, '..', '..', '道藏', '正统道藏洞神部', '本文类', '冲虚至德真经.txt');
  const dest = path.resolve(__dirname, '..', '..', '道藏', '正统道藏洞神部', '本文类', '示例', '冲虚至德真经', '冲虚至德真经_mark.txt');
  insertMarkersForChongxu(src, dest);
  console.log('Generated:', dest);
}
