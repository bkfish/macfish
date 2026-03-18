# macfish

A Hexo theme that renders your local markdown folder as a macOS-style desktop.

## Usage

1. Create a folder structure under `source/_posts/` (folders become Desktop folders):

```
source/_posts/
  Work/
    Roadmap.md
    Meeting-Notes.md
  Life/
    Ideas.md
```

2. Run Hexo as usual:

```
hexo clean
hexo server
```

3. The desktop is the homepage. Folder and file pages are generated under:

```
/desktop/<folder-slug>/
/desktop/<folder-slug>/<file-slug>/
```

You can change the URL prefix and markdown directory in `_config.yml`.

## Notes

- File title is resolved from front matter `title`, then first `# Heading`, then filename.
- Front matter parsing is intentionally minimal (single-line `key: value`).
- For full Hexo posts (tags, categories, etc.), keep using `source/_posts`.
- To customize the desktop background, set `desktop.wallpaper` in `_config.yml` and place the image under `source/`.
