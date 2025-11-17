// Simple frontend-only file organizer
    const fileInput = document.getElementById('fileInput');
    const dropzone = document.getElementById('dropzone');
    const addBtn = document.getElementById('addBtn');
    const clearBtn = document.getElementById('clearBtn');
    const categoryList = document.getElementById('categoryList');
    const filesArea = document.getElementById('filesArea');
    const search = document.getElementById('search');
    const typeFilter = document.getElementById('typeFilter');
    const sortBy = document.getElementById('sortBy');
    const footer = document.getElementById('footer');

    const STORAGE_KEY = 'fo_files_v1';

    // Categories and mime matchers
    const CATS = [
      {key:'images', label:'Images', test: (f) => f.type.startsWith('image/')},
      {key:'videos', label:'Videos', test: (f) => f.type.startsWith('video/')},
      {key:'docs', label:'Docs', test: (f) => /pdf|msword|officedocument|text\//.test(f.type) || /\.pdf|\.doc|\.docx|\.txt|\.xls|\.xlsx/.test(f.name.toLowerCase())},
      {key:'others', label:'Others', test: (f) => true}
    ];

    let files = loadFromStorage();

    function saveToStorage(){
      localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
    }

    function loadFromStorage(){
      try{
        const raw = localStorage.getItem(STORAGE_KEY);
        if(!raw) return [];
        return JSON.parse(raw);
      }catch(e){
        console.error('load error',e); return [];
      }
    }

    function categorizeFile(fileObj){
      for(const c of CATS){ if(c.test(fileObj)) return c.key }
      return 'others'
    }

    function humanSize(size){
      if(size < 1024) return size + ' B';
      if(size < 1024*1024) return (size/1024).toFixed(1)+' KB';
      return (size/(1024*1024)).toFixed(1)+' MB';
    }

    function addFilesFromList(fileList){
      const arr = Array.from(fileList);
      const readPromises = arr.map(f => {
        const meta = {id: crypto.randomUUID(), name:f.name, type:f.type, size:f.size, date:Date.now()};
        const category = categorizeFile(f);
        meta.category = category;
        if(f.type.startsWith('image/')){
          return new Promise((res)=>{
            const reader = new FileReader();
            reader.onload = e => { meta.thumb = e.target.result; res(meta); }
            reader.onerror = () => res(meta);
            reader.readAsDataURL(f);
          })
        }
        // for videos we could capture thumbnail but skip for simplicity
        return Promise.resolve(meta);
      });

      Promise.all(readPromises).then(metas=>{
        files = [...metas, ...files];
        saveToStorage(); render();
      })
    }

    // UI wiring
    addBtn.addEventListener('click', ()=> fileInput.click());
    fileInput.addEventListener('change', (e)=> addFilesFromList(e.target.files));

    // drag-drop
    ['dragenter','dragover'].forEach(ev=> dropzone.addEventListener(ev, (e)=>{ e.preventDefault(); e.stopPropagation(); dropzone.classList.add('dragover'); }));
    ['dragleave','drop'].forEach(ev=> dropzone.addEventListener(ev, (e)=>{ e.preventDefault(); e.stopPropagation(); dropzone.classList.remove('dragover'); }));
    dropzone.addEventListener('drop', (e)=>{
      const dt = e.dataTransfer; if(dt && dt.files && dt.files.length) addFilesFromList(dt.files);
    });

    clearBtn.addEventListener('click', ()=>{
      if(!confirm('Clear all saved files (this only removes metadata, thumbnails saved for images too)?')) return;
      files = []; saveToStorage(); render();
    });

    search.addEventListener('input', render);
    typeFilter.addEventListener('change', render);
    sortBy.addEventListener('change', render);

    // Category chips
    function renderCategoryList(){
      categoryList.innerHTML = '';
      const counts = files.reduce((acc,f)=>{ acc[f.category]=(acc[f.category]||0)+1; return acc },{});
      for(const c of CATS){
        const btn = document.createElement('button'); btn.className='chip';
        if(typeFilter.value === c.key) btn.classList.add('active');
        btn.innerHTML = `${emojiFor(c.key)} ${c.label} <span style="opacity:0.6;margin-left:8px">(${counts[c.key]||0})</span>`;
        btn.addEventListener('click', ()=>{ typeFilter.value = c.key; render(); renderCategoryList(); });
        categoryList.appendChild(btn);
      }
      const all = document.createElement('button'); all.className='chip'; all.textContent='Show All'; all.style.marginTop='8px';
      all.addEventListener('click', ()=>{ typeFilter.value='all'; render(); renderCategoryList(); });
      categoryList.appendChild(all);
    }

    function emojiFor(key){ if(key==='images') return '🖼️'; if(key==='videos') return '🎞️'; if(key==='docs') return '📄'; return '📦'; }

    function render(){
      renderCategoryList();
      const q = search.value.trim().toLowerCase();
      const type = typeFilter.value;
      let list = files.slice();
      if(type !== 'all') list = list.filter(f=>f.category===type);
      if(q) list = list.filter(f=> f.name.toLowerCase().includes(q));

      // sort
      if(sortBy.value === 'newest') list.sort((a,b)=>b.date-a.date);
      else if(sortBy.value === 'oldest') list.sort((a,b)=>a.date-b.date);
      else if(sortBy.value === 'nameAsc') list.sort((a,b)=>a.name.localeCompare(b.name));
      else if(sortBy.value === 'nameDesc') list.sort((a,b)=>b.name.localeCompare(a.name));

      filesArea.innerHTML = '';
      if(list.length === 0){
        filesArea.innerHTML = `<div class="empty"><strong>No files to show</strong><div style="margin-top:8px;color:var(--muted)">Try uploading files or change filters</div></div>`;
        footer.textContent = `Total saved files: ${files.length}`;
        return;
      }

      const grid = document.createElement('div'); grid.className = 'files-grid';
      for(const f of list){
        const card = document.createElement('div'); card.className='file-card';
        const thumb = document.createElement('div'); thumb.className='thumb';
        // thumbnail
        if(f.thumb){ const img = document.createElement('img'); img.src = f.thumb; thumb.appendChild(img); }
        else{ // icon
          thumb.innerHTML = `<div style="text-align:center;font-size:22px">${emojiFor(f.category)}</div>`;
        }

        const meta = document.createElement('div'); meta.className='meta';
        const title = document.createElement('h4'); title.textContent = f.name;
        const info = document.createElement('p'); info.innerHTML = `${f.category.toUpperCase()} • ${humanSize(f.size)} • ${new Date(f.date).toLocaleString()}`;
        meta.appendChild(title); meta.appendChild(info);

        const actions = document.createElement('div'); actions.className='actions';
        const btnDel = document.createElement('button'); btnDel.className='small'; btnDel.textContent='Delete'; btnDel.addEventListener('click', ()=>{ if(confirm('Delete this file metadata?')){ files = files.filter(x=>x.id!==f.id); saveToStorage(); render(); } });
        const btnMove = document.createElement('button'); btnMove.className='small'; btnMove.textContent='Move'; btnMove.addEventListener('click', ()=>{ moveFileMenu(f); });
        const btnPreview = document.createElement('button'); btnPreview.className='small'; btnPreview.textContent='Preview'; btnPreview.addEventListener('click', ()=>{ previewFile(f); });
        actions.appendChild(btnPreview); actions.appendChild(btnMove); actions.appendChild(btnDel);

        card.appendChild(thumb); card.appendChild(meta); card.appendChild(actions);
        grid.appendChild(card);
      }

      filesArea.appendChild(grid);
      footer.textContent = `Showing ${list.length} of ${files.length} saved file(s)`;
    }

    function moveFileMenu(file){
      const next = prompt(`Move '${file.name}' to category (images, videos, docs, others):`, file.category);
      if(!next) return; const n = next.toLowerCase(); if(!CATS.some(c=>c.key===n)){ alert('Invalid category'); return; }
      file.category = n; saveToStorage(); render();
    }

    function previewFile(f){
      // If we have an image data URL show it, else show a minimal modal with details
      if(f.thumb){
        const modal = document.createElement('div'); modal.style.position='fixed'; modal.style.inset=0; modal.style.background='rgba(0,0,0,0.6)'; modal.style.display='flex'; modal.style.alignItems='center'; modal.style.justifyContent='center'; modal.style.zIndex=9999;
        const box = document.createElement('div'); box.style.maxWidth='90%'; box.style.maxHeight='90%'; box.style.background='#021024'; box.style.padding='12px'; box.style.borderRadius='10px';
        const img = document.createElement('img'); img.src = f.thumb; img.style.maxWidth='80vw'; img.style.maxHeight='80vh'; img.style.display='block'; img.style.borderRadius='8px'; box.appendChild(img);
        const tit = document.createElement('div'); tit.textContent = f.name; tit.style.marginTop='8px'; tit.style.color='var(--muted)'; box.appendChild(tit);
        modal.appendChild(box);
        modal.addEventListener('click', ()=> modal.remove()); document.body.appendChild(modal);
      } else {
        alert(`Name: ${f.name}\nType: ${f.type || 'unknown'}\nSize: ${humanSize(f.size)}`);
      }
    }

    // initialization
    render();

    // small UX: allow paste of images (Ctrl+V)
    window.addEventListener('paste', (e)=>{
      const items = e.clipboardData && e.clipboardData.items;
      if(!items) return;
      const filesFromPaste = [];
      for(const it of items){ if(it.kind==='file'){ const file = it.getAsFile(); filesFromPaste.push(file); } }
      if(filesFromPaste.length) addFilesFromList(filesFromPaste);
    });

    // helpful hint in footer when empty
    if(files.length===0){ footer.textContent = 'No files yet — try dragging images or clicking "Add files"'; }

