// 🌟 随机提示词库（优先猫狗）
const PLACEHOLDER_POOL = [
  "比如：三花猫、小黑狗、大熊猫…", "比如：大橘猫、哈士奇、小鹦鹉…", "比如：奶牛猫、金毛、小兔子…",
  "比如：狸花猫、柯基、小仓鼠…", "比如：流浪猫、修勾、小松鼠…", "比如：白手套猫、边牧、小刺猬…"
];

const MSGS = ["正在冲洗你的拍立得... 📸", "准备复古手账画板... ✂️", "匹配专属贴纸词库... 🐾", "手账已准备好啦！🎉"];

const state = {
  dataURL: null, currentType: 'default', editingId: null, 
  personality: new Set(), voice: new Set(), appetite: new Set(), vibe: new Set(),
  saved: false, lastShown: { personality: [], voice: [], appetite: [], vibe: [] },
  currentFeatures: new Set(), customWords: {}
};

const NEGATIVE_WORDS = ['生闷气','破口大骂','鬼哭狼嚎','气急败坏','脾气暴躁','暴躁','窝里横','小气鬼','干架王','打架王','怂包','胆小鬼','怕生','玻璃胃','心机喵','绿茶猫','白莲花','小流氓','街霸','小霸王','欺软怕硬','拆家','拆家小能手','拆家队长','拆家预备役','惹祸精','捣蛋鬼','泥石流','小恶魔','嫌犯','逃犯','饭桶','吃土','饿死鬼投胎','吃穷铲屎官','猪八戒转世','永远吃不饱','大胃王','超级挑食','挑食','护食','抢食','狂吠','狼嚎','破音','卡痰音','尖叫鸡','震耳欲聋','口吐芬芳','死亡翻滚','死不松口','拒食中','撒手没','丑萌丑萌','杀气腾腾','掉毛','肥猫','煤气罐','猪猪猫','凶猛','怕人','冷血杀手','暴君','拆家大王','杀猪般嚎叫','移动制粪机','空中轰炸机','越狱大师','拆家鸟','警报器','鸟中哈士奇','鸟界二哈','容易拔毛','啃咬狂魔','日天日地'];

const LOCATION_POOL = ['小区', '公园', '路边', '公司', '学校', '家里', '动物园', '咖啡店', '宠物店', '花鸟市场', '保密'];
const $ = id => document.getElementById(id);

const FLAT_KEYWORDS = [];
for (const type in KEYWORDS) {
  if (KEYWORDS[type]) KEYWORDS[type].forEach(kw => FLAT_KEYWORDS.push({ keyword: kw, type: type }));
}
FLAT_KEYWORDS.sort((a, b) => b.keyword.length - a.keyword.length);

function initCustomWords() {
  try {
    const saved = localStorage.getItem('cat_quest_custom_words');
    if (saved) state.customWords = JSON.parse(saved);
  } catch(e) {}
}

// 🌟 极简且兼容性最高的页面切换，同时控制悬浮按钮的显隐
function view(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = $('view-' + name);
  if (target) target.classList.add('active');
  
  window.scrollTo(0, 0); 
  
  // 如果进入结果页，给 body 加上 view-result 类以显示悬浮按钮
  if (name === 'result') {
    document.body.classList.add('view-result');
  } else {
    document.body.classList.remove('view-result');
  }
}

let toastTimer;
function toast(msg) {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}

function updateCheckboxes() {
  const setCheckState = (id, isChecked) => {
    const el = $(id);
    if (el && el.querySelector('.box')) el.querySelector('.box').classList.toggle('active', isChecked);
  };
  if ($('location-input')) setCheckState('check-location', $('location-input').value.trim() !== '');
  if ($('personality-input')) setCheckState('check-personality', state.personality.size > 0 || $('personality-input').value.trim() !== '');
  if ($('voice-input')) setCheckState('check-voice', state.voice.size > 0 || $('voice-input').value.trim() !== '');
  if ($('appetite-input')) setCheckState('check-appetite', state.appetite.size > 0 || $('appetite-input').value.trim() !== '');
  if ($('notes-history') && $('notes-input')) setCheckState('check-notes', $('notes-input').value.trim() !== '' || $('notes-history').children.length > 0);
}

function compress(img, maxW = 520, quality = 0.72) {
  const scale = Math.min(1, maxW / img.width);
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}

const loadImage = src => new Promise((resolve, reject) => {
  const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src;
});

function renderLocationChips() {
  const container = $('location-chips');
  if (!container) return;
  container.innerHTML = '';
  
  LOCATION_POOL.forEach(text => {
    const b = document.createElement('button');
    b.className = 'chip'; b.textContent = text; b.type = 'button';
    if ($('location-input').value === text) b.classList.add('on');
    b.addEventListener('click', () => {
      if (b.classList.contains('on')) {
        b.classList.remove('on'); $('location-input').value = '';
      } else {
        container.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
        b.classList.add('on'); $('location-input').value = text;
      }
      analyzeContext(); updateCheckboxes(); 
    });
    container.appendChild(b);
  });

  $('location-input').oninput = (e) => {
    const val = e.target.value.trim();
    container.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.textContent === val));
    analyzeContext(); updateCheckboxes(); 
  };
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function renderRandomChips(containerId, poolType, count = 12) {
  const container = $(containerId);
  if (!container) return;
  container.innerHTML = '';
  
  let fullPool = DICT[state.currentType]?.[poolType] || DICT.default[poolType] || [];
  const customList = state.customWords[state.currentType]?.[poolType] || [];
  fullPool = [...new Set([...customList, ...fullPool])];

  if (poolType === 'vibe' || poolType === 'personality') {
    fullPool = [...new Set([...Array.from(state.currentFeatures), ...fullPool])];
  }

  const selectedSet = state[poolType];
  const mustInclude = Array.from(selectedSet);
  let remainingPool = fullPool.filter(item => !selectedSet.has(item));
  const lastList = state.lastShown[poolType] || [];
  let freshPool = remainingPool.filter(item => !lastList.includes(item));
  
  if (freshPool.length < count - mustInclude.length) freshPool = remainingPool; 

  freshPool = shuffleArray(freshPool);
  const finalWords = mustInclude.concat(freshPool.slice(0, Math.max(0, count - mustInclude.length)));
  
  state.lastShown[poolType] = finalWords;
  shuffleArray(finalWords);

  finalWords.forEach(text => {
    const b = document.createElement('button');
    b.className = 'chip' + (selectedSet.has(text) ? ' on' : '');
    b.textContent = text; b.type = 'button';
    b.addEventListener('click', () => {
      if (selectedSet.has(text)) selectedSet.delete(text);
      else {
        if (selectedSet.size >= 6) { toast('最多选 6 个哦'); return; }
        selectedSet.add(text);
      }
      b.classList.toggle('on'); updateCheckboxes(); 
    });
    container.appendChild(b);
  });
}

function handleCustomInput(type, inputId, containerId, count) {
  const input = $(inputId);
  const val = input.value.trim();
  if (!val) return;
  
  if (state[type].size >= 6) {
    toast('最多选 6 个哦'); input.value = ''; input.parentElement.classList.remove('has-value'); updateCheckboxes(); return;
  }
  
  state[type].add(val);
  if (!state.customWords[state.currentType]) state.customWords[state.currentType] = {};
  if (!state.customWords[state.currentType][type]) state.customWords[state.currentType][type] = [];
  if (!state.customWords[state.currentType][type].includes(val)) {
    state.customWords[state.currentType][type].push(val);
    localStorage.setItem('cat_quest_custom_words', JSON.stringify(state.customWords));
  }
  
  renderRandomChips(containerId, type, count);
  input.value = ''; input.parentElement.classList.remove('has-value'); updateCheckboxes(); 
}

function analyzeContext() {
  const name = $('animal-name').value.trim();
  const loc = $('location-input').value.trim();
  let newType = 'default', nameMatched = false;

  if (name.length > 0) {
    const matchedItem = FLAT_KEYWORDS.find(item => name.includes(item.keyword));
    if (matchedItem) { newType = matchedItem.type; nameMatched = true; }
  }

  if (!nameMatched) {
    if (loc) {
      if (['小区', '公园', '路边', '公司', '学校', '家里', '咖啡店', '花鸟市场', '宠物店'].some(kw => loc.includes(kw))) newType = 'pet';
      else if (['动物园', '野外'].some(kw => loc.includes(kw))) newType = 'default';
      else newType = 'pet';
    } else if (name.length > 0) newType = 'pet';
  }

  const newFeatures = new Set();
  for (const kw in FEATURE_DICT) {
    if (name.includes(kw)) {
      const feats = FEATURE_DICT[kw][newType] || FEATURE_DICT[kw]['cat'] || FEATURE_DICT[kw]['pet'] || [];
      feats.forEach(f => newFeatures.add(f));
    }
  }

  let needRerender = false;
  if (newType !== state.currentType) {
    state.currentType = newType; state.lastShown = { personality: [], voice: [], appetite: [], vibe: [] }; needRerender = true;
  }
  if (JSON.stringify([...newFeatures]) !== JSON.stringify([...state.currentFeatures])) {
    state.currentFeatures = newFeatures; needRerender = true;
  }

  if (needRerender) {
    renderRandomChips('personality-chips', 'personality', 12);
    renderRandomChips('voice-chips', 'voice', 12);
    renderRandomChips('appetite-chips', 'appetite', 8);
    renderRandomChips('vibe-chips', 'vibe', 8);
  }
}

function editRecord(id) {
  const records = getRecords();
  const record = records.find(r => r.id === id);
  if (!record) return;

  state.editingId = id; state.dataURL = record.photo;
  
  if ($('result-img')) $('result-img').src = record.photo;
  if ($('animal-name')) $('animal-name').value = record.breed;
  if ($('location-input')) $('location-input').value = record.location || '';
  renderLocationChips(); 
  
  state.personality = new Set(record.personality || []);
  state.voice = new Set(record.voice || []);
  state.appetite = new Set(record.appetite || []);
  state.vibe = new Set(record.vibe || []);
  analyzeContext();
  
  renderRandomChips('personality-chips', 'personality', 12);
  renderRandomChips('voice-chips', 'voice', 12);
  renderRandomChips('appetite-chips', 'appetite', 8);
  renderRandomChips('vibe-chips', 'vibe', 8);

  const notesHistory = $('notes-history');
  if (notesHistory) {
    notesHistory.innerHTML = '';
    if (record.notes && record.notes.length > 0) {
      notesHistory.style.display = 'flex';
      [...record.notes].reverse().forEach(n => {
        const div = document.createElement('div'); div.className = 'note-history-item';
        div.innerHTML = `${escapeHTML(n.text)}<span class="note-history-date">${n.date}</span>`;
        notesHistory.appendChild(div);
      });
    } else notesHistory.style.display = 'none';
  }
  if ($('notes-input')) $('notes-input').value = ''; 

  const historyPanel = $('history-panel');
  const historyList = $('history-list');
  if (historyPanel && historyList) {
    if (record.history && record.history.length > 0) {
      historyPanel.style.display = 'block';
      historyList.innerHTML = record.history.map(h => `<li>${h}</li>`).join('');
    } else historyPanel.style.display = 'none';
  }

  if ($('result-status-chip')) $('result-status-chip').textContent = '✍️ 回顾 / 修改';
  if ($('btn-save')) $('btn-save').innerHTML = '💾 保存修改';
  state.saved = false;

  updateCheckboxes(); view('result');
}

// 事件绑定
if ($('btn-start')) $('btn-start').addEventListener('click', () => { state.editingId = null; $('file-input').click(); });
if ($('btn-again')) $('btn-again').addEventListener('click', () => {
  const hasContent = ($('animal-name') && $('animal-name').value.trim() !== '') || state.personality.size > 0 || state.voice.size > 0 || state.appetite.size > 0 || state.vibe.size > 0;
  if (!state.saved && hasContent) showCustomModal();
  else { state.editingId = null; $('file-input').click(); }
});

function showCustomModal() {
  const overlay = document.createElement('div');
  overlay.className = 'custom-modal-overlay';
  overlay.innerHTML = `<div class="custom-modal-box"><div class="custom-modal-text">你还有未保存的记录哦，<br>确定要放弃并开启新图鉴吗？</div><div class="custom-modal-actions"><button class="btn-modal-cancel" id="modal-save">不是，需要立刻保存喵！</button><button class="btn-modal-confirm" id="modal-confirm">确定，喵喵喵。</button></div></div>`;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.classList.add('show'), 10);

  overlay.querySelector('#modal-save').addEventListener('click', () => {
    overlay.classList.remove('show'); setTimeout(() => document.body.removeChild(overlay), 300); $('btn-save').click(); 
  });
  overlay.querySelector('#modal-confirm').addEventListener('click', () => {
    overlay.classList.remove('show'); setTimeout(() => document.body.removeChild(overlay), 300); state.editingId = null; setTimeout(() => $('file-input').click(), 300);
  });
}

if ($('btn-change-photo')) $('btn-change-photo').addEventListener('click', () => $('file-input').click());
if ($('btn-back-result')) $('btn-back-result').addEventListener('click', () => {
  const wasEditing = state.editingId; state.editingId = null; 
  if (wasEditing) view('gallery'); else view('home'); 
});
if ($('animal-name')) $('animal-name').addEventListener('input', analyzeContext);

['personality', 'voice', 'appetite', 'vibe'].forEach(type => {
  const count = (type === 'appetite' || type === 'vibe') ? 8 : 12;
  const input = $(type + '-input'); const btn = $('btn-add-' + type);
  if (input && btn) {
    const wrapper = input.parentElement;
    input.addEventListener('input', () => {
      wrapper.classList.toggle('has-value', input.value.trim().length > 0);
      updateCheckboxes(); 
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); handleCustomInput(type, type + '-input', type + '-chips', count); }
    });
    btn.addEventListener('click', () => handleCustomInput(type, type + '-input', type + '-chips', count));
  }
});

if ($('notes-input')) $('notes-input').addEventListener('input', updateCheckboxes);

['personality', 'voice', 'appetite', 'vibe'].forEach(type => {
  const btn = $('btn-refresh-' + type);
  if (btn) btn.addEventListener('click', () => renderRandomChips(type + '-chips', type, (type === 'appetite' || type === 'vibe') ? 8 : 12));
});

if ($('btn-download')) $('btn-download').addEventListener('click', () => {
  if (!state.dataURL) { toast('暂无图片'); return; }
  const a = document.createElement('a'); a.href = state.dataURL; a.download = `遇见动物_${Date.now()}.jpg`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); toast('✓ 照片已开始下载');
});

if ($('file-input')) $('file-input').addEventListener('change', async e => {
  const file = e.target.files && e.target.files[0]; e.target.value = '';
  if (!file || !file.type.startsWith('image/')) { toast('请上传图片文件'); return; }

  const rawURL = await new Promise((resolve, reject) => {
    const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.onerror = reject; fr.readAsDataURL(file);
  });

  const img = await loadImage(rawURL); const newDataURL = compress(img);

  if ($('view-result') && $('view-result').classList.contains('active')) {
    state.dataURL = newDataURL; if ($('result-img')) $('result-img').src = newDataURL; state.saved = false; toast('✓ 照片已更换，记得保存哦'); return;
  }

  state.dataURL = newDataURL; if ($('scan-img')) $('scan-img').src = state.dataURL;
  
  let msgIdx = 0; if ($('analyzing-msg')) $('analyzing-msg').textContent = MSGS[0];
  const msgTimer = setInterval(() => {
    msgIdx = (msgIdx + 1) % MSGS.length; if ($('analyzing-msg')) $('analyzing-msg').textContent = MSGS[msgIdx];
  }, 400);

  view('analyzing');

  setTimeout(() => {
    clearInterval(msgTimer);
    state.personality = new Set(); state.voice = new Set(); state.appetite = new Set(); state.vibe = new Set();
    state.currentFeatures = new Set(); state.currentType = 'default'; state.saved = false;
    
    if ($('result-status-chip')) $('result-status-chip').textContent = '✓ 记录完成';
    if ($('btn-save')) $('btn-save').innerHTML = '💾 收进图鉴';
    if ($('history-panel')) $('history-panel').style.display = 'none';
    if ($('notes-history')) { $('notes-history').style.display = 'none'; $('notes-history').innerHTML = ''; }

    if ($('result-img')) $('result-img').src = state.dataURL;
    if ($('animal-name')) { $('animal-name').value = ''; $('animal-name').placeholder = PLACEHOLDER_POOL[Math.floor(Math.random() * PLACEHOLDER_POOL.length)]; }
    if ($('location-input')) $('location-input').value = '';
    if ($('notes-input')) $('notes-input').value = '';
    
    renderLocationChips();
    renderRandomChips('personality-chips', 'personality', 12);
    renderRandomChips('voice-chips', 'voice', 12);
    renderRandomChips('appetite-chips', 'appetite', 8);
    renderRandomChips('vibe-chips', 'vibe', 8);
    
    ['personality', 'voice', 'appetite', 'vibe'].forEach(type => {
      const input = $(type + '-input'); if (input) { input.value = ''; input.parentElement.classList.remove('has-value'); }
    });

    updateCheckboxes(); view('result');
  }, 1200);
});

if ($('btn-save')) $('btn-save').addEventListener('click', () => {
  if (state.saved) { toast('已经保存啦'); return; }
  
  ['personality', 'voice', 'appetite', 'vibe'].forEach(type => {
    const input = $(type + '-input');
    if (input) {
      const val = input.value.trim();
      if (val && !state[type].has(val) && state[type].size < 6) {
        state[type].add(val);
        if (!state.customWords[state.currentType]) state.customWords[state.currentType] = {};
        if (!state.customWords[state.currentType][type]) state.customWords[state.currentType][type] = [];
        if (!state.customWords[state.currentType][type].includes(val)) state.customWords[state.currentType][type].push(val);
      }
    }
  });
  localStorage.setItem('cat_quest_custom_words', JSON.stringify(state.customWords));

  const animalName = ($('animal-name') && $('animal-name').value.trim()) || '神秘动物伙伴';
  const location = ($('location-input') && $('location-input').value.trim()) || '未记录地点';
  
  const newNoteText = ($('notes-input') && $('notes-input').value.trim()) || '';
  const todayStr = new Date().toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  const nowTimeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const noteDate = `${todayStr} ${nowTimeStr}`;

  const records = getRecords();
  const isEditing = state.editingId && records.findIndex(r => r.id === state.editingId) !== -1;

  if (isEditing) {
    const index = records.findIndex(r => r.id === state.editingId);
    const oldName = records[index].breed; const oldLoc = records[index].location;
    let changes = [];
    if (oldName !== animalName) changes.push(`名字: ${oldName}→${animalName}`);
    if (oldLoc !== location) changes.push(`地点: ${oldLoc}→${location}`);
    if (changes.length > 0) {
      if (!records[index].history) records[index].history = [];
      records[index].history.unshift(`${todayStr} 修改了 ${changes.join(', ')}`);
      records[index].history = records[index].history.slice(0, 10);
    }
    let currentNotes = records[index].notes;
    if (!Array.isArray(currentNotes)) currentNotes = currentNotes ? [{ text: currentNotes, date: '之前' }] : [];
    if (newNoteText) currentNotes.push({ text: newNoteText, date: noteDate });

    records[index].breed = animalName; records[index].location = location; records[index].photo = state.dataURL;
    records[index].notes = currentNotes; records[index].lastSeen = new Date().toISOString(); 
    records[index].personality = [...state.personality]; records[index].voice = [...state.voice];
    records[index].appetite = [...state.appetite]; records[index].vibe = [...state.vibe];
    toast(`好耶！对${animalName}更了解啦！`);
  } else {
    records.unshift({
      id: Date.now(), date: todayStr, createdAt: new Date().toISOString(), lastSeen: new Date().toISOString(), 
      photo: state.dataURL, breed: animalName, location: location,
      notes: newNoteText ? [{ text: newNoteText, date: noteDate }] : [],
      history: [], personality: [...state.personality], voice: [...state.voice], appetite: [...state.appetite], vibe: [...state.vibe]
    });
    toast(`好耶！对${animalName}更了解啦！`);
  }

  try { localStorage.setItem('cat_quest_records', JSON.stringify(records.slice(0, 60))); } 
  catch (e) { toast('存储空间满了，先清理一些旧记录吧'); return; }

  state.saved = true; updateStat(); setTimeout(() => view('home'), 1500);
});

if ($('btn-gallery')) $('btn-gallery').addEventListener('click', () => { 
  try { renderGallery(); renderCorkboard(); } catch(e) { console.error(e); }
  view('gallery'); 
});
if ($('btn-back')) $('btn-back').addEventListener('click', () => { state.editingId = null; view('home'); });

function getRecords() { try { return JSON.parse(localStorage.getItem('cat_quest_records') || '[]'); } catch (e) { return []; } }
function updateStat() { if ($('stat-count')) $('stat-count').textContent = getRecords().length; }

function renderCorkboard() {
  const track = $('corkboard-track'); if (!track) return;
  const records = getRecords(); const wordCount = {};
  records.forEach(r => {
    const allWords = [...(r.personality || []), ...(r.voice || []), ...(r.appetite || []), ...(r.vibe || [])];
    allWords.forEach(v => { if (!NEGATIVE_WORDS.includes(v)) wordCount[v] = (wordCount[v] || 0) + 1; });
  });

  const entries = Object.entries(wordCount);
  if (entries.length === 0) { if ($('corkboard-wrap')) $('corkboard-wrap').style.display = 'none'; return; } 
  else { if ($('corkboard-wrap')) $('corkboard-wrap').style.display = 'flex'; }

  entries.sort((a, b) => b[1] - a[1]);
  const topWords = entries.slice(0, 15);
  const colors = [{ bg: '#F5F6EE', text: '#3A4A2C' }, { bg: '#CDD3B4', text: '#3A4A2C' }, { bg: '#E8DCC4', text: '#5C6B52' }, { bg: '#F4E8D7', text: '#5C6B52' }];
  
  let html = '';
  for (let loop = 0; loop < 2; loop++) {
    topWords.forEach(([text, count], index) => {
      html += `<div class="voice-note" style="font-size:${Math.min(24, 13 + count * 2)}px; transform:rotate(${(Math.random() * 6 - 3).toFixed(1)}deg); background:${colors[index % colors.length].bg}; color:${colors[index % colors.length].text};">${escapeHTML(text)}</div>`;
    });
  }
  track.innerHTML = html;
}

function renderGallery() {
  const list = $('gallery-list'); 
  if (!list) return; 
  list.innerHTML = '';
  const records = getRecords();

  if (!records.length) {
    if ($('gallery-sub')) $('gallery-sub').textContent = '还没有记录';
    if ($('corkboard-wrap')) $('corkboard-wrap').style.display = 'none';
    list.innerHTML = `<div class="empty"><span class="empty-emoji">🐾</span><p>还没有遇见任何动物伙伴<br>出门走走吧，支线任务在等你</p></div>`;
    return;
  }

  if ($('gallery-sub')) $('gallery-sub').textContent = `共收录 ${records.length} 只动物伙伴`;
  
  records.forEach((r, i) => {
    const item = document.createElement('div');
    item.className = 'gal-item'; item.style.animationDelay = (i * 0.05) + 's'; item.style.cursor = 'pointer'; 

    const extra = [...(r.personality || []), ...(r.voice || []), ...(r.appetite || []), ...(r.vibe || [])];
    let latestNote = '';
    if (Array.isArray(r.notes) && r.notes.length > 0) latestNote = r.notes[r.notes.length - 1].text;
    else if (typeof r.notes === 'string' && r.notes) latestNote = r.notes;

    let days = 0; const startDate = r.createdAt || r.lastSeen; 
    if (startDate) days = Math.floor((new Date() - new Date(startDate)) / (1000 * 60 * 60 * 24));
    
    let daysBadge = '';
    if (days >= 15) {
      const hue = ((days - 15) * 25) % 360; 
      item.style.borderColor = `hsl(${hue}, 60%, 55%)`; item.style.boxShadow = `3px 3px 0 hsl(${hue}, 60%, 40%)`;
      daysBadge = `<span class="badge-days" style="background:hsl(${hue}, 60%, 92%); color:hsl(${hue}, 60%, 30%); border: 1px solid hsl(${hue}, 60%, 55%);">🌈 已收录 ${days} 天</span>`;
    } else if (days > 0) {
      daysBadge = `<span class="badge-days" style="background:var(--paper); color:var(--ink2); border: 1px solid var(--line);">已收录 ${days} 天</span>`;
    }

    item.innerHTML = `
      <img src="${r.photo}" alt="">
      <div class="gal-info">
        <div class="gal-name">${escapeHTML(r.breed)} ${daysBadge}</div>
        <div class="gal-meta">${extra.slice(0, 5).map(t => `<span>${escapeHTML(t)}</span>`).join('')}</div>
        <div class="gal-date"><svg class="loc-icon" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>${escapeHTML(r.location || '未知地点')} · ${r.date} 记录相遇</div>
        ${latestNote ? `<div class="gal-notes">💌 ${escapeHTML(latestNote)}</div>` : ''}
      </div>
      <button class="del-btn" data-id="${r.id}" title="删除这条记录">✕</button>`;

    item.addEventListener('click', () => editRecord(r.id));
    item.querySelector('.del-btn').addEventListener('click', (e) => {
      e.stopPropagation(); 
      if (confirm('确定要删除这只动物伙伴的记录吗？')) deleteRecord(r.id);
    });
    list.appendChild(item);
  });
}

function deleteRecord(id) {
  let records = getRecords().filter(item => item.id !== id);
  localStorage.setItem('cat_quest_records', JSON.stringify(records));
  updateStat(); renderGallery(); renderCorkboard(); toast('✓ 记录已删除');
}

function escapeHTML(s) { return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }

initCustomWords();
updateStat();