(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const DRAFT_KEY = 'jianghu-studio-draft-v1';
  const MOTION_KEY = 'junxing-motion';
  document.documentElement.classList.add('js');
  const original = window.SITE_CONTENT || {profile:{name:'君',handle:'INKVERSE'},works:[],posts:[]};
  let data = original;
  let toastTimer;
  const notify = (message) => {
    $('#toast').textContent = message;
    $('#toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3200);
  };
  const validData = (value) => value && typeof value === 'object' && value.profile &&
    typeof value.profile.name === 'string' && Array.isArray(value.works) && Array.isArray(value.posts) &&
    value.works.concat(value.posts).every(item => item && typeof item.id === 'string' && typeof item.title === 'string');
  if (new URLSearchParams(location.search).get('draft') === '1') {
    $('#draft-banner').hidden = false;
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
      if (validData(draft)) data = draft;
      else notify('尚无有效草稿，当前展示已发布内容。');
    } catch { notify('未能读取草稿，当前展示已发布内容。'); }
  }
  const asText = (value) => typeof value === 'string' ? value : '';
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = asText(text);
    return node;
  };
  const webURL = (value) => {
    try { const url = new URL(value); return ['http:','https:'].includes(url.protocol) ? url.href : ''; }
    catch { return ''; }
  };
  const imageURL = (value) => {
    if (typeof value !== 'string') return '';
    if (/^\.\/?assets\/[a-zA-Z0-9_\-./%\u0080-\uffff ]+$/.test(value) && !value.includes('..')) return value;
    if (/^assets\/[a-zA-Z0-9_\-./%\u0080-\uffff ]+$/.test(value) && !value.includes('..')) return './'+value;
    return webURL(value);
  };
  const setImage = (img,value) => {
    const src = imageURL(value);
    if (!src) { img.hidden=true; return false; }
    img.src = src;img.hidden=false;
    img.addEventListener('error', () => { img.hidden=true;img.closest('.work-image')?.classList.remove('has-media'); }, {once:true});
    return true;
  };
  const profile = data.profile || {};
  document.querySelectorAll('[data-profile="name"]').forEach(node => { node.textContent = asText(profile.name) || '君'; });
  document.querySelectorAll('[data-profile="handle"]').forEach(node => { node.textContent = asText(profile.handle) || 'INKVERSE'; });
  $('#hero-tagline').textContent = asText(profile.tagline);
  $('#hero-intro').textContent = asText(profile.intro);
  $('#about-content').textContent = asText(profile.about);
  $('#year').textContent = String(new Date().getFullYear());
  document.title = `${asText(profile.handle) || 'INKVERSE'} · ${asText(profile.name) || '君'}的个人空间`;
  [['#interest-tags',profile.interests],['#tool-tags',profile.tools]].forEach(([selector,values])=>{
    (Array.isArray(values)?values:[]).forEach(value=>$(selector).append(el('span','',asText(value))));
    $(selector).parentElement.hidden=!Array.isArray(values)||!values.length;
  });
  const contacts = $('#contact-links');
  const addLink = (title,subtitle,url) => {
    const link=el('a','contact-card');link.href=url;link.target='_blank';link.rel='noopener noreferrer';
    link.append(el('small','contact-label',title),el('strong','',subtitle),el('span','contact-action','访问主页 ↗'));contacts.append(link);
  };
  const addCopy = (title,value,kind='number') => {
    if(typeof value!=='string'||!value.trim()||value.length>80)return;
    if(kind==='number'&&!/^\d{1,20}$/.test(value))return;
    const copyLabel=title+(kind==='name'?' 名称':'');
    const button=el('button','contact-card');button.type='button';button.setAttribute('aria-label',`复制${copyLabel}：${value}`);
    button.append(el('small','contact-label',title),el('strong','',value),el('span','contact-action',kind==='name'?'复制名称 ⧉':'点击复制 ⧉'));
    button.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(value);notify(`${copyLabel}已复制。`);}catch{notify(`未能自动复制，${copyLabel}：${value}`);}});contacts.append(button);
  };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email || '')) {
    addLink('Email',profile.email,'mailto:'+profile.email);
  }
  if (webURL(profile.github)) {
    const url=webURL(profile.github);addLink('GitHub',new URL(url).pathname.split('/').filter(Boolean)[0]||'代码与项目',url);
  }
  if(webURL(profile.vrchat))addLink('VRChat',asText(profile.vrchatName)||'虚拟世界里见',webURL(profile.vrchat));
  else if(asText(profile.vrchatName))addCopy('VRChat',profile.vrchatName,'name');
  if(webURL(profile.social))addLink(asText(profile.socialLabel)||'Social','个人主页',webURL(profile.social));
  addCopy('Steam 好友码',profile.steamFriendCode);addCopy('QQ 号',profile.qq);
  if(!contacts.children.length)contacts.append(el('p','contact-empty','联系方式稍后补充。'));
  const works = Array.isArray(data.works) ? data.works : [];
  const posts = Array.isArray(data.posts) ? data.posts : [];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let savedMotion;
  try { savedMotion = localStorage.getItem(MOTION_KEY); } catch {}
  let motionOff = savedMotion === 'off' || reduced.matches;
  function applyMotion() {
    document.documentElement.classList.toggle('no-motion',motionOff);
    $('#motion-toggle').setAttribute('aria-pressed',String(motionOff));
    $('.motion-label').textContent = motionOff ? '开启动效' : '静止观卷';
    $('.motion-icon').textContent = motionOff ? '▷' : 'Ⅱ';
    updateScroll();
  }
  $('#motion-toggle').addEventListener('click',() => {
    if (reduced.matches) { notify('已遵循系统的减少动态效果设置。'); return; }
    motionOff = !motionOff;
    savedMotion = motionOff ? 'off':'on';
    try { localStorage.setItem(MOTION_KEY,savedMotion); } catch {}
    applyMotion();
    notify(motionOff ? '动效已暂停，安心阅读。' : '动效已开启。');
  });
  reduced.addEventListener('change',() => { motionOff = reduced.matches || savedMotion === 'off'; applyMotion(); });
  const revealObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); revealObserver.unobserve(entry.target); }
    });
  },{threshold:.08,rootMargin:'0px 0px -22px 0px'}) : null;
  const observeReveals = () => document.querySelectorAll('.reveal:not(.visible)').forEach(node => {
    if (revealObserver) revealObserver.observe(node); else node.classList.add('visible');
  });
  const categories = [...new Set(works.map(item => asText(item.category)).filter(Boolean))];
  let chosen = '';
  function renderWorks() {
    const grid = $('#work-grid'); grid.replaceChildren();
    const selected = works.filter(item => !chosen || item.category === chosen);
    selected.forEach((work,index) => {
      const card = el('button','work-card reveal'); card.type = 'button';
      card.style.setProperty('--delay',`${Math.min(index,3)*100}ms`);
      card.setAttribute('aria-label',`查看作品：${asText(work.title)}`);
      const picture = el('div','work-image');
      const cover=el('div',`project-cover project-cover-${index%4+1}`);
      const largeNumber=el('span','project-number',String(works.indexOf(work)+1).padStart(2,'0'));largeNumber.setAttribute('aria-hidden','true');
      cover.append(el('span','project-type',asText(work.category).toUpperCase()),largeNumber,el('span','project-cover-name',asText(work.title).split(/[·｜|]/)[0].trim()),el('span','project-media-note','项目截图待补充'));
      const img = el('img'); img.alt = asText(work.title); img.loading = 'lazy'; img.decoding='async';
      if(setImage(img,work.image))picture.classList.add('has-media');
      const number = el('span','work-index',String(index+1).padStart(2,'0')+' /'); number.setAttribute('aria-hidden','true');
      const open = el('span','work-open','↗'); open.setAttribute('aria-hidden','true');
      picture.append(cover,img,number,open);
      const meta = el('div','work-meta'); meta.append(el('span','',asText(work.category)),el('span','work-status',asText(work.status)||asText(work.year)));
      card.append(picture,meta,el('h3','',asText(work.title)),el('p','',asText(work.summary)));
      if(asText(work.contribution))card.append(el('p','work-contribution',work.contribution));
      card.addEventListener('click',() => { location.hash = 'read/work/'+encodeURIComponent(work.id); });
      grid.append(card);
    });
    $('#work-empty').hidden = selected.length > 0;
    grid.classList.remove('filtering');
    requestAnimationFrame(() => grid.classList.add('filtering'));
    observeReveals();
  }
  ['',...categories].forEach(category => {
    const button = el('button','filter',category || '全部'); button.type='button'; button.setAttribute('aria-pressed',String(!category));
    button.addEventListener('click',() => {
      chosen=category;
      $('#work-filters').querySelectorAll('button').forEach(node => node.setAttribute('aria-pressed',String(node===button)));
      renderWorks();
    });
    $('#work-filters').append(button);
  });
  $('#work-count-label').textContent = `${String(works.length).padStart(2,'0')} 个项目 / 持续更新`;
  function renderPosts() {
    const query = $('#post-search').value.trim().toLocaleLowerCase();
    const selected = posts.filter(post => [post.title,post.excerpt,post.category,...(Array.isArray(post.tags)?post.tags:[])].join(' ').toLocaleLowerCase().includes(query)).sort((a,b) => asText(b.date).localeCompare(asText(a.date)));
    const list = $('#post-list'); list.replaceChildren();
    selected.forEach((post,index) => {
      const row = el('button','post-row reveal'); row.type='button'; row.style.setProperty('--delay',`${Math.min(index,3)*80}ms`);
      row.setAttribute('aria-label','阅读文章：'+asText(post.title));
      const number = el('span','post-number',String(index+1).padStart(2,'0'));
      const info = el('div','post-info'); const meta=el('div','post-meta');
      const date=el('time','',asText(post.date).replaceAll('-','.')); date.dateTime=asText(post.date);
      meta.append(el('span','',asText(post.category)),date);
      info.append(meta,el('h3','',asText(post.title)),el('p','',asText(post.excerpt)));
      const arrow=el('span','post-arrow','↗'); arrow.setAttribute('aria-hidden','true'); row.append(number,info,arrow);
      row.addEventListener('click',() => { location.hash='read/post/'+encodeURIComponent(post.id); });
      list.append(row);
    });
    $('#post-count').textContent=`${String(selected.length).padStart(2,'0')} 篇手记`;
    $('#post-empty').hidden=selected.length>0;
    if (posts.length===0) $('#post-empty').textContent='暂时还没有公开的文章。以后会在这里记录开发过程、调整心得和一些想法。';
    else $('#post-empty').textContent='尚未寻到这一篇，换个关键词试试。';
    observeReveals();
  }
  $('#post-search').addEventListener('input',renderPosts);
  const reader=$('#reader'); let readerKind='post'; let readerSource=null; let closeTimer;
  function bodyContent(text) {
    const fragment=document.createDocumentFragment();
    let paragraph=[];let list=null;
    const flush=()=>{if(paragraph.length){fragment.append(el('p','',paragraph.join('\n')));paragraph=[];}list=null;};
    asText(text).split('\n').forEach(line => {
      const value=line.trim();
      if(!value){flush();return;}
      if(/^#{1,3}\s/.test(value)){flush();fragment.append(el('h3','',value.replace(/^#{1,3}\s+/,'')));}
      else if(/^[-*]\s/.test(value)){if(paragraph.length)flush();if(!list){list=el('ul');fragment.append(list);}list.append(el('li','',value.replace(/^[-*]\s+/,'')));}
      else{list=null;paragraph.push(line);}
    });
    flush();
    return fragment;
  }
  function openReader(kind,id) {
    clearTimeout(closeTimer);
    const item=(kind==='work'?works:posts).find(entry=>entry.id===id);
    if (!item) { notify('这一卷暂未找到。'); return; }
    readerSource=document.activeElement;
    readerKind=kind;
    $('#reader-kind').textContent=kind==='work'?'SELECTED WORK / 作品':'FIELD NOTES / 手记';
    $('#reader-meta').textContent=[asText(item.category),asText(kind==='work'?(item.status||item.year):item.date)].filter(Boolean).join(' / ');
    $('#reader-title').textContent=asText(item.title);
    $('#reader-summary').textContent=asText(kind==='work'?item.summary:item.excerpt);
    $('#reader-body').replaceChildren(bodyContent(item.body));
    const contribution=$('#reader-contribution');contribution.textContent=kind==='work'?asText(item.contribution):'';contribution.hidden=!contribution.textContent;
    const image=$('#reader-image'); image.hidden=true; if (kind==='work') {image.alt=asText(item.title);setImage(image,item.image);}
    $('#reader-tags').replaceChildren();
    (Array.isArray(item.tags)?item.tags:[]).forEach(tag=>$('#reader-tags').append(el('span','',asText(tag))));
    const link=$('#reader-link'); link.hidden=!(kind==='work'&&webURL(item.url)); if (!link.hidden) link.href=webURL(item.url);
    reader.classList.remove('closing');
    if (!reader.open) reader.showModal();
    document.body.classList.add('locked');reader.scrollTop=0;$('#close-reader').focus({preventScroll:true});
  }
  function closeReader() {
    if (!reader.open || reader.classList.contains('closing')) return;
    const finish=()=>{reader.close();reader.classList.remove('closing');};
    if (motionOff) finish(); else { reader.classList.add('closing');closeTimer=setTimeout(finish,360); }
  }
  $('#close-reader').addEventListener('click',closeReader);
  reader.addEventListener('cancel',event=>{event.preventDefault();closeReader();});
  reader.addEventListener('click',event=>{if(event.target===reader){const box=reader.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)closeReader();}});
  reader.addEventListener('close',()=>{
    document.body.classList.remove('locked');
    if (location.hash.startsWith('#read/')) history.replaceState(null,'','#'+(readerKind==='work'?'works':'journal'));
    if(readerSource && readerSource.isConnected) readerSource.focus({preventScroll:true});
  });
  function route() {
    const match=location.hash.match(/^#read\/(work|post)\/(.+)$/);
    if (match) {try{openReader(match[1],decodeURIComponent(match[2]));}catch{notify('未能打开这一卷。');}}
    else if(reader.open) closeReader();
  }
  window.addEventListener('hashchange',route);
  let ticking=false;
  function updateScroll() {
    const y=window.scrollY;
    const available=document.documentElement.scrollHeight-innerHeight;
    $('.reading-progress').style.transform=`scaleX(${available>0?Math.min(1,y/available):0})`;
    $('.hero-art').style.setProperty('--parallax',motionOff||innerWidth<761?'0px':`${Math.min(y*.13,105)}px`);
    ticking=false;
  }
  window.addEventListener('scroll',()=>{if(!ticking){ticking=true;requestAnimationFrame(updateScroll);}},{passive:true});
  window.addEventListener('resize',updateScroll,{passive:true});
  if ('IntersectionObserver' in window) {
    const navObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(entry.isIntersecting)document.querySelectorAll('.site-header nav a').forEach(link=>link.classList.toggle('active',link.hash==='#'+entry.target.id));
    }),{rootMargin:'-15% 0px -55% 0px',threshold:0});
    ['home','works','journal','about','contact'].forEach(id=>navObserver.observe(document.getElementById(id)));
  }
  renderWorks();renderPosts();applyMotion();observeReveals();route();
})();
