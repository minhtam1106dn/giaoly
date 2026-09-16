import {escapeHTML as h,presentationPages} from './data.js?v=20260916-pages';
import {loadPublic,demo} from './api.js?v=20260916-pages';
const $ = s=>document.querySelector(s);
let data,slides=[],questions=[],index=0,revealed=false,remaining=0,deadline=0,running=false,interval;
// Fit only the display card; navigation keeps its normal touch-target size.
let fitFrame;
function scheduleFit(){cancelAnimationFrame(fitFrame);fitFrame=requestAnimationFrame(fitSlide);}
function fitSlide(){
 const cards=[$('#question-card'),$('#event-page')];
 for(const card of cards){card.style.removeProperty('zoom');card.style.removeProperty('width');}
 if(!document.fullscreenElement||$('#presentation').hidden)return;
 const stage=$('#slide-stage'),card=cards.find(c=>!c.hidden);
 if(!card||stage.clientHeight<=0)return;
 const available=stage.clientHeight-2;
 const size=scale=>{card.style.zoom=String(scale);card.style.width='100%';return card.getBoundingClientRect().height;};
 let low=.02,high=1.4;
 // Choose the largest size that fits after text has reflowed at that size.
 for(let n=0;n<12;n++){const mid=(low+high)/2;if(size(mid)<=available)low=mid;else high=mid;}
 size(low);
}
new ResizeObserver(scheduleFit).observe($('#slide-stage'));
new MutationObserver(scheduleFit).observe($('#timer-status'),{childList:true,characterData:true,subtree:true});
window.addEventListener('resize',scheduleFit);
document.fonts.ready.then(scheduleFit);
const instructions={single:'Chọn một đáp án đúng.',boolean:'Nhận định dưới đây đúng hay sai?',fill:'Điền từ thích hợp vào từng chỗ trống.',multiple:'Có nhiều đáp án đúng. Hãy chọn tất cả đáp án phù hợp.',match:'Ghép số ở cột A với chữ cái tương ứng ở cột B.',order:'Sắp xếp các mục theo đúng thứ tự.',short:'Đưa ra câu trả lời ngắn gọn.'};
const letter=i=>String.fromCharCode(65+i);
const PAIR_COLORS=['#1d4ed8','#b45309','#047857','#be185d','#6d28d9','#0e7490','#c2410c','#4d7c0f','#a21caf','#334155','#9f1239','#4338ca'];
// Stable non-identity ordering keeps the board unchanged when revealing an answer.
function permutation(length,id){let seed=[...id].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,7);const a=Array.from({length},(_,i)=>i);for(let i=length-1;i>0;i--){seed=(seed*1664525+1013904223)>>>0;const j=seed%(i+1);[a[i],a[j]]=[a[j],a[i]];}if(a.every((x,i)=>x===i))a.push(a.shift());return a;}
function option(label,text,correct=false,mark='✓ Đúng',pairIndex=null){const matched=correct&&pairIndex!==null;return `<div class="option${matched?' matched':correct?' correct':''}"${matched?` style="--pair-color:${PAIR_COLORS[pairIndex]}"`:''}><span class="option-letter">${h(label)}</span><span class="option-text">${h(text)}</span>${correct?`<span class="answer-mark">${h(mark)}</span>`:''}</div>`;}
function renderContent(){
 const q=slides[index].question,engine=data.types.find(t=>t.id===q.type).engine;let html='';
 if(engine==='single'||engine==='multiple')html=`<div class="options-grid">${q.options.map((text,i)=>option(letter(i),text,revealed&&q.correct.includes(i))).join('')}</div>`;
 if(engine==='boolean')html=`<div class="options-grid">${[true,false].map((v,i)=>option(letter(i),v?'Đúng':'Sai',revealed&&q.answer===v)).join('')}</div>`;
 if(engine==='fill'){const parts=q.template.split('{{…}}');html=`<div class="fill-sentence">${parts.map((p,i)=>h(p)+(i<parts.length-1?`<span class="blank${revealed?' solved':''}">${revealed?h(q.answers[i]):`(${i+1}) …`}</span>`:'')).join('')}</div>`;}
 if(engine==='match'){
  const shuffled=permutation(q.pairs.length,q.id);
  html=`<div class="match-grid"><div class="match-column"><h3>CỘT A</h3>${q.pairs.map((p,i)=>option(i+1,p.left,revealed,`↔ ${letter(shuffled.indexOf(i))}`,i)).join('')}</div><div class="match-column"><h3>CỘT B</h3>${shuffled.map((original,i)=>option(letter(i),q.pairs[original].right,revealed,`↔ ${original+1}`,original)).join('')}</div></div>`;
 }
 if(engine==='order'){const order=permutation(q.items.length,q.id);html=`<div class="sequence">${order.map((original,i)=>`<div class="option"><span class="option-letter">${letter(i)}</span><span class="option-text">${h(q.items[original])}</span><span class="order-rank${revealed?'':' unrevealed'}" ${revealed?`aria-label="Thứ tự đúng: ${original+1}"`:'aria-hidden="true"'}>${revealed?original+1:'&nbsp;'}</span></div>`).join('')}</div>`;}
 if(engine==='short')html=revealed?`<div class="short-answer"><span class="eyebrow">ĐÁP ÁN</span><div>${h(q.answer)}</div></div>`:'<div class="short-placeholder">Cùng suy nghĩ và đưa ra câu trả lời nào!</div>';
 $('#question-content').innerHTML=html;
 $('#answer-explanation').hidden=!revealed||!q.explanation;
 $('#answer-explanation').innerHTML=`<strong>Giải thích đáp án</strong>${h(q.explanation)}`;
 $('#reveal').textContent=revealed?'Ẩn đáp án':'Hiện đáp án';$('#reveal').setAttribute('aria-pressed',String(revealed));scheduleFit();
}
function clockPaint(){
 const seconds=Math.ceil(remaining/1000);$('#timer').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
 $('#time-fill').style.width=`${remaining/(slides[index].question.seconds*1000)*100}%`;
 $('#timer').classList.toggle('expired',seconds===0);$('#time-fill').classList.toggle('expired',seconds===0);
 $('#timer-toggle').textContent=running?'Tạm dừng':remaining===0?'Đếm lại':'Bắt đầu đếm';
}
function stop(){if(running)remaining=Math.max(0,deadline-Date.now());running=false;clearInterval(interval);}
function tick(){remaining=Math.max(0,deadline-Date.now());if(remaining===0){stop();$('#timer-status').textContent='Hết giờ! Bấm “Hiện đáp án” khi sẵn sàng công bố.';}clockPaint();}
function reset(){if(!slides[index]?.question)return;stop();remaining=slides[index].question.seconds*1000;clockPaint();$('#timer-status').textContent='';}
function toggleTimer(){if(!slides[index]?.question)return;if(running){stop();$('#timer-status').textContent='Đã tạm dừng đếm thời gian.';}else{if(remaining<=0)remaining=slides[index].question.seconds*1000;deadline=Date.now()+remaining;running=true;interval=setInterval(tick,100);$('#timer-status').textContent='Đang đếm thời gian…';}clockPaint();}
function show(i){
 if(!slides[i])return;stop();index=i;revealed=false;
 const slide=slides[index],q=slide.question;
 $('#jump').value=String(index);$('#prev').disabled=index===0;$('#next').disabled=index===slides.length-1;
 $('#prev').textContent='← Trang trước';$('#next').textContent=slide.kind==='opening'&&questions.length?'Bắt đầu câu hỏi →':'Trang tiếp →';
 $('#question-card').hidden=!q;$('#question-controls').hidden=!q;$('#event-page').hidden=!!q;$('#timer-status').textContent='';
 scheduleFit();
 if(!q){$('#event-title').textContent=slide.title;$('#event-body').textContent=slide.body;$('#event-body').hidden=!slide.body;$('#question-count').textContent=slide.kind==='opening'?'Trang mở đầu':'Trang kết thúc';return;}
 $('#question-title').textContent=q.prompt;$('#question-number').textContent=`CÂU ${String(slide.number).padStart(2,'0')}`;$('#question-count').textContent=`${slide.number} / ${questions.length} câu hỏi`;$('#question-instruction').textContent=instructions[data.types.find(t=>t.id===q.type).engine];renderContent();reset();
}
function reveal(){if(!slides[index]?.question)return;revealed=!revealed;if(revealed){stop();clockPaint();$('#timer-status').textContent='';}renderContent();}
$('#prev').onclick=()=>{if(index>0)show(index-1);};$('#next').onclick=()=>{if(index<slides.length-1)show(index+1);};$('#jump').onchange=e=>show(Number(e.target.value));$('#reveal').onclick=reveal;$('#timer-toggle').onclick=toggleTimer;$('#timer-reset').onclick=reset;
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('#timer-status').textContent='Trình duyệt này không hỗ trợ toàn màn hình. Bạn có thể dùng chức năng phóng to của trình duyệt.';}};
document.addEventListener('fullscreenchange',()=>{$('#fullscreen').textContent=document.fullscreenElement?'Thoát toàn màn hình':'Toàn màn hình';scheduleFit();});
document.addEventListener('keydown',e=>{if(!slides.length||e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,textarea,select,button,a,[contenteditable]'))return;if(e.code==='ArrowLeft'){e.preventDefault();$('#prev').click();}if(e.code==='ArrowRight'){e.preventDefault();$('#next').click();}if(e.code==='Space'){e.preventDefault();toggleTimer();}if(e.key.toLowerCase()==='a')reveal();if(e.key.toLowerCase()==='r')reset();});
document.addEventListener('visibilitychange',()=>{if(running)tick();});
async function load(){try{
 data=await loadPublic();questions=data.questions.filter(q=>q.enabled);const pages=presentationPages(data);
 slides=[...(pages.opening.enabled?[{kind:'opening',...pages.opening}]:[]),...questions.map((question,i)=>({kind:'question',question,number:i+1})),...(pages.closing.enabled?[{kind:'closing',...pages.closing}]:[])];
 $('#session-title').textContent=data.title;$('#empty').hidden=slides.length>0;$('#presentation').hidden=!slides.length;
 $('#jump').innerHTML=slides.map((slide,i)=>`<option value="${i}">${slide.kind==='opening'?'Mở đầu':slide.kind==='closing'?'Kết thúc':`Câu ${slide.number}`}</option>`).join('');if(slides.length)show(0);
 }catch(e){$('#load-error').hidden=false;$('#load-error').className='notice';$('#load-error').textContent=e.message;}}

if(demo)document.querySelectorAll('a[href="admin.html"]').forEach(a=>a.href='admin.html?demo=1');
load();
