export const ENGINES = Object.freeze({
  single: 'ABCD', boolean: 'Đúng / Sai', fill: 'Điền từ', multiple: 'Nhiều đáp án', match: 'Nối hai cột', order: 'Sắp xếp thứ tự', short: 'Trả lời ngắn',
});
export const TYPES = Object.entries(ENGINES).map(([id, label]) => ({ id, label, engine: id }));
export const SEED = {
  version: 1, title: 'Cùng khám phá giáo lý', types: TYPES,
  questions: [
    { id: 'demo-single', type: 'single', seconds: 30, enabled: true, prompt: 'Trong một năm, lễ nào mừng Chúa Giêsu sống lại?', options: ['Lễ Giáng Sinh', 'Lễ Phục Sinh', 'Lễ Hiển Linh', 'Lễ Các Thánh'], correct: [1], explanation: 'Lễ Phục Sinh mừng Chúa Giêsu sống lại. Đây là câu hỏi minh họa; hãy biên soạn nội dung phù hợp với buổi thi của bạn.' },
    { id: 'demo-boolean', type: 'boolean', seconds: 20, enabled: true, prompt: 'Kinh Lạy Cha là lời kinh Chúa Giêsu dạy các môn đệ.', answer: true, explanation: 'Đáp án: Đúng.' },
    { id: 'demo-fill', type: 'fill', seconds: 30, enabled: true, prompt: 'Hoàn thành lời kinh sau.', template: 'Lạy Cha chúng con ở trên {{…}}, chúng con nguyện danh Cha cả {{…}}.', answers: ['trời', 'sáng'], explanation: 'Hai từ cần điền lần lượt là “trời” và “sáng”.' },
    { id: 'demo-multiple', type: 'multiple', seconds: 45, enabled: true, prompt: 'Chọn những tên thuộc bốn sách Tin Mừng.', options: ['Mátthêu', 'Máccô', 'Luca', 'Gioan', 'Sáng Thế'], correct: [0, 1, 2, 3], explanation: 'Bốn sách Tin Mừng mang tên Mátthêu, Máccô, Luca và Gioan.' },
    { id: 'demo-match', type: 'match', seconds: 45, enabled: true, prompt: 'Nối mỗi ngày lễ với ý nghĩa tương ứng.', pairs: [{left:'Lễ Giáng Sinh',right:'Chúa Giêsu giáng sinh'},{left:'Lễ Phục Sinh',right:'Chúa Giêsu sống lại'},{left:'Lễ Hiện Xuống',right:'Chúa Thánh Thần hiện xuống'}], explanation: 'Mỗi số ở cột trái được ghép với một chữ cái ở cột phải.' },
    { id: 'demo-order', type: 'order', seconds: 45, enabled: true, prompt: 'Sắp xếp các biến cố sau theo thứ tự thời gian.', items: ['Chúa Giêsu giáng sinh', 'Chúa Giêsu chịu phép rửa', 'Chúa Giêsu chịu chết', 'Chúa Giêsu sống lại'], explanation: 'Thứ tự được hiển thị từ biến cố diễn ra trước đến biến cố diễn ra sau.' },
    { id: 'demo-short', type: 'short', seconds: 30, enabled: true, prompt: 'Mẹ của Chúa Giêsu có tên là gì?', answer: 'Maria', explanation: 'Đức Maria là Mẹ của Chúa Giêsu.' },
  ],
};
export const clone = data => structuredClone(data);
export const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const uid = () => crypto.randomUUID();
const text = (v, max = 4000) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const list = (v, min = 1, max = 20) => Array.isArray(v) && v.length >= min && v.length <= max && v.every(x => text(x));
function requireThat(ok, message) { if (!ok) throw new Error(message); }
export function validateQuestion(q, types) {
  requireThat(q && text(q.id, 100), 'Mã câu hỏi không hợp lệ.');
  const type = types.find(t => t.id === q.type);
  requireThat(type, 'Dạng câu hỏi không tồn tại.');
  requireThat(text(q.prompt), 'Nhập nội dung câu hỏi (tối đa 4.000 ký tự).');
  requireThat(Number.isInteger(q.seconds) && q.seconds >= 1 && q.seconds <= 3600, 'Thời gian phải là số nguyên từ 1 đến 3.600 giây.');
  requireThat(typeof q.enabled === 'boolean', 'Trạng thái hiển thị không hợp lệ.');
  requireThat(typeof q.explanation === 'string' && q.explanation.length <= 4000, 'Giải thích không được dài quá 4.000 ký tự.');
  if (['single', 'multiple'].includes(type.engine)) {
    requireThat(list(q.options, type.engine === 'single' ? 4 : 2, type.engine === 'single' ? 4 : 12), type.engine === 'single' ? 'Nhập đầy đủ 4 lựa chọn A, B, C, D.' : 'Nhập từ 2 đến 12 lựa chọn.');
    requireThat(new Set(q.options.map(x=>x.trim())).size === q.options.length, 'Các lựa chọn không được trùng nhau.');
    requireThat(Array.isArray(q.correct) && q.correct.length >= 1 && q.correct.every(i => Number.isInteger(i) && i >= 0 && i < q.options.length) && new Set(q.correct).size === q.correct.length, 'Chọn ít nhất một đáp án đúng hợp lệ.');
    requireThat(type.engine !== 'single' || q.correct.length === 1, 'Dạng ABCD cần đúng một đáp án.');
  } else if (type.engine === 'boolean') requireThat(typeof q.answer === 'boolean', 'Chọn Đúng hoặc Sai.');
  else if (type.engine === 'fill') {
    requireThat(text(q.template), 'Nhập đoạn văn cần điền từ.');
    const count = (q.template.match(/\{\{…\}\}/g) || []).length;
    requireThat(list(q.answers) && count === q.answers.length, 'Số chỗ trống {{…}} phải bằng số dòng đáp án (1–20).');
  } else if (type.engine === 'match') {
    requireThat(Array.isArray(q.pairs) && q.pairs.length >= 2 && q.pairs.length <= 12 && q.pairs.every(p => p && text(p.left) && text(p.right)), 'Nhập từ 2 đến 12 cặp nối, đủ cả hai cột.');
    requireThat(new Set(q.pairs.map(p=>p.left.trim())).size === q.pairs.length && new Set(q.pairs.map(p=>p.right.trim())).size === q.pairs.length, 'Nội dung trong mỗi cột không được trùng nhau.');
  } else if (type.engine === 'order') {
    requireThat(list(q.items, 2, 12), 'Nhập từ 2 đến 12 mục theo thứ tự đúng.');
    requireThat(new Set(q.items.map(x=>x.trim())).size === q.items.length, 'Các mục sắp xếp không được trùng nhau.');
  } else if (type.engine === 'short') requireThat(text(q.answer), 'Nhập đáp án cho câu trả lời ngắn.');
  return q;
}
export function validateData(data) {
  requireThat(data && data.version === 1, 'Định dạng dữ liệu không hỗ trợ (cần version: 1).');
  requireThat(text(data.title, 160), 'Tên buổi thi phải có từ 1 đến 160 ký tự.');
  requireThat(Array.isArray(data.types) && data.types.length >= 7 && data.types.length <= 100, 'Danh sách dạng câu hỏi không hợp lệ.');
  requireThat(data.types.every(t => t && text(t.id,100) && text(t.label,80) && Object.hasOwn(ENGINES,t.engine)), 'Dạng câu hỏi phải dùng một trong 7 kiểu hiển thị.');
  requireThat(new Set(data.types.map(t=>t.id)).size === data.types.length, 'Mã dạng câu hỏi bị trùng.');
  requireThat(TYPES.every(t=>data.types.some(v=>v.id===t.id && v.engine===t.engine)), 'Không được thay đổi hoặc xóa 7 dạng gốc.');
  requireThat(Array.isArray(data.questions) && data.questions.length <= 2000, 'Bộ dữ liệu hỗ trợ tối đa 2.000 câu hỏi.');
  requireThat(new Set(data.questions.map(q=>q?.id)).size === data.questions.length, 'Mã câu hỏi bị trùng.');
  data.questions.forEach((q,i)=>{try {validateQuestion(q,data.types);} catch(e){throw new Error(`Câu ${i+1}: ${e.message}`);}});
  requireThat(JSON.stringify(data).length < 4000000, 'Bộ dữ liệu không được vượt quá 4 MB.');
  return data;
}
