import {escapeHTML as h} from './data.js';
import {loadPublic,configured,demo} from './api.js';
const $ = s=>document.querySelector(s);
let data,questions=[],index=0,revealed=false,remaining=0,deadline=0,running=false,interval;
const instructions={single:'Chọn một đáp án đúng.',boolean:'Nhận định dưới đây đúng hay sai?',fill:'Điền từ thích hợp vào từng chỗ trống.',multiple:'Có nhiều đáp án đúng. Hãy chọn tất cả đáp án phù hợp.',match:'Ghép số ở cột A với chữ cái tương ứng ở cột B.',order:'Sắp xếp các mục theo đúng thứ tự.',short:'Đưa ra câu trả lời ngắn gọn.'};
const letter=i=>String.fromCharCode(65+i);
// Stable non-identity ordering keeps the board unchanged when revealing an answer.
function permutation(length,id){let seed=[...id].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,7);const a=Array.from({length},(_,i)=>i);for(let i=length-1;i>0;i--){seed=(seed*1664525+1013904223)>>>0;const j=seed%(i+1);[a[i],a[j]]=[a[j],a[i]];}if(a.every((x,i)=>x===i))a.push(a.shift());return a;}
function option(label,text,correct=false,mark='✓ Đúng'){return `<div class="option${correct?' correct':''}"><span class="option-letter">${h(label)}</span><span class="option-text">${h(text)}</span>${correct?`<span class="answer-mark">${h(mark)}</span>`:''}</div>`;}
function renderContent(){
 const q=questions[index],engine=data.types.find(t=>t.id===q.type).engine;let html='';
 if(engine==='single'||engine==='multiple')html=`<div class="options-grid">${q.options.map((text,i)=>option(letter(i),text,revealed&&q.correct.includes(i))).join('')}</div>`;
 if(engine==='boolean')html=`<div class="options-grid">${[true,false].map((v,i)=>option(letter(i),v?'Đúng':'Sai',revealed&&q.answer===v)).join('')}</div>`;
 if(engine==='fill'){const parts=q.template.split('{{…}}');html=`<div class="fill-sentence">${parts.map((p,i)=>h(p)+(i<parts.length-1?`<span class="blank${revealed?' solved':''}">${revealed?h(q.answers[i]):`(${i+1}) …`}</span>`:'')).join('')}</div>`;}
 if(engine==='match'){
  const shuffled=permutation(q.pairs.length,q.id);
  html=`<div class="match-grid"><div class="match-column"><h3>CỘT A</h3>${q.pairs.map((p,i)=>option(i+1,p.left,revealed,`↔ ${letter(shuffled.indexOf(i))}`)).join('')}</div><div class="match-column"><h3>CỘT B</h3>${shuffled.map((original,i)=>option(letter(i),q.pairs[original].right,revealed,`↔ ${original+1}`)).join('')}</div></div>`;
 }
 if(engine==='order'){const order=revealed?q.items.map((_,i)=>i):permutation(q.items.length,q.id);html=`<div class="sequence">${order.map((original,i)=>option(revealed?i+1:letter(i),q.items[original],revealed,`✓ Bước ${i+1}`)).join('')}</div>`;}
 if(engine==='short')html=revealed?`<div class="short-answer"><span class="eyebrow">ĐÁP ÁN</span><div>${h(q.answer)}</div></div>`:'<div class="short-placeholder">Cùng suy nghĩ và đưa ra câu trả lời của bạn.</div>';
 $('#question-content').innerHTML=html;
 $('#answer-explanation').hidden=!revealed||!q.explanation;
 $('#answer-explanation').innerHTML=`<strong>Giải thích đáp án</strong>${h(q.explanation)}`;
 $('#reveal').textContent=revealed?'Ẩn đáp án':'Hiện đáp án';$('#reveal').setAttribute('aria-pressed',String(revealed));
}
function clockPaint(){
 const seconds=Math.ceil(remaining/1000);$('#timer').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
 $('#time-fill').style.width=`${remaining/(questions[index].seconds*1000)*100}%`;
 $('#timer').classList.toggle('expired',seconds===0);$('#time-fill').classList.toggle('expired',seconds===0);
 $('#timer-toggle').textContent=running?'Tạm dừng':remaining===0?'Đếm lại':'Bắt đầu đếm';
}
function stop(){if(running)remaining=Math.max(0,deadline-Date.now());running=false;clearInterval(interval);}
function tick(){remaining=Math.max(0,deadline-Date.now());if(remaining===0){stop();$('#timer-status').textContent='Hết giờ! Bấm “Hiện đáp án” khi sẵn sàng công bố.';}clockPaint();}
function reset(){stop();remaining=questions[index].seconds*1000;clockPaint();$('#timer-status').textContent='Sẵn sàng. Bấm “Bắt đầu đếm” khi bắt đầu câu hỏi.';}
function toggleTimer(){if(running){stop();$('#timer-status').textContent='Đã tạm dừng đếm thời gian.';}else{if(remaining<=0)remaining=questions[index].seconds*1000;deadline=Date.now()+remaining;running=true;interval=setInterval(tick,100);$('#timer-status').textContent='Đang đếm thời gian…';}clockPaint();}
function show(i){stop();index=i;revealed=false;const q=questions[index];$('#question-title').textContent=q.prompt;$('#question-number').textContent=`CÂU ${String(index+1).padStart(2,'0')}`;$('#question-count').textContent=`${index+1} / ${questions.length} câu hỏi`;$('#type-label').textContent=data.types.find(t=>t.id===q.type).label;$('#question-instruction').textContent=instructions[data.types.find(t=>t.id===q.type).engine];$('#jump').value=String(index);$('#prev').disabled=index===0;$('#next').disabled=index===questions.length-1;renderContent();reset();}
function reveal(){revealed=!revealed;if(revealed){stop();clockPaint();$('#timer-status').textContent='Đã hiện đáp án. Đồng hồ đã dừng.';}renderContent();}
$('#prev').onclick=()=>{if(index>0)show(index-1);};$('#next').onclick=()=>{if(index<questions.length-1)show(index+1);};$('#jump').onchange=e=>show(Number(e.target.value));$('#reveal').onclick=reveal;$('#timer-toggle').onclick=toggleTimer;$('#timer-reset').onclick=reset;
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('#timer-status').textContent='Trình duyệt này không hỗ trợ toàn màn hình. Bạn có thể dùng chức năng phóng to của trình duyệt.';}};
document.addEventListener('fullscreenchange',()=>{$('#fullscreen').textContent=document.fullscreenElement?'Thoát toàn màn hình':'Toàn màn hình';});
document.addEventListener('keydown',e=>{if(!questions.length||e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,textarea,select,button,a,[contenteditable]'))return;if(e.code==='ArrowLeft'){e.preventDefault();$('#prev').click();}if(e.code==='ArrowRight'){e.preventDefault();$('#next').click();}if(e.code==='Space'){e.preventDefault();toggleTimer();}if(e.key.toLowerCase()==='a')reveal();if(e.key.toLowerCase()==='r')reset();});
document.addEventListener('visibilitychange',()=>{if(running)tick();});
async function load(){try{data=await loadPublic();questions=data.questions.filter(q=>q.enabled);$('#session-title').textContent=data.title;$('#data-origin').textContent=demo?'Chế độ thử · dữ liệu trên máy':configured?'Bộ câu hỏi đã công bố':'Bộ câu hỏi minh họa · chưa kết nối dữ liệu';$('#session-description').textContent=(!configured||demo)?'Bộ câu hỏi minh họa 7 dạng. Nội dung có thể chỉnh sửa trong quản trị.':'Mỗi câu hỏi, một bước trưởng thành trong đức tin.';$('#empty').hidden=questions.length>0;$('#presentation').hidden=!questions.length;$('#jump').innerHTML=questions.map((_,i)=>`<option value="${i}">${i+1}</option>`).join('');if(questions.length)show(0);}catch(e){$('#load-error').hidden=false;$('#load-error').className='notice';$('#load-error').textContent=e.message;}}
if(demo)document.querySelectorAll('a[href="admin.html"]').forEach(a=>a.href='admin.html?demo=1');
load();
