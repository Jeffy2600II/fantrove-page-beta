document.addEventListener('DOMContentLoaded', function() {
    // --- Language support (load from language.min.json) ---
    let supportedLanguages = [];
    let languageLabels = {};
    function generateLangInputs() {
        try {
            const tbody = document.getElementById('multiLangNameBody');
            if (!tbody) return;
            tbody.innerHTML = '';
            supportedLanguages.forEach(code => {
                const label = languageLabels[code] || code.toUpperCase();
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><input type="text" class="lang-code" maxlength="5" value="${code}" readonly></td>
                    <td><input type="text" class="lang-value" placeholder="ชื่อ (${label})"></td>
                    <td></td>
                `;
                tbody.appendChild(tr);
            });
        } catch (e) {
            console.error('generateLangInputs error:', e);
        }
    }
    function generateCategoryLangInputs() {
        try {
            const tbody = document.getElementById('categoryLangInputs');
            if (!tbody) return;
            tbody.innerHTML = '';
            supportedLanguages.forEach(code => {
                const label = languageLabels[code] || code.toUpperCase();
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><input type="text" class="cat-lang-code" maxlength="5" value="${code}" readonly></td>
                    <td><input type="text" class="cat-lang-value" placeholder="ชื่อหมวดหมู่ (${label})"></td>
                    <td></td>
                `;
                tbody.appendChild(tr);
            });
        } catch (e) {
            console.error('generateCategoryLangInputs error:', e);
        }
    }
    fetch('/assets/json/language.min.json')
        .then(res=>res.json())
        .then(langs=>{
            supportedLanguages = Object.keys(langs);
            languageLabels = {};
            for(const code of supportedLanguages){
                languageLabels[code] = langs[code].label || code.toUpperCase();
            }
            generateLangInputs();
            generateCategoryLangInputs();
        })
        .catch(e => {
            console.error('Failed to load language.min.json', e);
            supportedLanguages = ['en', 'th'];
            languageLabels = { en: 'EN', th: 'TH' };
            generateLangInputs();
            generateCategoryLangInputs();
        });

    // === Utility for new <-> old data conversion with ID support ===
    function newToOldFormat(newData) {
        try {
            const oldData = {};
            (newData.type || []).forEach(typeObj => {
                const typeKey = typeObj.id || (typeObj.name && typeObj.name.en ? typeObj.name.en.toLowerCase() : "");
                oldData[typeKey] = { id: typeObj.id, nameObj: typeObj.name, category: [] };
                (typeObj.category || []).forEach(catObj => {
                    oldData[typeKey].category.push({
                        id: catObj.id,
                        name: catObj.name.en,
                        nameObj: catObj.name,
                        data: (catObj.data || []).map(item => ({
                            id: item.id,
                            api: item.api,
                            text: item.text,
                            nameObj: item.name
                        }))
                    });
                });
            });
            return oldData;
        } catch (e) {
            console.error('newToOldFormat error:', e);
            return {};
        }
    }
    function oldToNewFormat(oldData) {
        try {
            const typeArr = [];
            Object.entries(oldData).forEach(([typeKey, typeVal]) => {
                let typeName = typeVal.nameObj || { th: typeKey, en: typeKey.charAt(0).toUpperCase() + typeKey.slice(1) };
                typeArr.push({
                    id: typeVal.id || typeKey,
                    name: typeName,
                    category: (typeVal.category || []).map(cat => ({
                        id: cat.id || cat.name,
                        name: cat.nameObj || { th: cat.name, en: cat.name },
                        data: (cat.data || []).map(item => ({
                            id: item.id,
                            api: item.api,
                            text: item.text,
                            name: item.nameObj || { th: "", en: "" }
                        }))
                    }))
                });
            });
            return { type: typeArr };
        } catch (e) {
            console.error('oldToNewFormat error:', e);
            return { type: [] };
        }
    }

    let apiData = null;
    let isDarkMode = localStorage.getItem('darkMode') === 'true';
    let currentEditingItem = null;
    let categoryNameMap = {};

    // DOM element references
    const searchInput = document.getElementById('searchInput');
    const filterType = document.getElementById('filterType');
    const filterCategory = document.getElementById('filterCategory');
    const dataContainer = document.getElementById('dataContainer');
    const modal = document.getElementById('detailModal');
    const modalContent = document.getElementById('modalContent');
    const closeModal = document.querySelector('.close');

    closeModal && (closeModal.onclick = () => modal.style.display = "none");
    window.onclick = (e) => {
        if (e.target === modal) modal.style.display = "none";
    }

    function updateTheme() {
        try {
            document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
            const tsw = document.getElementById('themeSwitcher');
            if (tsw) tsw.innerHTML = `<i class="fas fa-${isDarkMode ? 'sun' : 'moon'}"></i>`;
        } catch(e) {}
    }
    updateTheme();

    async function loadInitialData() {
        try {
            const response = await fetch('/assets/json/api-database.min.json');
            if (!response.ok) throw new Error('Network response was not ok');
            const loaded = await response.json();
            apiData = newToOldFormat(loaded);
            generateCategoryNameMap(loaded);
            updateUI();
            showToast('โหลดข้อมูลสำเร็จ', 'success');
        } catch (error) {
            console.error('ไม่สามารถโหลดข้อมูลได้:', error);
            showToast('ไม่สามารถโหลดข้อมูลได้', 'error');
            apiData = {
                emoji: { id: "emoji", category: [] },
                symbol: { id: "symbol", category: [] }
            };
            updateUI();
        }
    }

    function generateCategoryNameMap(json) {
        try {
            categoryNameMap = {};
            (json.type || []).forEach(typeObj => {
                const typeKey = typeObj.id || (typeObj.name && typeObj.name.en ? typeObj.name.en.toLowerCase() : "");
                categoryNameMap[typeKey] = [];
                (typeObj.category || []).forEach(cat => {
                    if (cat.name && cat.name.en && cat.name.th) {
                        categoryNameMap[typeKey].push({
                            th: cat.name.th,
                            en: cat.name.en,
                            id: cat.id
                        });
                    }
                });
            });
        } catch (e) {
            console.error('generateCategoryNameMap error:', e);
        }
    }

    window.updateUI = updateUI;
    window.apiData = apiData;
    window.categoryNameMap = categoryNameMap;

    function updateUI() {
        try {
            updateCategorySelect();
            updateFilterCategories();
            updateStatistics();
            renderData();
        } catch(e) {
            console.error('updateUI error:', e);
        }
    }

    function updateCategorySelect() {
        try {
            const mainType = document.getElementById('mainType').value;
            const categorySelect = document.getElementById('category');
            if (!categorySelect) return;
            categorySelect.innerHTML = '';
            let cats = (categoryNameMap[mainType] || []);
            if (cats.length === 0 && apiData[mainType]) {
                cats = (apiData[mainType].category || []).map(cat => ({
                    en:cat.name, th:cat.name, id:cat.id
                }));
            }
            cats.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.en;
                option.dataset.id = cat.id;
                option.textContent = cat.th + " / " + cat.en;
                categorySelect.appendChild(option);
            });
        } catch(e) {
            console.error('updateCategorySelect error:', e);
        }
    }

    function updateFilterCategories() {
        try {
            const categories = new Map();
            Object.values(apiData).forEach(type => {
                if (type.category) {
                    type.category.forEach(cat => categories.set(cat.id || cat.name, cat.name));
                }
            });
            filterCategory.innerHTML = '<option value="all">ทุกหมวดหมู่</option>';
            Array.from(categories.entries()).sort((a,b) => a[1].localeCompare(b[1])).forEach(([id, name]) => {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = name;
                filterCategory.appendChild(option);
            });
        } catch(e) {
            console.error('updateFilterCategories error:', e);
        }
    }

    function updateStatistics() {
        try {
            let emojiCount = 0;
            let symbolCount = 0;
            let categoryCount = new Set();

            Object.entries(apiData).forEach(([type, data]) => {
                if (data.category) {
                    data.category.forEach(cat => {
                        categoryCount.add(cat.id || cat.name);
                        if (type === 'emoji') emojiCount += cat.data ? cat.data.length : 0;
                        else symbolCount += cat.data ? cat.data.length : 0;
                    });
                }
            });
            document.getElementById('emojiCount').textContent = emojiCount;
            document.getElementById('symbolCount').textContent = symbolCount;
            document.getElementById('categoryCount').textContent = categoryCount.size;
        } catch(e) {
            console.error('updateStatistics error:', e);
        }
    }

    window.editItem = function(type, categoryId, index) {
        try {
            const categoryData = apiData[type].category.find(c => c.id === categoryId);
            if (!categoryData || !categoryData.data) return;
            const item = categoryData.data[index];
            if (!item) return;
            currentEditingItem = { type, categoryId, index };
            const langFields = supportedLanguages.map(lang =>
                `<div class="form-group">
                    <label>ชื่อ (${languageLabels[lang] || lang.toUpperCase()}):</label>
                    <input type="text" id="editName_${lang}" value="${(item.nameObj && item.nameObj[lang])||""}" class="form-control" >
                </div>`
            ).join('');
            modalContent.innerHTML = `
                <div class="edit-form">
                    <div class="form-group">
                        <label>ข้อความ/สัญลักษณ์:</label>
                        <input type="text" id="editText" value="${item.text || ""}" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>รหัส API:</label>
                        <input type="text" id="editApi" value="${item.api || ""}" class="form-control">
                    </div>
                    ${langFields}
                    <div class="form-actions">
                        <button onclick="saveEdit()" class="btn btn-primary">
                            <i class="fas fa-save"></i> บันทึก
                        </button>
                        <button onclick="closeModal()" class="btn btn-secondary">
                            <i class="fas fa-times"></i> ยกเลิก
                        </button>
                    </div>
                </div>
            `;
            modal.style.display = "block";
        } catch (e) {
            console.error('editItem error:', e);
        }
    };

    window.saveEdit = function() {
        try {
            if (!currentEditingItem) return;
            const newText = document.getElementById('editText').value.trim();
            const newApi = document.getElementById('editApi').value.trim();
            const nameObj = {};
            supportedLanguages.forEach(lang => {
                nameObj[lang] = document.getElementById('editName_' + lang).value.trim();
            });
            if (!validateInput(newText, newApi)) return;
            const { type, categoryId, index } = currentEditingItem;
            const categoryData = apiData[type].category.find(c => c.id === categoryId);
            if (categoryData && categoryData.data) {
                categoryData.data[index] = {
                    ...categoryData.data[index],
                    text: newText,
                    api: newApi,
                    nameObj
                };
                updateUI();
                closeModal();
                showToast('แก้ไขข้อมูลสำเร็จ', 'success');
            }
        } catch (e) { console.error('saveEdit error:', e); }
    };

    window.deleteItem = function(type, categoryId, index) {
        try {
            if (confirm('คุณแน่ใจหรือไม่ที่จะลบรายการนี้?')) {
                const categoryData = apiData[type].category.find(c => c.id === categoryId);
                if (categoryData && categoryData.data) {
                    categoryData.data.splice(index, 1);
                    updateUI();
                    showToast('ลบข้อมูลสำเร็จ', 'success');
                }
            }
        } catch (e) { console.error('deleteItem error:', e); }
    };

    window.closeModal = function() {
        modal.style.display = "none";
        currentEditingItem = null;
    };

    function renderData() {
        try {
            const searchTerm = searchInput.value.toLowerCase();
            const selectedType = filterType.value;
            const selectedCategoryId = filterCategory.value;
            dataContainer.innerHTML = '';
            Object.entries(apiData).forEach(([type, data]) => {
                if (selectedType !== 'all' && type !== selectedType) return;
                if (!data.category) return;
                const typeSection = document.createElement('div');
                typeSection.className = 'type-section';
                typeSection.innerHTML = `<h3>${type.toUpperCase()}</h3>`;
                data.category.forEach(category => {
                    if (selectedCategoryId !== 'all' && (category.id || category.name) !== selectedCategoryId) return;
                    if (!category.data) category.data = [];
                    const filteredData = category.data.filter(item => {
                        return (item.text || "").toLowerCase().includes(searchTerm) ||
                            (item.api || "").toLowerCase().includes(searchTerm) ||
                            (item.nameObj && Object.values(item.nameObj).some(val => (val||"").toLowerCase().includes(searchTerm)));
                    });
                    if (filteredData.length === 0) return;
                    const categoryDiv = createCategorySection(type, category, filteredData);
                    typeSection.appendChild(categoryDiv);
                });
                if (typeSection.children.length > 1) dataContainer.appendChild(typeSection);
            });
            setupDragAndDrop();
        } catch(e) {
            console.error('renderData error:', e);
        }
    }

    function createCategorySection(type, category, items) {
        const div = document.createElement('div');
        div.className = 'data-group';
        div.innerHTML = `
            <div class="data-group-header">
                ${category.name}
                <span class="item-count">(${items.length} รายการ)</span>
            </div>
            <div class="data-items" data-type="${type}" data-category="${category.id}" style="position:relative;min-height:30px;">
                ${items.map((item, index) => createDataItemHTML(type, category.id, item, index)).join('')}
            </div>
        `;
        return div;
    }

    function createDataItemHTML(type, categoryId, item, index) {
        // เสถียร: ไม่แสดง nameObj ใน UI, ป้องกัน field null
        return `
            <div class="data-item" draggable="false" data-index="${index}" style="touch-action:auto;">
                <div class="item-content">
                    <span class="item-text">${item.text || ""}</span>
                    <span class="item-api">${item.api || ""}</span>
                </div>
                <div class="item-actions">
                    <button onclick="editItem('${type}', '${categoryId}', ${index})" class="btn-edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteItem('${type}', '${categoryId}', ${index})" class="btn-delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }

    // =============== ADVANCED DRAG & DROP WITH CARD PREVIEW (Long Press Only, Centered, Allow Scroll) ===============
    let dragState = {
        dragging: false,
        dragItem: null,
        dragType: null,
        dragCategoryId: null,
        dragIndex: null,
        cardEl: null,
        cardOffsetX: 0,
        cardOffsetY: 0,
        startX: 0,
        startY: 0,
        offsetX: 0,
        offsetY: 0,
        dropTargetType: null,
        dropTargetCategoryId: null,
        dropTargetIndex: null,
        lastOver: null,
        autoScrollInterval: null,
        activated: false,
        activationTimeout: null,
        lastMoveX: 0,
        lastMoveY: 0
    };
    const DRAG_ACTIVATION_DELAY = 350;

    function createDragCardPreview(item, pointerX, pointerY) {
        const card = document.createElement('div');
        card.className = 'drag-card-preview';
        card.style.position = 'fixed';
        card.style.zIndex = 9999;
        card.style.pointerEvents = 'none';
        card.style.boxShadow = '0 4px 16px 0 rgba(0,0,0,0.16)';
        card.style.transition = 'none';
        card.style.background = 'var(--card-bg,#fff)';
        card.style.minWidth = '180px';
        card.style.maxWidth = '260px';
        card.style.padding = '12px 16px';
        card.style.borderRadius = '10px';
        card.style.opacity = '0.97';
        card.style.fontSize = '1rem';
        card.innerHTML = `
            <div class="item-content">
                <span class="item-text" style="font-size:1.2em;font-weight:bold;">${item.text || ""}</span>
                <span class="item-api" style="display:block;color:#555;margin-top:4px;">${item.api || ""}</span>
                <span class="item-name" style="display:block;color:#888;margin-top:2px;font-size:0.96em;">
                    ${item.nameObj ? Object.entries(item.nameObj).map(([k,v]) => v ? `[${k}] ${v}` : '').join(' ') : ''}
                </span>
            </div>
        `;
        document.body.appendChild(card);
        const rect = card.getBoundingClientRect();
        dragState.cardOffsetX = rect.width / 2;
        dragState.cardOffsetY = rect.height / 2;
        card.style.left = (pointerX - dragState.cardOffsetX) + 'px';
        card.style.top = (pointerY - dragState.cardOffsetY) + 'px';
        return card;
    }
    function removeDragCardPreview() {
        if (dragState.cardEl) {
            try { document.body.removeChild(dragState.cardEl); } catch(e){}
            dragState.cardEl = null;
        }
    }
    let dragLongPressTimer = null;
    let isTouchDrag = false;

    function setupDragAndDrop() {
        try {
            const items = document.querySelectorAll('.data-item');
            const containers = document.querySelectorAll('.data-items');
            items.forEach(item => {
                item.onmousedown = item.onmouseup = item.onmousemove = null;
                item.ontouchstart = item.ontouchmove = item.ontouchend = null;
            });
            containers.forEach(container=>{
                container.ondragover = container.ondrop = container.ondragenter = container.ondragleave = null;
            });
            items.forEach(item => {
                item.addEventListener('mousedown', handleDragMouseDown);
                item.addEventListener('touchstart', handleDragTouchStart, {passive:true});
            });
        } catch(e) {
            console.error('setupDragAndDrop error:', e);
        }
    }

    function handleDragMouseDown(e) {
        try {
            if (e.button !== 0) return;
            e.preventDefault();
            const itemEl = e.currentTarget;
            const dataItemsEl = itemEl.closest('.data-items');
            if (!dataItemsEl) return;
            const type = dataItemsEl.dataset.type;
            const categoryId = dataItemsEl.dataset.category;
            const index = +itemEl.dataset.index;
            dragState.dragging = false;
            dragState.activated = false;
            dragState.dragItem = itemEl;
            dragState.dragType = type;
            dragState.dragCategoryId = categoryId;
            dragState.dragIndex = index;
            dragState.startX = e.clientX;
            dragState.startY = e.clientY;
            dragState.offsetX = 0;
            dragState.offsetY = 0;
            dragState.lastMoveX = e.clientX;
            dragState.lastMoveY = e.clientY;
            function activateDrag(ev) {
                if (dragState.activated) return;
                dragState.activated = true;
                dragState.dragging = true;
                const itemObj = getItemObj(type, categoryId, index);
                dragState.cardEl = createDragCardPreview(itemObj, dragState.lastMoveX, dragState.lastMoveY);
                itemEl.classList.add('drag-source');
                document.body.classList.add('dragging-active');
            }
            function onMouseMove(ev) {
                dragState.offsetX = ev.clientX - dragState.startX;
                dragState.offsetY = ev.clientY - dragState.startY;
                dragState.lastMoveX = ev.clientX;
                dragState.lastMoveY = ev.clientY;
                if (!dragState.activated && (Math.abs(dragState.offsetX) > 5 || Math.abs(dragState.offsetY) > 5)) {
                    clearTimeout(dragState.activationTimeout);
                    cleanupDragState();
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    return;
                }
                if (dragState.activated && dragState.cardEl) {
                    dragState.cardEl.style.left = (ev.clientX - dragState.cardOffsetX) + 'px';
                    dragState.cardEl.style.top = (ev.clientY - dragState.cardOffsetY) + 'px';
                    highlightDropTarget(ev.clientX, ev.clientY);
                    autoScrollIfNeeded(ev.clientY);
                }
            }
            function onMouseUp(ev) {
                clearTimeout(dragState.activationTimeout);
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                if (dragState.activated && dragState.dragging) {
                    finalizeDrop(ev.clientX, ev.clientY);
                }
                cleanupDragState();
            }
            dragState.activationTimeout = setTimeout(() => {
                activateDrag(e);
            }, DRAG_ACTIVATION_DELAY);
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        } catch(e) {
            console.error('handleDragMouseDown error:', e);
        }
    }

    function handleDragTouchStart(e) {
        try {
            if (e.touches.length > 1) return;
            const itemEl = e.currentTarget;
            const dataItemsEl = itemEl.closest('.data-items');
            if (!dataItemsEl) return;
            const type = dataItemsEl.dataset.type;
            const categoryId = dataItemsEl.dataset.category;
            const index = +itemEl.dataset.index;
            const touch = e.touches[0];
            dragState.dragging = false;
            dragState.activated = false;
            dragState.dragItem = itemEl;
            dragState.dragType = type;
            dragState.dragCategoryId = categoryId;
            dragState.dragIndex = index;
            dragState.startX = touch.clientX;
            dragState.startY = touch.clientY;
            dragState.offsetX = 0;
            dragState.offsetY = 0;
            dragState.lastMoveX = touch.clientX;
            dragState.lastMoveY = touch.clientY;
            isTouchDrag = false;
            let dragActivated = false;
            dragLongPressTimer = setTimeout(()=>{
                isTouchDrag = true;
                dragActivated = true;
                dragState.activated = true;
                dragState.dragging = true;
                const itemObj = getItemObj(type, categoryId, index);
                dragState.cardEl = createDragCardPreview(itemObj, dragState.lastMoveX, dragState.lastMoveY);
                itemEl.classList.add('drag-source');
                document.body.classList.add('dragging-active');
                document.body.style.overscrollBehaviorY = 'none';
            }, DRAG_ACTIVATION_DELAY);
            function onTouchMove(ev) {
                const t = ev.touches[0];
                dragState.offsetX = t.clientX - dragState.startX;
                dragState.offsetY = t.clientY - dragState.startY;
                dragState.lastMoveX = t.clientX;
                dragState.lastMoveY = t.clientY;
                if (!dragActivated && (Math.abs(dragState.offsetX) > 7 || Math.abs(dragState.offsetY) > 7)) {
                    clearTimeout(dragLongPressTimer);
                    dragLongPressTimer = null;
                    cleanupDragState();
                    document.removeEventListener('touchmove', onTouchMove);
                    document.removeEventListener('touchend', onTouchEnd);
                    return;
                }
                if (dragActivated && dragState.cardEl) {
                    ev.preventDefault();
                    dragState.cardEl.style.left = (t.clientX - dragState.cardOffsetX) + 'px';
                    dragState.cardEl.style.top = (t.clientY - dragState.cardOffsetY) + 'px';
                    highlightDropTarget(t.clientX, t.clientY);
                    autoScrollIfNeeded(t.clientY);
                }
            }
            function onTouchEnd(ev) {
                clearTimeout(dragLongPressTimer);
                dragLongPressTimer = null;
                document.body.style.overscrollBehaviorY = '';
                document.removeEventListener('touchmove', onTouchMove);
                document.removeEventListener('touchend', onTouchEnd);
                if (dragActivated && dragState.dragging) {
                    const t = ev.changedTouches[0];
                    finalizeDrop(t.clientX, t.clientY);
                }
                cleanupDragState();
            }
            document.addEventListener('touchmove', onTouchMove, {passive:false});
            document.addEventListener('touchend', onTouchEnd, {passive:false});
        } catch(e) {
            console.error('handleDragTouchStart error:', e);
        }
    }

    function getItemObj(type, categoryId, index) {
        try {
            const cat = apiData[type].category.find(c=>c.id===categoryId);
            if (cat && cat.data && cat.data[index]) return cat.data[index];
            return {};
        } catch(e){ return {}; }
    }
    function highlightDropTarget(x, y) {
        try {
            document.querySelectorAll('.drop-indicator').forEach(e=>e.remove());
            document.querySelectorAll('.data-item').forEach(e=>e.classList.remove('drop-hover'));
            let found = false;
            document.querySelectorAll('.data-item').forEach(itemEl => {
                const rect = itemEl.getBoundingClientRect();
                if (y > rect.top && y < rect.bottom && x > rect.left && x < rect.right) {
                    found = true;
                    itemEl.classList.add('drop-hover');
                    const centerY = rect.top + rect.height/2;
                    let indicator = document.createElement('div');
                    indicator.className = 'drop-indicator';
                    indicator.style.position = 'absolute';
                    indicator.style.left = 0;
                    indicator.style.right = 0;
                    indicator.style.height = '4px';
                    indicator.style.background = 'linear-gradient(90deg,#4fc3f7 0%,#1976d2 100%)';
                    indicator.style.borderRadius = '2px';
                    indicator.style.boxShadow = '0 1px 4px 0 rgba(33,150,243,0.15)';
                    indicator.style.pointerEvents = 'none';
                    if (y < centerY) {
                        indicator.style.top = '-2px';
                        itemEl.parentNode.insertBefore(indicator, itemEl);
                        dragState.dropTargetIndex = +itemEl.dataset.index;
                    } else {
                        indicator.style.bottom = '-2px';
                        if (itemEl.nextSibling)
                            itemEl.parentNode.insertBefore(indicator, itemEl.nextSibling);
                        else
                            itemEl.parentNode.appendChild(indicator);
                        dragState.dropTargetIndex = +itemEl.dataset.index + 1;
                    }
                    dragState.dropTargetType = itemEl.closest('.data-items').dataset.type;
                    dragState.dropTargetCategoryId = itemEl.closest('.data-items').dataset.category;
                    dragState.lastOver = itemEl;
                }
            });
            if (!found) {
                document.querySelectorAll('.data-items').forEach(container => {
                    const rect = container.getBoundingClientRect();
                    if (y > rect.top && y < rect.bottom && x > rect.left && x < rect.right) {
                        let indicator = document.createElement('div');
                        indicator.className = 'drop-indicator';
                        indicator.style.position = 'absolute';
                        indicator.style.left = 0;
                        indicator.style.right = 0;
                        indicator.style.height = '4px';
                        indicator.style.background = 'linear-gradient(90deg,#4fc3f7 0%,#1976d2 100%)';
                        indicator.style.borderRadius = '2px';
                        indicator.style.bottom = '-2px';
                        indicator.style.boxShadow = '0 1px 4px 0 rgba(33,150,243,0.15)';
                        indicator.style.pointerEvents = 'none';
                        container.appendChild(indicator);
                        dragState.dropTargetType = container.dataset.type;
                        dragState.dropTargetCategoryId = container.dataset.category;
                        dragState.dropTargetIndex = container.children.length;
                    }
                });
            }
        } catch(e) {
            // ignore
        }
    }
    function finalizeDrop(x, y) {
        try {
            document.querySelectorAll('.drop-indicator').forEach(e=>e.remove());
            document.querySelectorAll('.data-item').forEach(e=>e.classList.remove('drop-hover'));
            if (dragState.dropTargetType && dragState.dropTargetCategoryId != null && dragState.dropTargetIndex != null) {
                if (
                    dragState.dragType === dragState.dropTargetType &&
                    dragState.dragCategoryId === dragState.dropTargetCategoryId &&
                    dragState.dragIndex === dragState.dropTargetIndex
                ) return;
                moveItem(
                    dragState.dragType,
                    dragState.dragCategoryId,
                    dragState.dragIndex,
                    dragState.dropTargetType,
                    dragState.dropTargetCategoryId,
                    dragState.dropTargetIndex
                );
                updateUI();
            }
        } catch(e) {
            // ignore
        }
    }
    function autoScrollIfNeeded(mouseY) {
        const winH = window.innerHeight;
        const threshold = 60;
        if (mouseY < threshold) {
            if (!dragState.autoScrollInterval) {
                dragState.autoScrollInterval = setInterval(()=>window.scrollBy(0, -12), 16);
            }
        } else if (mouseY > winH - threshold) {
            if (!dragState.autoScrollInterval) {
                dragState.autoScrollInterval = setInterval(()=>window.scrollBy(0, 12), 16);
            }
        } else {
            if (dragState.autoScrollInterval) {
                clearInterval(dragState.autoScrollInterval);
                dragState.autoScrollInterval = null;
            }
        }
    }
    function cleanupDragState() {
        removeDragCardPreview();
        if (dragState.dragItem) dragState.dragItem.classList.remove('drag-source');
        document.body.classList.remove('dragging-active');
        document.body.style.overscrollBehaviorY = '';
        document.querySelectorAll('.drop-indicator').forEach(e=>e.remove());
        document.querySelectorAll('.data-item').forEach(e=>e.classList.remove('drop-hover'));
        if (dragState.autoScrollInterval) clearInterval(dragState.autoScrollInterval);
        dragState = {
            dragging: false, dragItem: null, dragType: null, dragCategoryId: null, dragIndex: null,
            cardEl: null, cardOffsetX: 0, cardOffsetY: 0, startX: 0, startY: 0, offsetX: 0, offsetY: 0,
            dropTargetType: null, dropTargetCategoryId: null, dropTargetIndex: null, lastOver: null, autoScrollInterval:null,
            activated: false, activationTimeout: null, lastMoveX: 0, lastMoveY: 0
        };
    }
    function moveItem(fromType, fromCategoryId, fromIndex, toType, toCategoryId, toIndex) {
        try {
            const sourceCat = apiData[fromType].category.find(c => c.id === fromCategoryId);
            const targetCat = apiData[toType].category.find(c => c.id === toCategoryId);
            if (sourceCat && sourceCat.data && targetCat) {
                if (!targetCat.data) targetCat.data = [];
                const [item] = sourceCat.data.splice(fromIndex, 1);
                targetCat.data.splice(toIndex, 0, item);
            }
        } catch(e) { }
    }

    document.getElementById('addNewItem').addEventListener('click', function() {
        try {
            const mainType = document.getElementById('mainType').value;
            const categorySelect = document.getElementById('category');
            const catOpt = categorySelect.selectedOptions[0];
            const categoryId = catOpt ? catOpt.dataset.id : "";
            const text = document.getElementById('symbolText').value.trim();
            const api = document.getElementById('apiCode').value.trim();
            const nameObj = {};
            supportedLanguages.forEach(lang => {
                const val = Array.from(document.getElementsByClassName('lang-code')).find(input=>input.value.trim()===lang);
                const textBox = val && val.parentElement.nextElementSibling.querySelector('.lang-value');
                const nameVal = textBox ? textBox.value.trim() : '';
                nameObj[lang] = nameVal;
            });
            if (!text || !api) {
                showToast('กรุณากรอกข้อมูลให้ครบ', 'error');
                return;
            }
            const apiFormat = /^(U\+[\dA-F]{4,6}|\\u[\dA-F]{4,6})$/i;
            if (!apiFormat.test(api)) {
                showToast('รูปแบบรหัส API ไม่ถูกต้อง', 'error');
                return;
            }
            let categoryData = apiData[mainType].category.find(c => c.id === categoryId);
            if (!categoryData) {
                let nameMap = {};
                supportedLanguages.forEach(lang => {
                    nameMap[lang] = categoryId;
                });
                if (categoryNameMap[mainType]) {
                    const found = categoryNameMap[mainType].find(x => x.id === categoryId);
                    if (found) {
                        supportedLanguages.forEach(lang => {
                            nameMap[lang] = found[lang] || categoryId;
                        });
                    }
                }
                categoryData = { id: categoryId, name: nameMap.en || categoryId, nameObj: nameMap, data: [] };
                apiData[mainType].category.push(categoryData);
            }
            if (!categoryData.data) categoryData.data = [];
            const newId = "item_" + Date.now() + "_" + Math.floor(Math.random()*1000000);
            categoryData.data.push({
                id: newId,
                api,
                text,
                nameObj
            });
            clearForm();
            updateUI();
            showToast('เพิ่มข้อมูลสำเร็จ', 'success');
        } catch(e){ showToast('เกิดข้อผิดพลาดขณะเพิ่มข้อมูล', 'error'); }
    });

    document.getElementById('toggleCategoryLangInput').onclick = function(){
        try {
            const sec = document.getElementById('categoryLangInputSection');
            sec.style.display = sec.style.display==='none'?'block':'none';
        } catch(e){}
    };
    document.getElementById('confirmAddCategoryLang').onclick = function(){
        try {
            const rows = Array.from(document.querySelectorAll('#categoryLangInputs tr'));
            const nameObj = {};
            let enVal = '', thVal = '';
            for(const row of rows){
                const code = row.querySelector('.cat-lang-code')?.value.trim();
                const val = row.querySelector('.cat-lang-value')?.value.trim();
                if(code && val){
                    nameObj[code] = val;
                    if(code==='en') enVal = val;
                    if(code==='th') thVal = val;
                }
            }
            if(!enVal || !thVal){
                showToast('ต้องใส่ชื่อหมวดหมู่ภาษาไทยและอังกฤษ', 'error');
                return;
            }
            const mainType = document.getElementById('mainType').value;
            const catId = enVal.toLowerCase().replace(/[^a-z0-9]+/g, '_');
            if(apiData[mainType].category.some(c=>c.id===catId)){
                showToast('หมวดหมู่นี้มีอยู่แล้ว', 'error');
                return;
            }
            apiData[mainType].category.push({
                id: catId,
                name: enVal,
                nameObj: nameObj,
                data: []
            });
            if(!categoryNameMap[mainType]) categoryNameMap[mainType]=[];
            categoryNameMap[mainType].push({ ...nameObj, id: catId });
            document.getElementById('categoryLangInputSection').style.display='none';
            generateCategoryLangInputs();
            updateUI();
            showToast('เพิ่มหมวดหมู่สำเร็จ', 'success');
        } catch(e) { showToast('เกิดข้อผิดพลาดขณะเพิ่มหมวดหมู่', 'error'); }
    };
    function validateInput(text, api) {
        if (!text || !api) {
            showToast('กรุณากรอกข้อมูลให้ครบ', 'error');
            return false;
        }
        const apiFormat = /^(U\+[\dA-F]{4,6}|\\u[\dA-F]{4,6})$/i;
        if (!apiFormat.test(api)) {
            showToast('รูปแบบรหัส API ไม่ถูกต้อง', 'error');
            return false;
        }
        return true;
    }
    function clearForm() {
        document.getElementById('symbolText').value = '';
        document.getElementById('apiCode').value = '';
        generateLangInputs();
    }
    window.showToast = showToast;
    function showToast(message, type = 'info') {
        try {
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.textContent = message;
            const container = document.getElementById('toastContainer');
            container.appendChild(toast);
            setTimeout(() => { toast.remove(); }, 3000);
        } catch(e) { alert(message); }
    }
    document.getElementById('themeSwitcher').addEventListener('click', function() {
        isDarkMode = !isDarkMode;
        localStorage.setItem('darkMode', isDarkMode);
        updateTheme();
    });

    searchInput.addEventListener('input', debounce(renderData, 300));
    filterType.addEventListener('change', renderData);
    filterCategory.addEventListener('change', renderData);
    document.getElementById('mainType').addEventListener('change', function(){
        updateCategorySelect();
        generateLangInputs();
        generateCategoryLangInputs();
    });

    document.getElementById('clearForm').onclick = function(){
        clearForm();
    };

    document.getElementById('copyJSON').addEventListener('click', function() {
        try {
            const jsonString = JSON.stringify(oldToNewFormat(apiData), null, 2);
            navigator.clipboard.writeText(jsonString)
                .then(() => showToast('คัดลอก JSON สำเร็จ', 'success'))
                .catch(() => showToast('ไม่สามารถคัดลอก JSON ได้', 'error'));
        } catch(e) { showToast('ไม่สามารถคัดลอก JSON ได้', 'error'); }
    });

    document.getElementById('exportCSV').addEventListener('click', function() {
        try {
            const csv = convertToCSV();
            downloadCSV(csv);
            showToast('ส่งออก CSV สำเร็จ', 'success');
        } catch(e) { showToast('ส่งออก CSV ไม่สำเร็จ', 'error'); }
    });

    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
    function convertToCSV() {
        const langArr = supportedLanguages;
        const header = ['Type', 'TypeID', 'Category', 'CategoryID', 'Text', 'API Code', ...langArr.map(l=>`Name(${l.toUpperCase()})`)];
        const rows = [header];
        Object.entries(apiData).forEach(([type, data]) => {
            if (data.category) {
                data.category.forEach(category => {
                    if (category.data) {
                        category.data.forEach(item => {
                            rows.push([
                                type,
                                data.id || type,
                                category.name,
                                category.id || "",
                                item.text,
                                item.api,
                                ...langArr.map(l => (item.nameObj && item.nameObj[l]) || "")
                            ]);
                        });
                    }
                });
            }
        });
        return rows.map(row =>
            row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(',')
        ).join('\n');
    }
    function downloadCSV(csv) {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `api_database_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
    loadInitialData();
});