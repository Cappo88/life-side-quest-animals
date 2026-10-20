const state = {
  dataURL: null,
  currentType: 'default',
  editingId: null, 
  personality: new Set(),
  voice: new Set(),
  appetite: new Set(),
  vibe: new Set(),
  saved: false,
  lastShown: { personality: [], voice: [], appetite: [], vibe: [] },
  currentFeatures: new Set(),
  customWords: {}
};

const NEGATIVE_WORDS = [
  '生闷气', '破口大骂', '鬼哭狼嚎', '气急败坏', '脾气暴躁', '暴躁', '窝里横', '小气鬼', '干架王', '打架王', '怂包', '胆小鬼', '怕生', '玻璃胃', '心机喵', '绿茶猫', '白莲花', '小流氓', '街霸', '小霸王', '欺软怕硬', '拆家', '拆家小能手', '拆家队长', '拆家预备役', '惹祸精', '捣蛋鬼', '泥石流', '小恶魔', '嫌犯', '逃犯', '饭桶', '吃土', '喝风喝饱了', '饿死鬼投胎', '吃穷铲屎官', '猪八戒转世', '吃不饱', '永远吃不饱', '大胃王', '超级挑食', '挑食', '挑食怪', '挑食兔', '护食', '护食狂魔', '抢食', '狂吠', '狼嚎', '狼嚎鬼叫', '破音', '卡痰音', '尖叫鸡', '震耳欲聋', '吵死个人', '大声密谋', '口吐芬芳', '咬牙切齿', '死亡翻滚', '死不松口', '拒食中', '打呼噜', '孤僻', '撒手没', '丑萌丑萌', '杀气腾腾', '呆若木鸡', '掉毛蒲公英', '掉毛', '肥猫', '大胖橘', '煤气罐', '猪猪猫', '猪猪鼠', '灵活胖子', '凶猛', '怕人', '冷血杀手', '暴君', '黑猫警长', '拆家大王', '杀猪般嚎叫', '移动制粪机', '羽粉收割机', '空中轰炸机', '家具毁灭者', '越狱大师', '越狱小天才', '拆家鸟', '警报器', '鸟中哈士奇', '鸟界二哈', '孤独抑郁', '容易拔毛', '拔毛', '啃咬狂魔', '心机腹黑', '日天日地'
];

const LOCATION_POOL = ['小区', '公园', '路边', '公司', '学校', '家里', '动物园', '咖啡店', '宠物店', '花鸟市场', '保密'];
const $ = id => document.getElementById(id);

const FLAT_KEYWORDS = [];
for (const type in KEYWORDS) {
  KEYWORDS[type].forEach(kw => {
    FLAT_KEYWORDS.push({ keyword: kw, type: type });
  });
}
FLAT_KEYWORDS.sort((a, b) => b.keyword.length - a.keyword.length);

function initCustomWords() {
  try {
    const saved = localStorage.getItem('cat_quest_custom_words');
    if (saved) state.customWords = JSON.parse(saved);
  } catch(e) {}
}

function view(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $('view-' + name).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'instant' });
}

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
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
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

function renderLocationChips() {
  const container = $('location-chips');
  container.innerHTML = '';
  
  LOCATION_POOL.forEach(text => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = text;
    b.type = 'button';
    
    if ($('location-input').value === text) b.classList.add('on');

    b.addEventListener('click', () => {
      if (b.classList.contains('on')) {
        b.classList.remove('on');
        $('location-input').value = '';
      } else {
        container.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
        b.classList.add('on');
        $('location-input').value = text;
      }
      updateTagsFromContext(); 
    });
    container.appendChild(b);
  });

  $('location-input').oninput = (e) => {
    const val = e.target.value.trim();
    container.querySelectorAll('.chip').forEach(c => {
      if (c.textContent === val) {
        c.classList.add('on'); 
      } else {
        c.classList.remove('on');
      }
    });
    updateTagsFromContext();
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
  container.innerHTML = '';
  
  let fullPool = DICT[state.currentType]?.[poolType] || DICT.default[poolType];
  const customList = state.customWords[state.currentType]?.[poolType] || [];
  fullPool = [...new Set([...customList, ...fullPool])];

  if (poolType === 'vibe' || poolType === 'personality') {
    const feats = Array.from(state.currentFeatures);
    fullPool = [...new Set([...feats, ...fullPool])];
  }

  const selectedSet = state[poolType];
  const mustInclude = Array.from(selectedSet);
  
  let remainingPool = fullPool.filter(item => !selectedSet.has(item));
  const lastList = state.lastShown[poolType] || [];
  let freshPool = remainingPool.filter(item => !lastList.includes(item));
  
  if (freshPool.length < count - mustInclude.length) {
    freshPool = remainingPool; 
  }

  freshPool = shuffleArray(freshPool);
  const needed = Math.max(0, count - mustInclude.length);
  const finalWords = mustInclude.concat(freshPool.slice(0, needed));
  
  state.lastShown[poolType] = finalWords;
  shuffleArray(finalWords);

  finalWords.forEach(text => {
    const b = document.createElement('button');
    b.className = 'chip' + (selectedSet.has(text) ? ' on' : '');
    b.textContent = text;
    b.type = 'button';
    
    b.addEventListener('click', () => {
      if (selectedSet.has(text)) {
        selectedSet.delete(text);
      } else {
        if (selectedSet.size >= 6) { toast('最多选 6 个哦'); return; }
        selectedSet.add(text);
      }
      b.classList.toggle('on');
    });
    container.appendChild(b);
  });
}

function handleCustomInput(type, inputId, containerId, count) {
  const input = $(inputId);
  const val = input.value.trim();
  if (!val) return;
  
  if (state[type].size >= 6) {
    toast('最多选 6 个哦');
    input.value = '';
    input.parentElement.classList.remove('has-value');
    return;
  }
  
  state[type].add(val);
  
  if (!state.customWords[state.currentType]) state.customWords[state.currentType] = {};
  if (!state.customWords[state.currentType][type]) state.customWords[state.currentType][type] = [];
  
  if (!state.customWords[state.currentType][type].includes(val)) {
    state.customWords[state.currentType][type].push(val);
    localStorage.setItem('cat_quest_custom_words', JSON.stringify(state.customWords));
  }
  
  renderRandomChips(containerId, type, count);
  input.value = '';
  input.parentElement.classList.remove('has-value');
}

function analyzeContext() {
  const name = $('animal-name').value.trim();
  const loc = $('location-input').value.trim();
  
  let newType = 'default';
  let nameMatched = false;

  if (name.length > 0) {
    const matchedItem = FLAT_KEYWORDS.find(item => name.includes(item.keyword));
    if (matchedItem) {
      newType = matchedItem.type;
      nameMatched = true;
    }
  }

  if (!nameMatched) {
    if (loc) {
      if (['小区', '公园', '路边', '公司', '学校', '家里', '咖啡店', '花鸟市场', '宠物店'].some(kw => loc.includes(kw))) {
        newType = 'pet';
      } else if (['动物园', '野外'].some(kw => loc.includes(kw))) {
        newType = 'default';
      } else {
        newType = 'pet';
      }
    } else if (name.length > 0) {
      newType = 'pet';
    }
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
    state.currentType = newType;
    state.lastShown = { personality: [], voice: [], appetite: [], vibe: [] };
    needRerender = true;
  }
  
  if (JSON.stringify([...newFeatures]) !== JSON.stringify([...state.currentFeatures])) {
    state.currentFeatures = newFeatures;
    needRerender = true;
  }

  if (needRerender) {
    renderRandomChips('personality-chips', 'personality', 12);
    renderRandomChips('voice-chips', 'voice', 12);
    renderRandomChips('appetite-chips', 'appetite', 8);
    renderRandomChips('vibe-chips', 'vibe', 8);
  }
}

function updateTagsFromContext() { analyzeContext(); }

function editRecord(id) {
  const records = getRecords();
  const record = records.find(r => r.id === id);
  if (!record) return;

  state.editingId = id;
  state.dataURL = record.photo;
  
  $('result-img').src = record.photo;
  $('animal-name').value = record.breed;
  $('location-input').value = record.location;
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

  $('result-status-chip').textContent = '✍️ 回顾 / 修改';
  $('btn-save').textContent = '保存修改';
  state.saved = false;

  view('result');
}

$('btn-start').addEventListener('click', () => {
  state.editingId = null;
  $('file-input').click();
});
$('btn-again').addEventListener('click', () => {
  state.editingId = null;
  $('file-input').click();
});

// ========== 结果页返回按钮逻辑 ==========
$('btn-back-result').addEventListener('click', () => {
  console.log('结果页返回按钮被点击了');
  const wasEditing = state.editingId;
  state.editingId = null; 
  if (wasEditing) {
    view('gallery'); 
  } else {
    view('home'); 
  }
});

$('animal-name').addEventListener('input', updateTagsFromContext);

['personality', 'voice', 'appetite', 'vibe'].forEach(type => {
  const count = (type === 'appetite' || type === 'vibe') ? 8 : 12;
  const input = $(type + '-input');
  const btn = $('btn-add-' + type);
  const wrapper = input.parentElement;
  
  input.addEventListener('input', () => {
    if (input.value.trim().length > 0) {
      wrapper.classList.add('has-value');
    } else {
      wrapper.classList.remove('has-value');
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCustomInput(type, type + '-input', type + '-chips', count);
    }
  });

  btn.addEventListener('click', () => {
    handleCustomInput(type, type + '-input', type + '-chips', count);
  });
});

$('btn-refresh-personality').addEventListener('click', () => renderRandomChips('personality-chips', 'personality', 12));
$('btn-refresh-voice').addEventListener('click', () => renderRandomChips('voice-chips', 'voice', 12));
$('btn-refresh-appetite').addEventListener('click', () => renderRandomChips('appetite-chips', 'appetite', 8));
$('btn-refresh-vibe').addEventListener('click', () => renderRandomChips('vibe-chips', 'vibe', 8));

$('btn-download').addEventListener('click', () => {
  if (!state.dataURL) { toast('暂无图片'); return; }
  const a = document.createElement('a');
  a.href = state.dataURL;
  a.download = `遇见动物_${Date.now()}.jpg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  toast('✓ 照片已开始下载');
});

$('file-input').addEventListener('change', async e => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('请上传图片文件'); return; }

  const rawURL = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });

  const img = await loadImage(rawURL);
  state.dataURL = compress(img);

  $('scan-img').src = state.dataURL;
  view('analyzing');

  setTimeout(() => {
    state.personality = new Set();
    state.voice = new Set();
    state.appetite = new Set();
    state.vibe = new Set();
    state.currentFeatures = new Set();
    state.currentType = 'default';
    state.saved = false;
    
    $('result-status-chip').textContent = '✓ 记录完成';
    $('btn-save').textContent = '收进我的图鉴';

    $('result-img').src = state.dataURL;
    $('animal-name').value = '';
    $('location-input').value = '';
    
    renderLocationChips();
    
    renderRandomChips('personality-chips', 'personality', 12);
    renderRandomChips('voice-chips', 'voice', 12);
    renderRandomChips('appetite-chips', 'appetite', 8);
    renderRandomChips('vibe-chips', 'vibe', 8);
    
    ['personality', 'voice', 'appetite', 'vibe'].forEach(type => {
      const input = $(type + '-input');
      input.value = '';
      input.parentElement.classList.remove('has-value');
    });

    view('result');
  }, 1000);
});

$('btn-save').addEventListener('click', () => {
  if (state.saved) { toast('已经保存啦'); return; }
  
  ['personality', 'voice', 'appetite', 'vibe'].forEach(type => {
    const input = $(type + '-input');
    const val = input.value.trim();
    if (val && !state[type].has(val) && state[type].size < 6) {
      state[type].add(val);
      if (!state.customWords[state.currentType]) state.customWords[state.currentType] = {};
      if (!state.customWords[state.currentType][type]) state.customWords[state.currentType][type] = [];
      if (!state.customWords[state.currentType][type].includes(val)) {
        state.customWords[state.currentType][type].push(val);
      }
    }
  });
  localStorage.setItem('cat_quest_custom_words', JSON.stringify(state.customWords));

  const animalName = $('animal-name').value.trim() || '神秘动物伙伴';
  const location = $('location-input').value.trim() || '未记录地点';

  const records = getRecords();

  if (state.editingId) {
    const index = records.findIndex(r => r.id === state.editingId);
    if (index !== -1) {
      records[index].breed = animalName;
      records[index].location = location;
      records[index].personality = [...state.personality];
      records[index].voice = [...state.voice];
      records[index].appetite = [...state.appetite];
      records[index].vibe = [...state.vibe];
    }
    toast(`好耶！对${animalName}更了解啦！`);
  } else {
    records.unshift({
      id: Date.now(),
      date: new Date().toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }),
      photo: state.dataURL,
      breed: animalName,
      location: location,
      personality: [...state.personality],
      voice: [...state.voice],
      appetite: [...state.appetite],
      vibe: [...state.vibe]
    });
    toast(`好耶！对${animalName}更了解啦！`);
  }

  try {
    localStorage.setItem('cat_quest_records', JSON.stringify(records.slice(0, 60)));
  } catch (e) {
    toast('存储空间满了，先清理一些旧记录吧');
    return;
  }

  state.saved = true;
  updateStat();
  setTimeout(() => view('home'), 1500);
});

$('btn-gallery').addEventListener('click', () => { 
  renderGallery(); 
  renderCorkboard();
  view('gallery'); 
});
$('btn-back').addEventListener('click', () => {
  state.editingId = null;
  view('home');
});

function getRecords() {
  try {
    return JSON.parse(localStorage.getItem('cat_quest_records') || '[]');
  } catch (e) {
    return [];
  }
}

function updateStat() {
  $('stat-count').textContent = getRecords().length;
}

function renderCorkboard() {
  const records = getRecords();
  const track = $('corkboard-track');
  const wordCount = {};
  
  records.forEach(r => {
    const allWords = [...(r.personality || []), ...(r.voice || []), ...(r.appetite || []), ...(r.vibe || [])];
    allWords.forEach(v => {
      if (!NEGATIVE_WORDS.includes(v)) {
        wordCount[v] = (wordCount[v] || 0) + 1;
      }
    });
  });

  const entries = Object.entries(wordCount);
  
  if (entries.length === 0) {
    $('corkboard-wrap').style.display = 'none';
    return;
  } else {
    $('corkboard-wrap').style.display = 'flex';
  }

  entries.sort((a, b) => b[1] - a[1]);
  const topWords = entries.slice(0, 15);
  
  const colors = [
    { bg: '#F5F6EE', text: '#3A4A2C' },
    { bg: '#CDD3B4', text: '#3A4A2C' },
    { bg: '#E8DCC4', text: '#5C6B52' },
    { bg: '#F4E8D7', text: '#5C6B52' }
  ];
  
  let html = '';
  for (let loop = 0; loop < 2; loop++) {
    topWords.forEach(([text, count], index) => {
      const fontSize = Math.min(24, 13 + count * 2);
      const rotate = (Math.random() * 6 - 3).toFixed(1);
      const color = colors[index % colors.length];
      
      html += `<div class="voice-note" style="
        font-size: ${fontSize}px; 
        transform: rotate(${rotate}deg);
        background: ${color.bg};
        color: ${color.text};
      ">${escapeHTML(text)}</div>`;
    });
  }
  track.innerHTML = html;
}

function renderGallery() {
  const list = $('gallery-list');
  const records = getRecords();
  list.innerHTML = '';

  if (!records.length) {
    $('gallery-sub').textContent = '还没有记录';
    $('corkboard-wrap').style.display = 'none';
    list.innerHTML = `<div class="empty">
      <span class="empty-emoji">🐾</span>
      <p>还没有遇见任何动物伙伴<br>出门走走吧，支线任务在等你</p>
    </div>`;
    return;
  }

  $('gallery-sub').textContent = `共收录 ${records.length} 只动物伙伴`;
  
  records.forEach((r, i) => {
    const item = document.createElement('div');
    item.className = 'gal-item';
    item.style.animationDelay = (i * 0.05) + 's';
    item.style.cursor = 'pointer'; 

    const extra = [...(r.personality || []), ...(r.voice || []), ...(r.appetite || []), ...(r.vibe || [])];
    
    item.innerHTML = `
      <img src="${r.photo}" alt="">
      <div class="gal-info">
        <div class="gal-name">${escapeHTML(r.breed)}</div>
        <div class="gal-meta">
          ${extra.slice(0, 5).map(t => `<span>${escapeHTML(t)}</span>`).join('')}
        </div>
        <div class="gal-date">📍 ${escapeHTML(r.location || '未知地点')} · ${r.date} 遇见</div>
      </div>
      <button class="del-btn" data-id="${r.id}" title="删除这条记录">✕</button>
    `;

    item.addEventListener('click', () => {
      editRecord(r.id);
    });

    const delBtn = item.querySelector('.del-btn');
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation(); 
      const confirmDel = confirm('确定要删除这只动物伙伴的记录吗？');
      if (confirmDel) deleteRecord(r.id);
    });

    list.appendChild(item);
  });
}

function deleteRecord(id) {
  let records = getRecords();
  records = records.filter(item => item.id !== id);
  localStorage.setItem('cat_quest_records', JSON.stringify(records));
  updateStat();
  renderGallery(); 
  renderCorkboard();
  toast('✓ 记录已删除');
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

initCustomWords();
updateStat();