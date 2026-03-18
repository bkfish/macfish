'use strict';

const fs = require('fs');
const path = require('path');

function registerDesktop(hexo) {
  if (!hexo || hexo.__mac_desktop_registered) return;
  hexo.__mac_desktop_registered = true;

  let desktopData = { folders: [] };

  function ensureSkipRender(patterns) {
    if (!patterns || !patterns.length) return;
    let current = hexo.config.skip_render;
    if (!current) current = [];
    if (!Array.isArray(current)) current = [current];

    const set = new Set(current);
    patterns.forEach((pattern) => set.add(pattern));
    hexo.config.skip_render = Array.from(set);
  }

  // Serve local tools/media as static assets.
  ensureSkipRender(['fun/**', 'shell/**', 'music/**']);

  function normalizePart(part) {
    return String(part || '').replace(/^\/+|\/+$/g, '');
  }

  function normalizeRelPath(input) {
    return String(input || '').replace(/\\/g, '/').replace(/^\/+/, '');
  }

  function joinUrl() {
    const parts = Array.prototype.slice.call(arguments)
      .map(normalizePart)
      .filter(Boolean);
    if (parts.length === 0) return '/';
    return '/' + parts.join('/') + '/';
  }

  function slugify(input) {
    const str = String(input || '')
      .trim()
      .toLowerCase();

    const cleaned = str
      .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    return cleaned || 'item';
  }

  function parseFrontMatter(text) {
    if (!text || text.indexOf('---') !== 0) {
      return { data: {}, body: text || '' };
    }

    const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
    if (!match) {
      return { data: {}, body: text };
    }

    const fmText = match[1];
    const body = text.slice(match[0].length);
    const data = {};

    fmText.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.+)\s*$/);
      if (m) data[m[1]] = m[2];
    });

    return { data, body };
  }

  function extractTitle(data, body, filename) {
    if (data && data.title) return String(data.title).trim();
    const heading = body.match(/^#\s+(.+)$/m);
    if (heading) return heading[1].trim();
    return filename;
  }

  function readMarkdownMeta(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = parseFrontMatter(raw);
    const body = parsed.body || '';
    const title = extractTitle(parsed.data, body, path.basename(filePath, path.extname(filePath)));

    return {
      title,
      body,
      data: parsed.data || {}
    };
  }

  function renderMarkdownFile(filePath) {
    const meta = readMarkdownMeta(filePath);
    const html = hexo.render.renderSync({ text: meta.body || '', engine: 'markdown' });
    return {
      title: meta.title,
      html,
      data: meta.data || {}
    };
  }

  function getConfig() {
    const themeConfig = hexo.theme.config || {};
    const desktopConfig = themeConfig.desktop || {};
    const markdownDir = desktopConfig.markdown_dir || 'markdown';
    const routePrefix = normalizePart(desktopConfig.route_prefix || 'desktop');
    const showEmpty = desktopConfig.show_empty_folders !== false;
    const sort = desktopConfig.sort || 'name';
    const musicDir = normalizePart(desktopConfig.music_dir || 'music');
    const groupBy = desktopConfig.group_by || 'tags';

    return { markdownDir, routePrefix, showEmpty, sort, musicDir, groupBy };
  }

  function sortByName(a, b) {
    return a.name.localeCompare(b.name, 'zh-Hans-CN', { sensitivity: 'base' });
  }

  function sortByUpdated(a, b) {
    return (b.updated || 0) - (a.updated || 0);
  }

  function buildPostMap() {
    const posts = hexo.locals && hexo.locals.get ? hexo.locals.get('posts') : null;
    if (!posts) return new Map();
    const list = typeof posts.toArray === 'function' ? posts.toArray() : posts;
    const map = new Map();
    list.forEach((post) => {
      const source = normalizeRelPath(post.source || post.path || '');
      if (source) map.set(source, post);
      const fullSource = normalizeRelPath(post.full_source || '');
      if (fullSource) map.set(fullSource, post);
    });
    return map;
  }

  function extractTagsFromPost(post) {
    if (!post) return [];
    let tags = [];
    if (post.tags) {
      if (typeof post.tags.toArray === 'function') {
        tags = post.tags.toArray().map((tag) => tag && tag.name);
      } else if (Array.isArray(post.tags)) {
        tags = post.tags.map((tag) => (tag && tag.name) ? tag.name : tag);
      } else if (typeof post.tags === 'string') {
        tags = [post.tags];
      }
    }

    const expanded = [];
    tags.forEach((tag) => {
      if (!tag) return;
      const str = String(tag).trim();
      if (!str) return;
      if (str.indexOf(',') !== -1) {
        str.split(',').forEach((part) => {
          const clean = String(part || '').trim();
          if (clean) expanded.push(clean);
        });
      } else {
        expanded.push(str);
      }
    });

    const seen = new Set();
    return expanded.filter((tag) => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function scanMarkdownByTags(cfg) {
    const posts = hexo.locals && hexo.locals.get ? hexo.locals.get('posts') : null;
    const list = posts ? (typeof posts.toArray === 'function' ? posts.toArray() : posts) : [];
    const foldersMap = new Map();

    list.forEach((post) => {
      const tags = extractTagsFromPost(post);
      if (!tags.length) return;

      const updated = post && post.updated ? post.updated.valueOf() : (post && post.date ? post.date.valueOf() : 0);
      const title = post && post.title ? post.title : (post && post.slug ? post.slug : 'Untitled');
      const postPath = post && post.path ? post.path : '';

      tags.forEach((tag) => {
        const folderName = tag;
        const folderSlug = slugify(folderName);
        let folder = foldersMap.get(folderName);
        if (!folder) {
          folder = {
            name: folderName,
            slug: folderSlug,
            url: joinUrl(cfg.routePrefix, folderSlug),
            updated: 0,
            files: []
          };
          foldersMap.set(folderName, folder);
        }

        const fileSlug = slugify(post && post.slug ? post.slug : title);
        const fileUrl = postPath || joinUrl(cfg.routePrefix, folderSlug, fileSlug);

        folder.files.push({
          name: title,
          slug: fileSlug,
          title,
          url: fileUrl,
          updated,
          post_path: postPath
        });

        if (updated > folder.updated) folder.updated = updated;
      });
    });

    const folders = Array.from(foldersMap.values());
    const sortFn = cfg.sort === 'updated' ? sortByUpdated : sortByName;

    folders.sort(sortFn);
    folders.forEach((folder) => folder.files.sort(sortFn));

    const debug = {
      mode: 'tags',
      routePrefix: cfg.routePrefix,
      showEmpty: cfg.showEmpty,
      sort: cfg.sort,
      total: folders.length
    };

    return { folders, debug };
  }

  function scanMarkdownByFolder(cfg) {
    const sourceRoot = hexo.source_dir;
    const markdownRoot = path.join(sourceRoot, cfg.markdownDir);
    const postMap = buildPostMap();
    const debug = {
      markdownRoot,
      markdownDir: cfg.markdownDir,
      routePrefix: cfg.routePrefix,
      showEmpty: cfg.showEmpty,
      sort: cfg.sort,
      exists: false,
      entries: []
    };

    if (!fs.existsSync(markdownRoot)) {
      return { folders: [], debug };
    }

    const entries = fs.readdirSync(markdownRoot, { withFileTypes: true });
    debug.exists = true;
    debug.entries = entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory()
    }));
    const folders = [];

    entries.forEach((entry) => {
      if (!entry.isDirectory()) return;

      const folderName = entry.name;
      const folderPath = path.join(markdownRoot, folderName);
      const folderSlug = slugify(folderName);
      const folderUrl = joinUrl(cfg.routePrefix, folderSlug);

      const fileEntries = fs.readdirSync(folderPath, { withFileTypes: true })
        .filter((file) => file.isFile())
        .filter((file) => /\.(md|markdown)$/i.test(file.name));

      const files = fileEntries.map((fileEntry) => {
        const fullPath = path.join(folderPath, fileEntry.name);
        const stats = fs.statSync(fullPath);
        const fileName = path.basename(fileEntry.name, path.extname(fileEntry.name));
        const fileSlug = slugify(fileName);
        const url = joinUrl(cfg.routePrefix, folderSlug, fileSlug);
        const relPath = normalizeRelPath(path.relative(sourceRoot, fullPath));
        const absPath = normalizeRelPath(fullPath);
        const post = postMap.get(relPath) || postMap.get(absPath);
        let title = fileName;
        if (post && post.title) {
          title = post.title;
        } else {
          const meta = readMarkdownMeta(fullPath);
          title = meta.title;
        }
        const postPath = post && post.path ? post.path : '';
        const updated = post && post.updated ? post.updated.valueOf() : stats.mtimeMs;

        return {
          name: fileName,
          slug: fileSlug,
          title,
          url,
          updated,
          post_path: postPath,
          source_path: relPath
        };
      });

      if (!cfg.showEmpty && files.length === 0) return;

      const updated = files.reduce((acc, file) => Math.max(acc, file.updated || 0), 0);

      folders.push({
        name: folderName,
        slug: folderSlug,
        url: folderUrl,
        updated,
        files
      });
    });

    const sortFn = cfg.sort === 'updated' ? sortByUpdated : sortByName;

    folders.sort(sortFn);
    folders.forEach((folder) => folder.files.sort(sortFn));

    return { folders, debug };
  }

  function scanMarkdown() {
    const cfg = getConfig();
    if (cfg.groupBy === 'tags') {
      return scanMarkdownByTags(cfg);
    }
    return scanMarkdownByFolder(cfg);
  }

  function scanTools() {
    const sourceRoot = hexo.source_dir;
    const funRoot = path.join(sourceRoot, 'fun');
    if (!fs.existsSync(funRoot)) return [];

    const entries = fs.readdirSync(funRoot, { withFileTypes: true });
    const tools = [];

    entries.forEach((entry) => {
      if (!entry.isDirectory()) return;
      const folderName = entry.name;
      const indexHtml = path.join(funRoot, folderName, 'index.html');
      const indexHtm = path.join(funRoot, folderName, 'index.htm');
      const hasIndex = fs.existsSync(indexHtml) || fs.existsSync(indexHtm);
      if (!hasIndex) return;

      tools.push({
        name: folderName,
        id: slugify(folderName),
        path: `fun/${folderName}/index.html`
      });
    });

    return tools;
  }

  function scanMusic() {
    const cfg = getConfig();
    const sourceRoot = hexo.source_dir;
    const musicRoot = path.join(sourceRoot, cfg.musicDir);
    if (!fs.existsSync(musicRoot)) return [];

    const entries = fs.readdirSync(musicRoot, { withFileTypes: true });
    const tracks = entries
      .filter((entry) => entry.isFile() && /\.mp3$/i.test(entry.name))
      .map((entry) => {
        const filename = entry.name;
        const name = filename.replace(/\.mp3$/i, '');
        return {
          name,
          title: name,
          path: `${cfg.musicDir}/${filename}`,
          id: slugify(name)
        };
      });

    tracks.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN', { sensitivity: 'base' }));
    return tracks;
  }

  function buildRoutes(data) {
    const routes = [];

    data.folders.forEach((folder) => {
      routes.push({
        path: folder.url.replace(/^\//, ''),
        layout: ['folder'],
        data: {
          title: folder.name,
          folder
        }
      });

      folder.files.forEach((file) => {
        if (!file.post_path) {
          let content = '';
          const sourcePath = file.source_path ? path.join(hexo.source_dir, file.source_path) : '';
          if (sourcePath && fs.existsSync(sourcePath)) {
            content = renderMarkdownFile(sourcePath).html;
          }

          routes.push({
            path: file.url.replace(/^\//, ''),
            layout: ['file'],
            data: {
              title: file.title,
              content,
              folder,
              file
            }
          });
        }
      });
    });

    return routes;
  }

  hexo.extend.filter.register('before_generate', () => {
    const result = scanMarkdown();
    desktopData = { folders: result.folders };
    hexo.locals.set('mac_desktop', desktopData);
    hexo.locals.set('mac_desktop_debug', result.debug);
    hexo.locals.set('mac_tools', scanTools());
    hexo.locals.set('mac_music', scanMusic());
  });

  hexo.extend.generator.register('mac-desktop-pages', () => {
    return buildRoutes(desktopData);
  });

  hexo.extend.generator.register('mac-search-index', () => {
    const posts = hexo.locals && hexo.locals.get ? hexo.locals.get('posts') : null;
    const list = posts ? (typeof posts.toArray === 'function' ? posts.toArray() : posts) : [];
    const items = list.map((post) => {
      const tags = extractTagsFromPost(post);
      const folder = tags.length ? tags.join(', ') : '';
      return {
        title: post.title || post.slug || 'Untitled',
        path: post.path || '',
        date: post.date ? post.date.valueOf() : 0,
        folder
      };
    }).filter((item) => item.path);

    items.sort((a, b) => (b.date || 0) - (a.date || 0));

    return {
      path: 'mac-search.json',
      data: JSON.stringify(items),
      layout: false
    };
  });
}

if (typeof hexo !== 'undefined') {
  registerDesktop(hexo);
}

module.exports = registerDesktop;
