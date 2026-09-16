import {TYPES,ENGINES,presentationPages,clone,uid,escapeHTML as h,validateQuestion,validateData} from './data.js?v=20260916-pages';
import {configured,demo,loadAdmin,saveAdmin,login,logout,getSession,signup,recover,updatePassword,acceptCallback} from './api.js?v=20260916-pages';
const $=s=>document.querySelector(s), form=$('#question-form');
let data,revision=0,busy=false,dirty=false,deleteId=null,imported=null;
let pagesDirty=false;
let activeEngine="single",activeView="bank",editorOrigin=null;
const editorDialog=$("#editor-dialog");
function status(message,error=false){$('#global-status').textContent=message;$('#global-status').style.color=error?'var(--danger)':'var(--green)';}
function error(message){if(!editorDialog.open){status(message,true);return;}$('#form-error').hidden=false;$('#form-error').textContent=message;$('#form-error').focus();}
function currentEngine(){return data.types.find(t=>t.id===$('#question-type').value)?.engine||'single';}
function selectedID(){return form.elements.id.value;}
function fillTypes(){const selected=$('#question-type').value;$('#question-type').innerHTML=data.types.map(t=>`<option value="${h(t.id)}">${h(t.label)}</option>`).join('');if(data.types.some(t=>t.id===selected))$('#question-type').value=selected;}
const engineOf=q=>data.types.find(t=>t.id===q.type)?.engine;
function initTabs(){
 $('#type-tabs').innerHTML=TYPES.map(t=>`<button type="button" id="tab-${t.engine}" role="tab" aria-controls="bank-panel" aria-selected="${t.engine===activeEngine}" tabindex="${t.engine===activeEngine?0:-1}" data-engine="${t.engine}"><span>${h(t.label)}</span><span class="tab-count">0</span></button>`).join('');
}
function selectTab(engine,focus=false){activeEngine=engine;$('#search').value='';renderList();if(focus)$(`#tab-${engine}`).focus();}
function setView(view){activeView=view;$('#bank-view').setAttribute('aria-pressed',String(view==='bank'));$('#queue-view').setAttribute('aria-pressed',String(view==='queue'));$('#type-tabs').hidden=view!=='bank';$('#bank-panel').hidden=view!=='bank';$('#queue-panel').hidden=view!=='queue';renderList();}
$('#type-tabs').onclick=e=>{const tab=e.target.closest('[data-engine]');if(tab)selectTab(tab.dataset.engine);};
$('#type-tabs').onkeydown=e=>{const tab=e.target.closest('[role="tab"]');if(!tab)return;const keys=['ArrowLeft','ArrowRight','Home','End'];if(!keys.includes(e.key))return;e.preventDefault();const i=TYPES.findIndex(t=>t.engine===tab.dataset.engine);const next=e.key==='Home'?0:e.key==='End'?TYPES.length-1:(i+(e.key==='ArrowRight'?1:-1)+TYPES.length)%TYPES.length;selectTab(TYPES[next].engine,true);};
$('#bank-view').onclick=()=>setView('bank');$('#queue-view').onclick=()=>setView('queue');$('#back-to-bank').onclick=()=>{$('#bank-view').click();$(`#tab-${activeEngine}`).focus();};
function choiceRow(text,index,correct,engine){return `<div class="choice-row"><span>${String.fromCharCode(65+index)}</span><input type="text" class="choice-text" value="${h(text)}" maxlength="4000" aria-label="Nội dung lựa chọn ${index+1}" required><label class="choice-correct" title="Đánh dấu đáp án đúng"><input type="${engine==='single'?'radio':'checkbox'}" name="correct-choice" value="${index}" aria-label="Lựa chọn ${index+1} là đáp án đúng" ${correct?'checked':''}></label>${engine==='multiple'?`<button type="button" class="quiet remove-choice" aria-label="Xóa lựa chọn ${index+1}">×</button>`:''}</div>`;}
function fields(q={}){
 const engine=currentEngine();let html='';
 if(['single','multiple'].includes(engine)) {const options=q.options||['','','',''];html=`<div class="field-box"><strong>Các lựa chọn và đáp án</strong><p>${engine==='single'?'Đánh dấu tròn bên phải cho một đáp án đúng.':'Đánh dấu ô bên phải cho tất cả đáp án đúng (2–12 lựa chọn).'}</p><div id="choices">${options.map((t,i)=>choiceRow(t,i,(q.correct||[]).includes(i),engine)).join('')}</div>${engine==='multiple'?'<button type="button" id="add-choice" class="secondary">+ Thêm lựa chọn</button>':''}</div>`;}
 if(engine==='boolean')html=`<fieldset class="field-box"><legend>Đáp án đúng</legend><label class="check-label"><input type="radio" name="boolean-answer" value="true" ${q.answer!==false?'checked':''}>Đúng</label><label class="check-label"><input type="radio" name="boolean-answer" value="false" ${q.answer===false?'checked':''}>Sai</label></fieldset>`;
 if(engine==='fill')html=`<div class="field-box"><label>Đoạn văn có chỗ trống<textarea id="fill-template" rows="3" maxlength="4000" required placeholder="Lạy Cha chúng con ở trên {{…}}">${h(q.template||'')}</textarea></label><p>Dùng chính xác <code>{{…}}</code> cho mỗi chỗ trống. <button type="button" id="insert-blank" class="secondary">Chèn chỗ trống</button></p><label>Đáp án từng chỗ trống<textarea id="fill-answers" rows="3" required placeholder="Mỗi dòng là đáp án của một chỗ trống, theo thứ tự">${h((q.answers||[]).join('\n'))}</textarea></label><p>Số dòng đáp án phải bằng số chỗ trống.</p></div>`;
 if(engine==='match')html=`<div class="field-box"><strong>Các cặp nối đúng</strong><p>Mỗi dòng bên trái nối với dòng cùng vị trí bên phải. Khi trình chiếu, cột phải tự đảo thứ tự.</p><div class="form-grid"><label>Cột A<textarea id="match-left" rows="6" required placeholder="Mỗi dòng một nội dung">${h((q.pairs||[]).map(p=>p.left).join('\n'))}</textarea></label><label>Cột B (đáp án tương ứng)<textarea id="match-right" rows="6" required placeholder="Mỗi dòng một nội dung">${h((q.pairs||[]).map(p=>p.right).join('\n'))}</textarea></label></div></div>`;
 if(engine==='order')html=`<div class="field-box"><label>Các mục theo thứ tự ĐÚNG<textarea id="order-items" rows="6" required placeholder="Bước thứ nhất&#10;Bước thứ hai&#10;Bước thứ ba">${h((q.items||[]).join('\n'))}</textarea></label><p>Mỗi dòng một mục (2–12 mục). Website đảo thứ tự khi ra câu hỏi; khi hiện đáp án, giữ nguyên vị trí và thêm số thứ tự đúng bên cạnh.</p></div>`;
 if(engine==='short')html=`<label>Đáp án mẫu<textarea id="short-answer" rows="3" maxlength="4000" required placeholder="Nhập câu trả lời sẽ được công bố">${h(q.answer||'')}</textarea></label>`;
 $('#type-fields').innerHTML=html;
 if($('#add-choice'))$('#add-choice').onclick=()=>{const rows=[...document.querySelectorAll('.choice-row')];if(rows.length>=12)return;$('#choices').insertAdjacentHTML('beforeend',choiceRow('',rows.length,false,'multiple'));dirty=true;};
 if($('#insert-blank'))$('#insert-blank').onclick=()=>{const t=$('#fill-template');t.setRangeText('{{…}}',t.selectionStart,t.selectionEnd,'end');t.focus();dirty=true;};
}
$('#type-fields').addEventListener('click',e=>{const button=e.target.closest('.remove-choice');if(!button)return;if(document.querySelectorAll('.choice-row').length<=2)return;button.closest('.choice-row').remove();document.querySelectorAll('.choice-row').forEach((row,i)=>{row.querySelector('span').textContent=String.fromCharCode(65+i);row.querySelector('[name="correct-choice"]').value=i;});dirty=true;});
function questionRow(q,number,queue,selected){
 const position=selected.findIndex(item=>item.id===q.id)+1;
 return `<li class="question-row${q.enabled?' is-selected':''}" data-id="${h(q.id)}"><div class="question-row-content"><div class="row-top"><span class="row-number">${number}</span><span class="row-title">${h(q.prompt)}</span></div><div class="row-meta"><span>${h(data.types.find(t=>t.id===q.type).label)}</span><span>${q.seconds} giây</span>${!queue&&q.enabled?`<span class="selected-marker">Đã chọn · Câu ${position} trên trình chiếu</span>`:''}</div></div><div class="row-actions"><label class="check-label"><input type="checkbox" class="toggle-enabled" ${q.enabled?'checked':''} aria-label="Chọn câu ${number} để trình chiếu">${queue?'Đã chọn':'Trình chiếu'}</label>${queue?`<div class="reorder-controls"><button data-action="up" class="secondary" aria-label="Đưa câu ${number} lên" ${number===1?'disabled':''}>↑</button><button data-action="down" class="secondary" aria-label="Đưa câu ${number} xuống" ${number===selected.length?'disabled':''}>↓</button><label class="position-label">Vị trí<input type="number" class="position" aria-label="Vị trí trình chiếu câu ${number}" min="1" max="${selected.length}" value="${number}"></label></div>`:''}<button class="secondary" data-action="edit" aria-haspopup="dialog" aria-controls="editor-dialog">Sửa</button>${queue?'':'<button class="quiet" data-action="delete">Xóa</button>'}</div></li>`;
}
function fillPages(){
 const f=$('#pages-form'),pages=presentationPages(data);
 for(const key of ['opening','closing']){f.elements[`${key}-enabled`].checked=pages[key].enabled;f.elements[`${key}-title`].value=pages[key].title;f.elements[`${key}-body`].value=pages[key].body;}
 pagesDirty=false;
}
$('#pages-form').oninput=()=>{pagesDirty=true;$('#pages-status').textContent='Có thay đổi chưa lưu';};
$('#pages-form').onsubmit=async e=>{
 e.preventDefault();const f=e.target,next=clone(data);next.pages={};
 for(const key of ['opening','closing'])next.pages[key]={enabled:f.elements[`${key}-enabled`].checked,title:f.elements[`${key}-title`].value.trim(),body:f.elements[`${key}-body`].value.trim()};
 const button=f.querySelector('[type=submit]');
 try{validateData(next);button.textContent='Đang lưu…';$('#pages-status').textContent='Đang lưu…';await persist(next,'Đã lưu trang mở đầu và kết thúc.');pagesDirty=false;$('#pages-status').textContent='Đã lưu';renderList();}catch(e){$('#pages-status').textContent=e.message;}finally{button.textContent='Lưu trang trình chiếu';}
};
function renderList(){
 const pages=presentationPages(data);
 for(const key of ['opening','closing']){const el=$(`#queue-${key}`);el.hidden=!pages[key].enabled;el.textContent=`${key==='opening'?'Mở đầu':'Kết thúc'} · ${pages[key].title}`;}

 const selected=data.questions.filter(q=>q.enabled),query=$('#search').value.trim().toLocaleLowerCase('vi');
 const category=data.questions.filter(q=>engineOf(q)===activeEngine),entries=category.filter(q=>!query||q.prompt.toLocaleLowerCase('vi').includes(query));
 $('#library-count').textContent=`${data.questions.length} câu hỏi trong 7 dạng trắc nghiệm`;
 $('#bank-total').textContent=data.questions.length;$('#queue-total').textContent=selected.length;
 TYPES.forEach(t=>{const tab=$(`#tab-${t.engine}`);tab.setAttribute('aria-selected',String(t.engine===activeEngine));tab.tabIndex=t.engine===activeEngine?0:-1;tab.querySelector('.tab-count').textContent=data.questions.filter(q=>engineOf(q)===t.engine).length;});
 $('#bank-panel').setAttribute('aria-labelledby',`tab-${activeEngine}`);
 $('#list-heading').textContent=ENGINES[activeEngine];$('#list-description').textContent=`${category.length} câu hỏi · ${category.filter(q=>q.enabled).length} đã chọn để trình chiếu`;
 $('#no-results').hidden=entries.length>0;$('#no-results h3').textContent=query?'Không tìm thấy câu hỏi':'Chưa có câu hỏi ở dạng này';$('#no-results p').textContent=query?'Thử từ khóa khác hoặc xóa nội dung tìm kiếm.':'Bấm Thêm câu hỏi để biên soạn câu đầu tiên.';
 $('#question-list').innerHTML=entries.map((q,i)=>questionRow(q,i+1,false,selected)).join('');
 $('#queue-list').innerHTML=selected.map((q,i)=>questionRow(q,i+1,true,selected)).join('');$('#queue-empty').hidden=selected.length>0;
 const total=selected.reduce((n,q)=>n+q.seconds,0);$('#queue-summary').textContent=`${selected.length} câu đã chọn · Tổng thời gian trả lời: ${Math.floor(total/60)} phút ${total%60} giây`;
}
function clearEditor(){form.reset();form.elements.id.value='';form.elements.seconds.value=30;form.elements.enabled.checked=true;$('#question-type').value=activeEngine;$('#editor-heading').textContent='Thêm câu hỏi';$('#editor-mode').textContent='BIÊN SOẠN';$('#form-error').hidden=true;fields();dirty=false;}
function canDiscard(){return !dirty||confirm('Bạn có nội dung chưa lưu. Bỏ các thay đổi này?');}
function restoreEditorFocus(){const origin=editorOrigin;const target=origin?.id?document.querySelector(`#${activeView==='queue'?'queue-list':'question-list'} [data-id="${CSS.escape(origin.id)}"] [data-action="edit"]`):$('#new-question');(target||$('#new-question')).focus();}
function closeEditor(force=false){if(busy||(!force&&!canDiscard()))return;dirty=false;editorDialog.close();clearEditor();restoreEditorFocus();}
function openNew(){if(busy)return;editorOrigin=null;clearEditor();editorDialog.showModal();form.elements.prompt.focus();}
function edit(q){if(busy||!canDiscard())return;editorOrigin={id:q.id};form.elements.id.value=q.id;form.elements.type.value=q.type;form.elements.prompt.value=q.prompt;form.elements.seconds.value=q.seconds;form.elements.explanation.value=q.explanation;form.elements.enabled.checked=q.enabled;$('#editor-heading').textContent='Sửa câu hỏi';$('#editor-mode').textContent=data.types.find(t=>t.id===q.type).label;$('#form-error').hidden=true;fields(q);dirty=false;if(!editorDialog.open)editorDialog.showModal();form.elements.prompt.focus();}
$('#close-editor').onclick=()=>closeEditor();$('#cancel-edit').onclick=()=>closeEditor();editorDialog.addEventListener('cancel',e=>{e.preventDefault();closeEditor();});
editorDialog.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const controls=[...editorDialog.querySelectorAll('button,input:not([type=hidden]),textarea,select,a[href],[tabindex]')].filter(x=>!x.disabled&&x.tabIndex>=0&&x.getClientRects().length);const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}});

async function persist(next,message){if(busy)throw new Error('Đang lưu, vui lòng chờ.');busy=true;const saveButton=form.querySelector('[type=submit]');const saveText=saveButton.textContent;if(editorDialog.open){saveButton.textContent='Đang lưu…';form.setAttribute('aria-busy','true');}const controls=[...document.querySelectorAll('#admin-content button,#admin-content input,#admin-content select,#admin-content textarea,#editor-dialog button,#editor-dialog input,#editor-dialog select,#editor-dialog textarea')];const prior=controls.map(x=>x.disabled);controls.forEach(x=>x.disabled=true);status('Đang lưu vào cơ sở dữ liệu…');try{revision=await saveAdmin(next,revision);data=next;status(message);return true;}catch(e){status(e.message,true);throw e;}finally{busy=false;saveButton.textContent=saveText;form.removeAttribute('aria-busy');controls.forEach((x,i)=>x.disabled=prior[i]);}}
const lines=selector=>$(selector).value.split('\n').map(x=>x.trim()).filter(Boolean);
form.addEventListener('input',()=>{dirty=true;});
$('#question-type').onchange=()=>{fields();dirty=true;};
form.onsubmit=async e=>{e.preventDefault();$('#form-error').hidden=true;const q={id:selectedID()||uid(),type:form.elements.type.value,prompt:form.elements.prompt.value.trim(),seconds:Number(form.elements.seconds.value),enabled:form.elements.enabled.checked,explanation:form.elements.explanation.value.trim()};const engine=currentEngine();
 if(['single','multiple'].includes(engine)){q.options=[...document.querySelectorAll('.choice-text')].map(x=>x.value.trim());q.correct=[...document.querySelectorAll('[name="correct-choice"]')].flatMap((x,i)=>x.checked?[i]:[]);}
 if(engine==='boolean')q.answer=$('[name="boolean-answer"]:checked').value==='true';
 if(engine==='fill'){q.template=$('#fill-template').value.trim();q.answers=lines('#fill-answers');}
 if(engine==='match'){const left=lines('#match-left'),right=lines('#match-right');if(left.length!==right.length)return error('Hai cột phải có cùng số dòng.');q.pairs=left.map((l,i)=>({left:l,right:right[i]}));}
 if(engine==='order')q.items=lines('#order-items');
 if(engine==='short')q.answer=$('#short-answer').value.trim();
 try{validateQuestion(q,data.types);const next=clone(data),i=next.questions.findIndex(x=>x.id===q.id);if(i<0)next.questions.push(q);else next.questions[i]=q;await persist(next,'Đã lưu câu hỏi và cập nhật bộ trình chiếu.');dirty=false;activeEngine=engine;$('#search').value='';renderList();closeEditor(true);}catch(e){error(e.message);}
};
$('#search').oninput=renderList;$('#new-question').onclick=openNew;
async function move(id,target){
 const next=clone(data),selected=next.questions.filter(q=>q.enabled),i=selected.findIndex(q=>q.id===id);
 if(i<0||target<0||target>=selected.length||target===i){renderList();return;}
 selected.splice(target,0,selected.splice(i,1)[0]);let n=0;next.questions=next.questions.map(q=>q.enabled?selected[n++]:q);
 try{await persist(next,'Đã cập nhật thứ tự trình chiếu.');}catch{}renderList();
 const input=document.querySelector(`#queue-list [data-id="${CSS.escape(id)}"] .position`);input?.focus();
}
function listClick(e){const row=e.target.closest('[data-id]'),button=e.target.closest('[data-action]');if(!row||!button||busy)return;const id=row.dataset.id,q=data.questions.find(q=>q.id===id),selected=data.questions.filter(q=>q.enabled),i=selected.findIndex(q=>q.id===id);if(button.dataset.action==='edit')edit(q);if(button.dataset.action==='up')move(id,i-1);if(button.dataset.action==='down')move(id,i+1);if(button.dataset.action==='delete'){deleteId=id;$('#delete-summary').textContent=q.prompt;$('#delete-dialog').showModal();}}
async function listChange(e){
 const row=e.target.closest('[data-id]');if(!row||busy)return;const id=row.dataset.id,list=e.currentTarget.id;
 if(e.target.matches('.toggle-enabled')){const next=clone(data);next.questions.find(q=>q.id===id).enabled=e.target.checked;try{await persist(next,'Đã cập nhật danh sách câu hỏi trình chiếu.');}catch{}renderList();const target=document.querySelector(`#${list} [data-id="${CSS.escape(id)}"] .toggle-enabled`);(target||$('#queue-view')).focus();}
 if(e.target.matches('.position')){const n=Number(e.target.value),count=data.questions.filter(q=>q.enabled).length;if(!Number.isInteger(n)||n<1||n>count){status(`Vị trí phải từ 1 đến ${count}.`,true);renderList();return;}move(id,n-1);}
}
for(const id of ['question-list','queue-list']){$(`#${id}`).onclick=listClick;$(`#${id}`).onchange=listChange;}
$('#confirm-delete').onclick=async()=>{const next=clone(data);next.questions=next.questions.filter(q=>q.id!==deleteId);try{await persist(next,'Đã xóa câu hỏi.');if(selectedID()===deleteId)clearEditor();renderList();$('#delete-dialog').close();}catch(e){$('#delete-dialog').close();error(e.message);}};
$('#cancel-delete').onclick=()=>$('#delete-dialog').close();
$('#settings-form').onsubmit=async e=>{e.preventDefault();const next=clone(data);next.title=e.target.elements.title.value.trim();try{await persist(next,'Đã lưu tên buổi thi.');}catch{}};
$('#export').onclick=()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`giaoly-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Đã xuất bộ câu hỏi đang lưu. Nội dung chưa bấm Lưu câu hỏi không nằm trong file.');};
$('#import').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>4000000)throw new Error('File không được lớn hơn 4 MB.');imported=validateData(JSON.parse(await file.text()));$('#import-summary').textContent=`“${imported.title}” · ${imported.questions.length} câu hỏi · ${imported.types.length} dạng.`;$('#import-dialog').showModal();}catch(err){status(`Không nhập được: ${err.message}`,true);}};
$('#confirm-import').onclick=async()=>{try{await persist(clone(imported),'Đã nhập và đồng bộ bộ câu hỏi.');$('#settings-form').elements.title.value=data.title;fillPages();fillTypes();clearEditor();renderList();$('#import-dialog').close();}catch(e){$('#import-dialog').close();error(e.message);}};$('#cancel-import').onclick=()=>$('#import-dialog').close();
async function start(){try{const result=await loadAdmin();data=result.data;revision=result.revision;$('#admin-content').hidden=false;$('#login-panel').hidden=true;$('#settings-form').elements.title.value=data.title;$('#account-label').textContent=demo?'Chế độ thử trên máy':getSession()?.user?.email||'Quản trị viên';$('#logout').hidden=demo;fillPages();fillTypes();initTabs();clearEditor();renderList();status(demo?'Đang thử nghiệm. Dữ liệu này không được công bố lên website.':'Đã tải dữ liệu mới nhất.');}catch(e){$('#login-panel').hidden=false;$('#admin-content').hidden=true;status(e.message,true);}}
$('#login-form').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;b.textContent='Đang đăng nhập…';$('#login-error').hidden=true;try{await login(e.target.elements.email.value.trim(),e.target.elements.password.value);e.target.elements.password.value='';await start();}catch(err){$('#login-error').hidden=false;$('#login-error').textContent=err.message;}finally{b.disabled=false;b.textContent='Đăng nhập';}};
$('#logout').onclick=async()=>{if(busy)return status('Đang lưu, vui lòng chờ.');if(!canDiscard()||(pagesDirty&&!confirm('Trang trình chiếu có nội dung chưa lưu. Đăng xuất?')))return;try{await logout();}catch{}dirty=false;pagesDirty=false;data=null;$('#admin-content').hidden=true;$('#login-panel').hidden=false;$('#account-label').textContent='';status('Đã đăng xuất.');};
window.addEventListener('beforeunload',e=>{if(dirty||pagesDirty||busy){e.preventDefault();e.returnValue='';}});
$('#register').onclick=async()=>{const f=$('#login-form');if(!f.reportValidity())return;const buttons=[...f.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);$('#login-error').hidden=true;try{const signedIn=await signup(f.elements.email.value.trim(),f.elements.password.value);f.elements.password.value='';if(signedIn)await start();else status('Kiểm tra hộp thư để xác nhận tài khoản, sau đó đăng nhập.');}catch(e){$('#login-error').hidden=false;$('#login-error').textContent=e.message;}finally{buttons.forEach(b=>b.disabled=false);}};
$('#forgot-password').onclick=async()=>{const email=$('#login-form').elements.email;if(!email.reportValidity())return;$('#forgot-password').disabled=true;try{await recover(email.value.trim());status('Nếu email hợp lệ, bạn sẽ nhận được liên kết đặt lại mật khẩu.');}catch(e){status(e.message,true);}finally{$('#forgot-password').disabled=false;}};
$('#password-form').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;try{await updatePassword(e.target.elements.password.value);e.target.reset();$('#password-dialog').close();await start();status('Đã đổi mật khẩu.');}catch(err){$('#password-error').hidden=false;$('#password-error').textContent=err.message;}finally{b.disabled=false;}};
let needsPassword=false;try{if(configured)needsPassword=await acceptCallback();}catch(e){status(e.message,true);}
if(needsPassword)$('#password-dialog').showModal();
if(demo){document.querySelectorAll('a[href="./"]').forEach(a=>a.href='./?demo=1');start();}else if(!configured){status('Chưa kết nối cơ sở dữ liệu.');}else if(getSession())start();else $('#login-panel').hidden=false;
