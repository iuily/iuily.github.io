(() => {
  'use strict';

  const STORAGE_KEY = 'jianghu-studio-draft-v1';
  const ASSIGNMENT_PREFIX = 'window.SITE_CONTENT = ';
  const MAX_ITEMS = 200;
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const ARRAY_FIELDS = new Set(['tags', 'interests', 'tools']);
  const $ = (id) => document.getElementById(id);
  const fallback = {
    profile: { name: '君', handle: 'INKVERSE', tagline: '创作与记录。', intro: '在这里，写下你的故事。', about: '', interests: [], tools: [], email: '', github: '', vrchatName: '', vrchat: '', social: '', socialLabel: '', steamFriendCode: '', qq: '' },
    works: [], posts: []
  };
  let currentTab = 'profile';
  let selectedId = null;
  let dirty = false;
  let data;
  let published;

  function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function string(value, label, max, required = false) {
    if (typeof value !== 'string') throw new Error(`${label}需要填写文字。`);
    const result = value.replace(/\r\n?/g, '\n');
    if (result.length > max) throw new Error(`${label}不能超过 ${max} 个字符。`);
    if (required && !result.trim()) throw new Error(`请填写${label}。`);
    return result;
  }

  function link(value, label) {
    const result = string(value, label, 2000).trim();
    if (!result) return '';
    let parsed;
    try { parsed = new URL(result); } catch { throw new Error(`${label}请填写以 https:// 或 http:// 开头的完整网址。`); }
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) {
      throw new Error(`${label}请填写以 https:// 或 http:// 开头的普通网址。`);
    }
    return result;
  }

  function imagePath(value) {
    const result = string(value, '作品图片', 2000).trim();
    if (!result) return '';
    if (result.startsWith('./assets/')) {
      const path = result.slice('./assets/'.length);
      if (!path || !/^[a-zA-Z0-9_\-./%\u0080-\uffff ]+$/.test(path) || path.includes('..') || path.split('/').some((part) => !part || part === '.')) {
        throw new Error('图片路径请填写 ./assets/图片文件名；文件名使用中文、字母、数字、短横线或下划线，避免括号和特殊符号。');
      }
      return result;
    }
    return link(result, '作品图片');
  }

  function tags(value, label) {
    if (!Array.isArray(value) || value.length > 12) throw new Error(`${label}最多填写 12 个标签。`);
    return [...new Set(value.map((tag) => string(tag, label, 30, true).trim()))];
  }

  function digits(value, label) {
    const result = string(value === undefined ? '' : value, label, 20).trim();
    if (result && !/^\d+$/.test(result)) throw new Error(`${label}只能填写数字，最多 20 位；也可以留空。`);
    return result;
  }

  function date(value) {
    const result = string(value, '文章日期', 10, true);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new Error('文章日期请使用“年-月-日”格式。');
    const parsed = new Date(`${result}T12:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== result) throw new Error('请填写有效的文章日期。');
    return result;
  }

  // Only copy the documented fields. Parsed objects and unknown keys never enter site data.
  function validateContent(value) {
    if (!isRecord(value) || !isRecord(value.profile)) throw new Error('文件中需要包含 profile、works 和 posts 三部分。');
    const p = value.profile;
    const email = string(p.email, '联系邮箱', 254).trim();
    if (email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) throw new Error('请填写有效的联系邮箱，或留空。');
    const profile = {
      name: string(p.name, '显示名称', 50, true),
      handle: string(p.handle === undefined ? '' : p.handle, '英文名称 / 账号名', 80),
      tagline: string(p.tagline, '一句话介绍', 200),
      intro: string(p.intro, '首页简介', 1000),
      about: string(p.about, '关于自己', 8000),
      interests: tags(p.interests === undefined ? [] : p.interests, '兴趣方向'),
      tools: tags(p.tools === undefined ? [] : p.tools, '常用工具'),
      email,
      github: link(p.github, 'GitHub 主页'),
      vrchatName: string(p.vrchatName === undefined ? '' : p.vrchatName, 'VRChat 名称', 80),
      vrchat: link(p.vrchat === undefined ? '' : p.vrchat, 'VRChat 主页'),
      social: link(p.social === undefined ? '' : p.social, '其他社交主页'),
      socialLabel: string(p.socialLabel === undefined ? '' : p.socialLabel, '社交平台名称', 50),
      steamFriendCode: digits(p.steamFriendCode, 'Steam 好友码'),
      qq: digits(p.qq, 'QQ 号')
    };
    const ids = new Set();
    function items(key) {
      if (!Array.isArray(value[key]) || value[key].length > MAX_ITEMS) throw new Error(`作品和文章各最多保存 ${MAX_ITEMS} 项。`);
      return value[key].map((item, index) => {
        const label = `${key === 'works' ? '作品' : '文章'} ${index + 1}`;
        if (!isRecord(item)) throw new Error(`${label}格式不正确。`);
        const id = string(item.id, `${label}编号`, 120, true);
        if (!/^[a-zA-Z0-9_-]+$/.test(id) || ids.has(id)) throw new Error(`${label}编号含特殊字符或与其他内容重复。`);
        ids.add(id);
        if (key === 'works') return {
          id, title: string(item.title, '作品标题', 100, true),
          category: string(item.category, '作品分类', 40), year: string(item.year, '作品年份', 12),
          status: string(item.status === undefined ? '' : item.status, '项目状态', 80),
          contribution: string(item.contribution === undefined ? '' : item.contribution, '参与方式', 160),
          summary: string(item.summary, '作品简介', 1000), body: string(item.body, '作品正文', 30000),
          image: imagePath(item.image), url: link(item.url, '作品外链'), tags: tags(item.tags, '作品标签')
        };
        return {
          id, title: string(item.title, '文章标题', 100, true),
          category: string(item.category, '文章分类', 40), date: date(item.date),
          excerpt: string(item.excerpt, '文章摘要', 1000), body: string(item.body, '文章正文', 50000),
          tags: tags(item.tags, '文章标签')
        };
      });
    }
    return { profile, works: items('works'), posts: items('posts') };
  }

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function setStatus(message, error = false) {
    const node = $('status');
    node.textContent = message;
    node.classList.toggle('error', error);
  }

  function markDirty(value = true) {
    dirty = value;
    $('save-state').textContent = value ? '有未保存的改动' : '草稿已保存';
    $('save-state').classList.toggle('dirty', value);
  }

  function field(key, label, options = {}) {
    const outer = document.createElement('div');
    outer.className = `field${options.full ? ' full' : ''}`;
    const id = `field-${key}`;
    const labelNode = document.createElement('label');
    labelNode.htmlFor = id;
    labelNode.textContent = label;
    if (options.required) {
      const required = document.createElement('span');
      required.className = 'required'; required.textContent = '必填';
      labelNode.append(required);
    }
    const input = document.createElement(options.textarea ? 'textarea' : 'input');
    input.id = id; input.name = key;
    if (!options.textarea) input.type = options.type || 'text';
    if (options.long) input.className = 'long-body';
    input.value = options.value ?? '';
    if (options.max) input.maxLength = options.max;
    if (options.required) input.required = true;
    if (options.placeholder) input.placeholder = options.placeholder;
    if (options.type === 'url') input.autocomplete = 'url';
    if (options.type === 'email') input.autocomplete = 'email';
    if (options.inputMode) input.inputMode = options.inputMode;
    outer.append(labelNode, input);
    if (options.help) {
      const help = document.createElement('p'); help.id = `${id}-help`; help.className = 'field-help'; help.textContent = options.help;
      input.setAttribute('aria-describedby', help.id); outer.append(help);
    }
    return outer;
  }

  function selectedItem() { return currentTab === 'profile' ? data.profile : data[currentTab].find((item) => item.id === selectedId); }

  function renderForm() {
    const form = $('editor-form');
    form.replaceChildren();
    const item = selectedItem();
    const isProfile = currentTab === 'profile';
    const isWork = currentTab === 'works';
    $('delete-button').hidden = isProfile || !item;
    $('empty-state').hidden = !!item;
    form.hidden = !item;
    $('editor-title').textContent = isProfile ? '关于自己' : (item ? item.title : '添加内容');
    $('editor-kicker').textContent = isProfile ? '个人资料' : isWork ? '作品内容' : '文章内容';
    if (!item) return;
    const grid = document.createElement('div'); grid.className = 'form-grid';
    const add = (key, label, options = {}) => grid.append(field(key, label, { ...options, value: ARRAY_FIELDS.has(key) ? item[key].join('，') : item[key] }));
    if (isProfile) {
      add('name', '显示名称', { max: 50, required: true, placeholder: '君' });
      add('handle', '英文名称 / 账号名', { max: 80, placeholder: 'INKVERSE' });
      add('tagline', '一句话介绍', { max: 200, full: true, placeholder: '写下一句介绍自己的话。' });
      add('intro', '首页简介', { max: 1000, textarea: true, full: true, help: '放在首页最醒目的地方，简短介绍你正在做的事。' });
      add('about', '关于自己', { max: 8000, textarea: true, full: true, help: '写下你的经历、兴趣和想分享的故事。按回车可以分段。' });
      add('interests', '兴趣方向', { max: 400, placeholder: 'VRChat，游戏，AI', help: '用中文或英文逗号分隔；最多 12 项，每项不超过 30 字。' });
      add('tools', '常用工具', { max: 400, placeholder: 'Unity，Blender，Python', help: '用中文或英文逗号分隔；最多 12 项，每项不超过 30 字。' });
      add('email', '联系邮箱', { max: 254, type: 'email', placeholder: '留空也可以' });
      add('github', 'GitHub 主页', { max: 2000, type: 'url', placeholder: 'https://github.com/你的用户名' });
      add('vrchatName', 'VRChat 名称', { max: 80, full: true, placeholder: 'INKVERSE', help: '可只填写名称；没有主页网址时，访客可复制名称。' });
      add('vrchat', 'VRChat 主页', { max: 2000, type: 'url', full: true, placeholder: 'https://vrchat.com/home/user/…', help: '填写完整网址，留空则不展示。' });
      add('socialLabel', '其他社交平台名称', { max: 50, placeholder: '如：哔哩哔哩' });
      add('social', '其他社交主页', { max: 2000, type: 'url', placeholder: 'https://…', help: '填写完整网址，留空则不展示。' });
      add('steamFriendCode', 'Steam 好友码', { max: 20, inputMode: 'numeric', help: '只填写数字；留空则不展示。' });
      add('qq', 'QQ 号', { max: 20, inputMode: 'numeric', help: '只填写数字；留空则不展示。' });
    } else {
      add('title', isWork ? '作品标题' : '文章标题', { max: 100, required: true, full: true });
      add('category', '分类', { max: 40, placeholder: isWork ? '如：设计 / 摄影 / 开发' : '如：随笔 / 见闻 / 手记' });
      if (isWork) add('year', '年份', { max: 12, placeholder: '2026' });
      else add('date', '日期', { type: 'date', required: true });
      if (isWork) {
        add('status', '项目状态', { max: 80, placeholder: '如：持续维护 / 已完成' });
        add('contribution', '参与方式', { max: 160, placeholder: '如：现有模型适配 / 个人工具 · AI 辅助', help: '简短说明你实际完成的工作或参与方式。' });
      }
      add(isWork ? 'summary' : 'excerpt', isWork ? '作品简介' : '文章摘要', { max: 1000, textarea: true, full: true, help: '显示在列表卡片上，几句话就好。' });
      add('body', isWork ? '作品详述' : '文章正文', { max: isWork ? 30000 : 50000, textarea: true, full: true, long: true, help: '直接写文字即可，按回车分段。内容会作为文字安全展示。' });
      if (isWork) {
        add('image', '封面图片', { max: 2000, full: true, placeholder: '可留空；有真实截图后再添加', help: '留空时使用项目文字排版封面。添加真实截图时，填写 ./assets/图片文件名 或完整的 http(s) 图片网址；文件名避免括号与特殊符号。' });
        add('url', '作品外链', { max: 2000, type: 'url', full: true, placeholder: 'https://…', help: '可选。填写可访问的项目、视频或作品网址。' });
      }
      add('tags', '标签', { max: 400, full: true, placeholder: '山水，灵感，日常', help: '用中文或英文逗号分隔，最多 12 个；每个不超过 30 个字符。' });
    }
    const actions = document.createElement('div'); actions.className = 'form-actions';
    const save = document.createElement('button'); save.type = 'submit'; save.className = 'button primary'; save.textContent = '保存草稿';
    const hint = document.createElement('p'); hint.textContent = '保存后，可以在新窗口预览。';
    actions.append(save, hint); grid.append(actions); form.append(grid);
  }

  function renderList() {
    const list = $('item-list'); list.replaceChildren();
    $('work-count').textContent = data.works.length;
    $('post-count').textContent = data.posts.length;
    $('add-button').hidden = currentTab === 'profile';
    $('add-button').textContent = currentTab === 'works' ? '＋ 新增作品' : '＋ 新增文章';
    $('library-title').textContent = currentTab === 'profile' ? '个人资料' : currentTab === 'works' ? '作品集' : '文章集';
    const items = currentTab === 'profile' ? [{ id: 'profile', title: data.profile.name, category: '个人资料与联系方式' }] : data[currentTab];
    if (!items.length) { const empty = document.createElement('p'); empty.className = 'list-empty'; empty.textContent = '暂无内容，可以添加第一项。'; list.append(empty); }
    items.forEach((item) => {
      const button = document.createElement('button'); button.type = 'button';
      const selected = currentTab === 'profile' || selectedId === item.id;
      button.className = `item-card${selected ? ' selected' : ''}`;
      button.setAttribute('aria-pressed', String(selected));
      const title = document.createElement('span'); title.className = 'item-title'; title.textContent = item.title;
      const meta = document.createElement('span'); meta.className = 'item-meta'; meta.textContent = [item.category, item.date || item.year].filter(Boolean).join(' · ') || '尚未分类';
      button.append(title, meta);
      button.addEventListener('click', () => {
        if (currentTab === 'profile' || item.id === selectedId) return;
        if (!commitActive()) return;
        selectedId = item.id; renderList(); renderForm();
      });
      list.append(button);
    });
  }

  function render() {
    document.querySelectorAll('[data-tab]').forEach((tab) => {
      const active = tab.dataset.tab === currentTab;
      tab.classList.toggle('active', active); tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
    });
    $('editor-panel').setAttribute('aria-labelledby', `tab-${currentTab}`);
    renderList(); renderForm();
  }

  function commitActive() {
    const current = selectedItem();
    if (!current) return true;
    const form = $('editor-form');
    if (!form.reportValidity()) { setStatus('请先完成带“必填”的内容，并检查网址或邮箱格式。', true); return false; }
    const candidate = clone(data);
    const item = currentTab === 'profile' ? candidate.profile : candidate[currentTab].find((entry) => entry.id === selectedId);
    for (const control of form.elements) {
      if (!control.name) continue;
      item[control.name] = ARRAY_FIELDS.has(control.name) ? control.value.split(/[,，]/).map((part) => part.trim()).filter(Boolean) : control.value;
    }
    try { data = validateContent(candidate); return true; }
    catch (error) { setStatus(error.message, true); $('status').focus(); return false; }
  }

  function saveDraft(announce = true) {
    if (!commitActive()) return false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); markDirty(false); renderList();
      $('editor-title').textContent = currentTab === 'profile' ? '关于自己' : (selectedItem()?.title || '添加内容');
      if (announce) setStatus('草稿已保存在这个浏览器。预览确认后，下载 content.js 并上传到 GitHub，网站才会公开更新。');
      return true;
    } catch { setStatus('浏览器没有成功保存草稿。请允许本地存储，或点击“下载 content.js”保留这次修改。', true); return false; }
  }

  function newId(type) {
    const suffix = globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    return `${type}-${suffix}`;
  }

  function newItem() {
    if (currentTab === 'profile' || !commitActive()) return;
    if (data[currentTab].length >= MAX_ITEMS) { setStatus(`每类内容最多保存 ${MAX_ITEMS} 项。`, true); return; }
    const isWork = currentTab === 'works';
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const base = isWork ? '新的作品' : '新的文章';
    let title = base; let suffix = 2;
    while (data[currentTab].some((item) => item.title === title)) title = `${base} ${suffix++}`;
    const item = isWork
      ? { id: newId('work'), title, category: '', year: String(now.getFullYear()), status: '', contribution: '', summary: '', body: '', image: '', url: '', tags: [] }
      : { id: newId('post'), title, category: '', date: localDate, excerpt: '', body: '', tags: [] };
    data[currentTab].unshift(item); selectedId = item.id; markDirty(); render();
    setStatus(`已添加${isWork ? '作品' : '文章'}。写完后记得保存草稿。`);
    $('field-title').focus(); $('field-title').select();
  }

  function parseImport(text) {
    let json = text.replace(/^\uFEFF/, '').trim();
    if (json.startsWith(ASSIGNMENT_PREFIX)) {
      if (!json.endsWith(';')) throw new Error('content.js 文件格式不完整，请使用编辑台下载的原始文件。');
      json = json.slice(ASSIGNMENT_PREFIX.length, -1).trim();
    }
    let value;
    try { value = JSON.parse(json); } catch { throw new Error('无法读取此文件。请选择 JSON，或由编辑台下载的 content.js；文件里的代码不会被执行。'); }
    return validateContent(value);
  }

  async function importFile(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) { setStatus('文件超过 5 MB，请选择只包含网站文字内容的 JSON 或 content.js。', true); return; }
    try {
      const imported = parseImport(await file.text());
      if (!confirm('导入会替换编辑器中的全部资料、作品和文章。继续导入吗？')) return;
      data = imported; currentTab = 'profile'; selectedId = null; markDirty(); render();
      setStatus('内容已导入，请检查后保存草稿。公开网站尚未改变。');
    } catch (error) { setStatus(error.message || '文件读取失败，请重试。', true); $('status').focus(); }
  }

  function exportContent() {
    if (!commitActive()) return;
    const output = ASSIGNMENT_PREFIX + JSON.stringify(data, null, 2) + ';\n';
    const url = URL.createObjectURL(new Blob([output], { type: 'text/javascript;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'content.js';
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('已下载 content.js。到 GitHub 仓库上传并替换同名文件，提交后等待网站更新。也可以保留此文件作为备份。');
  }

  function init() {
    let initialMessage = '正在编辑网站现有内容。修改后先保存草稿，再预览或下载。';
    try { published = validateContent(window.SITE_CONTENT); }
    catch { published = clone(fallback); initialMessage = '没有读到有效的 content.js，已打开空白资料。你可以导入已有内容，或从这里开始填写。'; }
    data = clone(published);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const stored = JSON.parse(saved);
        data = validateContent(stored);
        const earlierVersion = stored.profile.handle === undefined || stored.works.some((item) => item.status === undefined || item.contribution === undefined);
        initialMessage = earlierVersion
          ? '检测到较早版本的本机草稿，已为你保留。想载入最新的“君 / INKVERSE”资料，请先下载旧稿备份，再点击下方“恢复网站原有内容”。'
          : '已恢复这个浏览器里的草稿。公开网站的内容要在上传 content.js 后才会更新。';
      }
    } catch { initialMessage = '未能读取浏览器中的旧草稿，已打开网站原有内容。你仍可编辑和下载内容文件。'; }
    render(); setStatus(initialMessage);

    $('editor-form').addEventListener('input', () => markDirty());
    $('editor-form').addEventListener('submit', (event) => { event.preventDefault(); saveDraft(); });
    $('save-button').addEventListener('click', () => saveDraft());
    $('preview-button').addEventListener('click', () => {
      if (!saveDraft(false)) return;
      const preview = document.createElement('a'); preview.href = './index.html?draft=1'; preview.target = '_blank'; preview.rel = 'noopener';
      document.body.append(preview); preview.click(); preview.remove();
      setStatus('已在新窗口打开草稿预览。预览仅供你在此浏览器查看，公开网站将在上传内容文件后更新。');
    });
    $('add-button').addEventListener('click', newItem);
    $('delete-button').addEventListener('click', () => {
      if (currentTab === 'profile') return;
      const item = selectedItem(); if (!item) return;
      const titleInput = $('field-title'); const title = titleInput?.value || item.title;
      if (!confirm(`确定删除“${title}”吗？删除后需保存草稿才会记住此改动。`)) return;
      data[currentTab] = data[currentTab].filter((entry) => entry.id !== selectedId);
      selectedId = data[currentTab][0]?.id || null; markDirty(); render();
      setStatus('这一项已从编辑器移除。请保存草稿；公开网站将在上传更新文件后改变。');
    });
    document.querySelectorAll('[data-tab]').forEach((tab) => {
      tab.addEventListener('click', () => {
        if (tab.dataset.tab === currentTab || !commitActive()) return;
        currentTab = tab.dataset.tab; selectedId = currentTab === 'profile' ? null : data[currentTab][0]?.id || null; render();
      });
      tab.addEventListener('keydown', (event) => {
        const all = Array.from(document.querySelectorAll('[data-tab]'));
        let index = all.indexOf(tab);
        if (event.key === 'ArrowRight') index = (index + 1) % all.length;
        else if (event.key === 'ArrowLeft') index = (index + all.length - 1) % all.length;
        else if (event.key === 'Home') index = 0;
        else if (event.key === 'End') index = all.length - 1;
        else return;
        event.preventDefault(); all[index].click();
        if (all[index].getAttribute('aria-selected') === 'true') all[index].focus();
      });
    });
    $('export-button').addEventListener('click', exportContent);
    $('import-button').addEventListener('click', () => $('import-file').click());
    $('import-file').addEventListener('change', importFile);
    $('reset-button').addEventListener('click', () => {
      if (!confirm('恢复 content.js 中的网站原有内容？这会替换当前编辑器的草稿。你可以先下载内容文件备份。')) return;
      data = clone(published); currentTab = 'profile'; selectedId = null; markDirty(); render();
      setStatus('已恢复网站原有内容。确认后保存草稿，就会覆盖这个浏览器中的旧草稿。');
    });
    window.addEventListener('beforeunload', (event) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  }

  init();
})();
