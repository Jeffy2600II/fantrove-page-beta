// @ts-expect-error TS(2339): Property 'webkitTapHighlightColor' does not exist ... Remove this comment to see the full error message
document.documentElement.style.webkitTapHighlightColor = 'transparent';
const contentFiles = [
    { name: "Symbols Page 1", path: "/assets/json/content/symbols-page1.min.json" },
    { name: "Symbols Page 2", path: "/assets/json/content/symbols-page2.min.json" },
    { name: "Emojis Page 1", path: "/assets/json/content/emojis-page1.min.json" }
];
let contentData = [];
let database = null;
let currentFile = contentFiles[0].path;
let groupedData = {};
let selectedCategory = null;
// Field standards for each type (button: API OR content, not both)
const STANDARD_BUTTON_API = () => ({
    id: `content-button_${Date.now()}`,
    type: 'button',
    api: '',
    name: '',
    copyable: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    category: selectedCategory || ''
});
const STANDARD_BUTTON_CONTENT = () => ({
    id: `content-button_${Date.now()}`,
    type: 'button',
    content: '',
    name: '',
    copyable: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    category: selectedCategory || ''
});
const STANDARD_CARD = () => ({
    title: '',
    description: '',
    image: '',
    link: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
});
const STANDARD_GROUP = () => ({
    id: `content-group_${Date.now()}`,
    group: {
        type: 'card',
        header: '',
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }
});
// Load emoji/symbol database for autocomplete
async function loadDatabase() {
    if (database)
        return database;
    const res = await fetch("/assets/json/api-database.min.json");
    database = await res.json();
    return database;
}
// Load content from selected file
async function loadContentFile(path) {
    try {
        const res = await fetch(path);
        contentData = await res.json();
        groupContentData();
        renderCategoryList();
        renderPreview();
    }
    catch {
        alert("ไม่สามารถโหลดไฟล์เนื้อหาได้");
        contentData = [];
        groupContentData();
        renderCategoryList();
        renderPreview();
    }
}
// Render file selector dropdown
function renderFileSelector() {
    const selector = document.getElementById("file-selector");
    selector.innerHTML = "";
    contentFiles.forEach(f => {
        const opt = document.createElement("option");
        opt.value = f.path;
        opt.textContent = f.name;
        selector.appendChild(opt);
    });
    // @ts-expect-error TS(2339): Property 'value' does not exist on type 'HTMLEleme... Remove this comment to see the full error message
    selector.value = currentFile;
    selector.onchange = async (e) => {
        // @ts-expect-error TS(2339): Property 'value' does not exist on type 'EventTarg... Remove this comment to see the full error message
        currentFile = e.target.value;
        await loadContentFile(currentFile);
    };
}
// Group content data by category
function groupContentData() {
    groupedData = {};
    for (const item of contentData) {
        let category = item.category || 'อื่นๆ';
        if (item.group && item.group.header) {
            if (typeof item.group.header === 'string')
                category = item.group.header;
            else if (item.group.header.title) {
                if (typeof item.group.header.title === 'object')
                    category = item.group.header.title['th'] || item.group.header.title['en'] || 'หมวดหมู่';
                else
                    category = item.group.header.title;
            }
        }
        else if (item.group && item.group.type) {
            category = item.group.type;
        }
        else if (item.type) {
            category = item.type;
        }
        if (item.api && database) {
            const found = findApiInDb(item.api);
            if (found)
                category = found.name?.th || found.name?.en || category;
        }
        if (!groupedData[category])
            groupedData[category] = [];
        groupedData[category].push(item);
    }
    const cats = Object.keys(groupedData);
    selectedCategory = cats.length ? selectedCategory || cats[0] : null;
}
// Render category selection
function renderCategoryList() {
    const catList = document.getElementById('category-list');
    catList.innerHTML = '';
    Object.entries(groupedData).forEach(([cat, items]) => {
        const div = document.createElement('div');
        div.className = 'category-item' + (selectedCategory === cat ? ' active' : '');
        div.textContent = cat;
        div.onclick = () => {
            selectedCategory = cat;
            renderCategoryList();
            renderPreview();
        };
        catList.appendChild(div);
    });
}
// Inline Edit State
let inlineEdit = null;
// Render preview (grouped by category)
function renderPreview() {
    const preview = document.getElementById('content-preview');
    preview.innerHTML = '';
    if (!selectedCategory || !groupedData[selectedCategory])
        return;
    groupedData[selectedCategory].forEach((item, idx) => {
        // BUTTON
        if (item.type === 'button' || item.content || item.api) {
            let text = item.content || '';
            if (item.api && database) {
                const found = findApiInDb(item.api);
                if (found)
                    text = found.text;
            }
            const btn = document.createElement('button');
            btn.className = 'preview-btn';
            btn.textContent = text;
            btn.title = item.api || '';
            btn.style.position = 'relative';
            btn.onclick = e => {
                e.preventDefault();
                showInlineEditForm('button', selectedCategory, idx, item);
            };
            preview.appendChild(btn);
        }
        // CARD GROUP
        if (item.group && item.group.type === 'card' && Array.isArray(item.group.items)) {
            item.group.items.forEach((card, cidx) => {
                const cardDiv = document.createElement('div');
                cardDiv.className = 'preview-card';
                cardDiv.style.position = 'relative';
                let imgSrc = card.image || '';
                let title = card.title || '';
                let desc = card.description || '';
                let link = card.link || '';
                if (typeof title === 'object')
                    title = title['th'] || title['en'] || '';
                if (typeof desc === 'object')
                    desc = desc['th'] || desc['en'] || '';
                if (imgSrc) {
                    const img = document.createElement('img');
                    img.src = imgSrc;
                    cardDiv.appendChild(img);
                }
                const contentDiv = document.createElement('div');
                contentDiv.className = 'preview-content';
                const titleDiv = document.createElement('div');
                titleDiv.className = 'preview-title';
                titleDiv.textContent = title;
                contentDiv.appendChild(titleDiv);
                if (desc) {
                    const descDiv = document.createElement('div');
                    descDiv.className = 'preview-desc';
                    descDiv.textContent = desc;
                    contentDiv.appendChild(descDiv);
                }
                if (link) {
                    const linkDiv = document.createElement('div');
                    linkDiv.className = 'preview-link';
                    linkDiv.textContent = 'ดูรายละเอียด';
                    linkDiv.onclick = () => window.open(link, '_blank');
                    contentDiv.appendChild(linkDiv);
                }
                cardDiv.appendChild(contentDiv);
                // Inline edit button
                const editBtn = document.createElement('button');
                editBtn.className = 'edit-inline-card';
                editBtn.textContent = 'แก้ไข';
                editBtn.onclick = e => {
                    e.stopPropagation();
                    showInlineEditForm('card', selectedCategory, idx, item, cidx, card);
                };
                cardDiv.appendChild(editBtn);
                preview.appendChild(cardDiv);
            });
        }
        // BUTTON GROUP
        if (item.group && item.group.type === 'button' && Array.isArray(item.group.items)) {
            item.group.items.forEach((btnItem, bidx) => {
                let text = btnItem.content || '';
                if (btnItem.api && database) {
                    const found = findApiInDb(btnItem.api);
                    if (found)
                        text = found.text;
                }
                const btn = document.createElement('button');
                btn.className = 'preview-btn';
                btn.textContent = text;
                btn.title = btnItem.api || '';
                btn.style.position = 'relative';
                btn.onclick = e => {
                    e.preventDefault();
                    showInlineEditForm('group-btn', selectedCategory, idx, item, bidx, btnItem);
                };
                preview.appendChild(btn);
            });
        }
    });
}
// Modal overlay helpers
function openModal(contentHtml, onClose) {
    const overlay = document.getElementById('modal-overlay');
    overlay.innerHTML = '';
    overlay.classList.add('active');
    overlay.appendChild(contentHtml);
    overlay.onclick = e => {
        if (e.target === overlay) {
            overlay.classList.remove('active');
            overlay.innerHTML = '';
            if (onClose)
                onClose();
        }
    };
}
function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('active');
    overlay.innerHTML = '';
}
// Modal alert (UX)
function showModalAlert(msg) {
    const overlay = document.getElementById('modal-overlay');
    let alertDiv = overlay.querySelector('.modal-alert');
    if (!alertDiv) {
        alertDiv = document.createElement('div');
        alertDiv.className = 'modal-alert';
        // @ts-expect-error TS(2339): Property 'style' does not exist on type 'Element'.
        alertDiv.style = `
      position: absolute; top: 18px; left: 50%; transform: translateX(-50%);
      background: #ffebee; color: #d32f2f; font-weight:600; padding:10px 20px; border-radius:9px; font-size:1rem; z-index:8001; box-shadow:0 1px 6px rgba(220,0,0,.07);
    `;
        overlay.appendChild(alertDiv);
    }
    alertDiv.textContent = msg;
    setTimeout(() => alertDiv.remove(), 2400);
}
// Overlay for add content (modal)
function openAddButtonDialog(category) {
    // Modal Card
    const modalCard = document.createElement('div');
    modalCard.className = 'modal-card';
    // Title
    modalCard.innerHTML = `<div class="modal-title">เพิ่มเนื้อหาใหม่ (Button)</div>`;
    // Type Choice Cards
    const typeChoiceDiv = document.createElement('div');
    typeChoiceDiv.className = 'modal-type-choice';
    typeChoiceDiv.innerHTML = `
    <div class="type-card selected" data-type="api">
      <span class="type-icon">🧩</span>
      <span class="type-label">API (Emoji/Symbol)</span>
    </div>
    <div class="type-card" data-type="content">
      <span class="type-icon">🔤</span>
      <span class="type-label">Content (ข้อความ/สัญลักษณ์)</span>
    </div>
  `;
    modalCard.appendChild(typeChoiceDiv);
    // Form Fields
    const formFields = document.createElement('div');
    formFields.className = 'modal-form-fields';
    modalCard.appendChild(formFields);
    // Modal Actions
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'modal-actions';
    actionsDiv.innerHTML = `
    <button id="add-inline">เพิ่ม</button>
    <button class="cancel" id="cancel-add">ยกเลิก</button>
  `;
    modalCard.appendChild(actionsDiv);
    // Show Modal
    // @ts-expect-error TS(2554): Expected 2 arguments, but got 1.
    openModal(modalCard);
    // State
    let selectedType = 'api';
    renderModalFormFields(formFields, selectedType, category);
    // Type card selection logic
    Array.from(typeChoiceDiv.children).forEach(card => {
        // @ts-expect-error TS(2339): Property 'onclick' does not exist on type 'Element... Remove this comment to see the full error message
        card.onclick = () => {
            Array.from(typeChoiceDiv.children).forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedType = card.getAttribute('data-type');
            renderModalFormFields(formFields, selectedType, category);
        };
    });
    // Add logic
    // @ts-expect-error TS(2339): Property 'onclick' does not exist on type 'Element... Remove this comment to see the full error message
    modalCard.querySelector('#add-inline').onclick = () => {
        let newItem;
        if (selectedType === 'api') {
            // @ts-expect-error TS(2339): Property 'value' does not exist on type 'Element'.
            const api = formFields.querySelector('input[name="api"]').value;
            if (!api)
                return showModalAlert('กรุณาระบุ API (emoji/symbol code)');
            newItem = {
                id: `content-button_${Date.now()}`,
                type: 'button',
                api: api,
                // @ts-expect-error TS(2339): Property 'value' does not exist on type 'Element'.
                name: formFields.querySelector('input[name="name"]').value,
                copyable: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                // @ts-expect-error TS(2339): Property 'value' does not exist on type 'Element'.
                category: formFields.querySelector('input[name="category"]').value || category
            };
        }
        else {
            // @ts-expect-error TS(2339): Property 'value' does not exist on type 'Element'.
            const content = formFields.querySelector('input[name="content"]').value;
            if (!content)
                return showModalAlert('กรุณาระบุ Content');
            newItem = {
                id: `content-button_${Date.now()}`,
                type: 'button',
                content: content,
                // @ts-expect-error TS(2339): Property 'value' does not exist on type 'Element'.
                name: formFields.querySelector('input[name="name"]').value,
                copyable: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                // @ts-expect-error TS(2339): Property 'value' does not exist on type 'Element'.
                category: formFields.querySelector('input[name="category"]').value || category
            };
        }
        groupedData[category].push(newItem);
        contentData.push(newItem);
        groupContentData();
        renderCategoryList();
        renderPreview();
        closeModal();
    };
    // @ts-expect-error TS(2339): Property 'onclick' does not exist on type 'Element... Remove this comment to see the full error message
    modalCard.querySelector('#cancel-add').onclick = () => {
        closeModal();
    };
}
// Modal form fields renderer
function renderModalFormFields(div, type, category) {
    div.innerHTML = '';
    if (type === 'api') {
        div.innerHTML += `
      <label for="api">API (emoji/symbol code)</label>
      <input name="api" type="text" autocomplete="off" placeholder="เช่น U+1F600" required />
    `;
    }
    else {
        div.innerHTML += `
      <label for="content">Content (ข้อความ/สัญลักษณ์)</label>
      <input name="content" type="text" autocomplete="off" placeholder="เช่น สวัสดี 😊" required />
    `;
    }
    div.innerHTML += `
    <label for="name">Name (ชื่อปุ่ม)</label>
    <input name="name" type="text" autocomplete="off" placeholder="ชื่อปุ่ม"/>
    <label for="category">Category (หมวดหมู่)</label>
    <input name="category" type="text" autocomplete="off" value="${category || ''}" />
  `;
}
// Overlay for edit (reuse modal)
function showInlineEditForm(type, cat, idx, item, subIdx = null, subItem = null) {
    const modalCard = document.createElement('div');
    modalCard.className = 'modal-card';
    let isApi, obj;
    if (type === 'button') {
        obj = item;
        isApi = !!item.api && !item.content;
        modalCard.innerHTML = `<div class="modal-title">แก้ไข Button (${isApi ? 'API' : 'Content'})</div>`;
    }
    else if (type === 'group-btn') {
        obj = subItem;
        isApi = !!subItem.api && !subItem.content;
        modalCard.innerHTML = `<div class="modal-title">แก้ไข Button ในกลุ่ม (${isApi ? 'API' : 'Content'})</div>`;
    }
    else if (type === 'card') {
        obj = subItem;
        modalCard.innerHTML = `<div class="modal-title">แก้ไข Card</div>`;
    }
    // Type selector (only for button/group-btn)
    let typeChoiceDiv;
    if (type === 'button' || type === 'group-btn') {
        typeChoiceDiv = document.createElement('div');
        typeChoiceDiv.className = 'modal-type-choice';
        typeChoiceDiv.innerHTML = `
      <div class="type-card${isApi ? ' selected' : ''}" data-type="api">
        <span class="type-icon">🧩</span>
        <span class="type-label">API (Emoji/Symbol)</span>
      </div>
      <div class="type-card${!isApi ? ' selected' : ''}" data-type="content">
        <span class="type-icon">🔤</span>
        <span class="type-label">Content (ข้อความ/สัญลักษณ์)</span>
      </div>
    `;
        modalCard.appendChild(typeChoiceDiv);
    }
    // Form fields
    const formFields = document.createElement('div');
    formFields.className = 'modal-form-fields';
    modalCard.appendChild(formFields);
    // Modal Actions
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'modal-actions';
    actionsDiv.innerHTML = `
    <button id="save-inline">บันทึก</button>
    <button class="cancel" id="cancel-inline">ยกเลิก</button>
    <button class="delete" id="delete-inline">ลบ</button>
  `;
    modalCard.appendChild(actionsDiv);
    // Show modal
    // @ts-expect-error TS(2554): Expected 2 arguments, but got 1.
    openModal(modalCard);
    // State
    let selectedType = (type === 'card') ? 'card' : (isApi ? 'api' : 'content');
    renderModalEditFields(formFields, selectedType, obj, cat);
    // Type card selection
    if (typeChoiceDiv) {
        Array.from(typeChoiceDiv.children).forEach(card => {
            // @ts-expect-error TS(2339): Property 'onclick' does not exist on type 'unknown... Remove this comment to see the full error message
            card.onclick = () => {
                // @ts-expect-error TS(2339): Property 'classList' does not exist on type 'unkno... Remove this comment to see the full error message
                Array.from(typeChoiceDiv.children).forEach(c => c.classList.remove('selected'));
                // @ts-expect-error TS(2339): Property 'classList' does not exist on type 'unkno... Remove this comment to see the full error message
                card.classList.add('selected');
                // @ts-expect-error TS(2339): Property 'getAttribute' does not exist on type 'un... Remove this comment to see the full error message
                selectedType = card.getAttribute('data-type');
                renderModalEditFields(formFields, selectedType, obj, cat);
            };
        });
    }
    // Save logic
    // @ts-expect-error TS(2339): Property 'onclick' does not exist on type 'Element... Remove this comment to see the full error message
    modalCard.querySelector('#save-inline').onclick = () => {
        if (type === 'card') {
            // @ts-expect-error TS(2339): Property 'value' does not exist on type 'Element'.
            obj.title = formFields.querySelector('input[name="title"]').value;
            // @ts-expect-error TS(2339): Property 'value' does not exist on type 'Element'.
            obj.description = formFields.querySelector('input[name="desc"]').value;
            // @ts-expect-error TS(2339): Property 'value' does not exist on type 'Element'.
            obj.image = formFields.querySelector('input[name="image"]').value;
            // @ts-expect-error TS(2339): Property 'value' does not exist on type 'Element'.
            obj.link = formFields.querySelector('input[name="link"]').value;
            obj.updatedAt = new Date().toISOString();
        }
        else {
            if (selectedType === 'api') {
                // @ts-expect-error TS(2339): Property 'value' does not exist on type 'Element'.
                obj.api = formFields.querySelector('input[name="api"]').value;
                obj.content = '';
                if (!obj.api)
                    return showModalAlert('กรุณาระบุ API');
            }
            else {
                // @ts-expect-error TS(2339): Property 'value' does not exist on type 'Element'.
                obj.content = formFields.querySelector('input[name="content"]').value;
                obj.api = '';
                if (!obj.content)
                    return showModalAlert('กรุณาระบุ Content');
            }
            // @ts-expect-error TS(2339): Property 'value' does not exist on type 'Element'.
            obj.name = formFields.querySelector('input[name="name"]').value;
            // @ts-expect-error TS(2339): Property 'value' does not exist on type 'Element'.
            obj.category = formFields.querySelector('input[name="category"]').value || cat;
            obj.updatedAt = new Date().toISOString();
        }
        groupContentData();
        renderCategoryList();
        renderPreview();
        closeModal();
    };
    // @ts-expect-error TS(2339): Property 'onclick' does not exist on type 'Element... Remove this comment to see the full error message
    modalCard.querySelector('#cancel-inline').onclick = () => {
        closeModal();
    };
    // @ts-expect-error TS(2339): Property 'onclick' does not exist on type 'Element... Remove this comment to see the full error message
    modalCard.querySelector('#delete-inline').onclick = () => {
        if (type === 'card') {
            item.group.items.splice(subIdx, 1);
        }
        else if (type === 'group-btn') {
            item.group.items.splice(subIdx, 1);
        }
        else if (type === 'button') {
            groupedData[cat].splice(idx, 1);
        }
        contentData = Object.values(groupedData).flat();
        groupContentData();
        renderCategoryList();
        renderPreview();
        closeModal();
    };
}
// Modal edit fields renderer
function renderModalEditFields(div, type, obj, cat) {
    div.innerHTML = '';
    if (type === 'api') {
        div.innerHTML += `
      <label for="api">API (emoji/symbol code)</label>
      <input name="api" type="text" autocomplete="off" value="${obj.api || ''}" required />
    `;
    }
    else if (type === 'content') {
        div.innerHTML += `
      <label for="content">Content (ข้อความ/สัญลักษณ์)</label>
      <input name="content" type="text" autocomplete="off" value="${obj.content || ''}" required />
    `;
    }
    if (type === 'api' || type === 'content') {
        div.innerHTML += `
      <label for="name">Name (ชื่อปุ่ม)</label>
      <input name="name" type="text" autocomplete="off" value="${obj.name || ''}"/>
      <label for="category">Category (หมวดหมู่)</label>
      <input name="category" type="text" autocomplete="off" value="${obj.category || cat || ''}" />
    `;
    }
    if (type === 'card') {
        div.innerHTML += `
      <label for="title">Title</label>
      <input name="title" type="text" autocomplete="off" value="${obj.title || ''}" required />
      <label for="desc">Description</label>
      <input name="desc" type="text" autocomplete="off" value="${obj.description || ''}" />
      <label for="image">Image URL</label>
      <input name="image" type="text" autocomplete="off" value="${obj.image || ''}"/>
      <label for="link">Link URL</label>
      <input name="link" type="text" autocomplete="off" value="${obj.link || ''}"/>
    `;
    }
}
// Find api in database
function findApiInDb(api) {
    if (!database)
        return null;
    for (const type of database.type) {
        for (const cat of type.category) {
            for (const data of cat.data) {
                if (data.api === api)
                    return data;
            }
        }
    }
    return null;
}
// เพิ่มเนื้อหาใหม่ในหมวดหมู่ที่เลือก (เปิด modal)
document.getElementById('add-content').onclick = () => {
    if (!selectedCategory)
        return;
    openAddButtonDialog(selectedCategory);
};
// Copy all content JSON
document.getElementById('copy-content').onclick = async () => {
    try {
        const json = JSON.stringify(contentData, null, 2);
        await navigator.clipboard.writeText(json);
        alert("คัดลอกข้อมูลไปยังคีย์บอร์ดแล้ว!");
    }
    catch (e) {
        alert("ไม่สามารถคัดลอกข้อมูลได้");
    }
};
// Close modal on ESC
window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closeModal();
    }
});
// Init
window.addEventListener('DOMContentLoaded', async () => {
    await loadDatabase();
    renderFileSelector();
    await loadContentFile(currentFile);
});
