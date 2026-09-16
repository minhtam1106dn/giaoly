import {CONFIG} from './config.js';
import {SEED, clone, validateData} from './data.js';
export const configured = Boolean(CONFIG.supabaseUrl && CONFIG.supabasePublishableKey);
export const demo = new URLSearchParams(location.search).get('demo') === '1';
const SESSION_KEY = 'giaoly.auth.v1';
const DEMO_KEY = 'giaoly.demo.v1';
let refreshPending;
let session;
try { session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch { session = null; }
export const getSession = () => session;
function storeSession(value) { session = value; if(value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value)); else sessionStorage.removeItem(SESSION_KEY); }
async function raw(path, {method='GET',body,token,headers={}}={}) {
  let response;
  try { response = await fetch(`${CONFIG.supabaseUrl.replace(/\/$/,'')}${path}`, {method, headers:{apikey:CONFIG.supabasePublishableKey,...(token?{Authorization:`Bearer ${token}`} : {}), ...(body ? {'Content-Type':'application/json'} : {}),...headers},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(15000)}); }
  catch {throw new Error('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại; nội dung bạn đang nhập vẫn được giữ.');}
  if(!response.ok) {
    const error = await response.json().catch(()=>({}));
    if(error.code==='PT409' || response.status===409) throw new Error('Dữ liệu đã được sửa trên máy khác. Xuất bản đang mở để giữ nội dung, rồi tải lại trang trước khi tiếp tục.');
    if(response.status===401 || response.status===403 || error.code==='42501') throw new Error('Phiên đăng nhập hết hạn hoặc tài khoản chưa được cấp quyền admin. Hãy đăng nhập lại.');
    if(path.includes('/token')) throw new Error('Không đăng nhập được. Kiểm tra email, mật khẩu và trạng thái xác nhận tài khoản.');
    throw new Error(`Không thể thực hiện yêu cầu (${response.status}). Vui lòng thử lại hoặc kiểm tra cấu hình cơ sở dữ liệu.`);
  }
  return response.status===204 ? null : response.json();
}
async function token() {
  if(!session) throw new Error('Bạn cần đăng nhập admin.');
  if(session.expires_at*1000 < Date.now()+60000) {
    if(!refreshPending) refreshPending=raw('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token}}).then(storeSession).catch(e=>{storeSession(null);throw e;}).finally(()=>{refreshPending=null;});
    await refreshPending;
  }
  return session.access_token;
}
export async function login(email,password) {
  if(!configured) throw new Error('Chưa kết nối cơ sở dữ liệu.');
  const value=await raw('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
  storeSession(value);
  try {await loadAdmin();} catch(e) {storeSession(null);throw e;}
}
export async function logout() {
  try { if(session) await raw('/auth/v1/logout?scope=local',{method:'POST',token:session.access_token}); }
  finally { storeSession(null); }
}
export async function loadAdmin() {
  if(demo) {const stored = localStorage.getItem(DEMO_KEY);return {data:validateData(stored?JSON.parse(stored):clone(SEED)),revision:0};}
  if(!configured) throw new Error('Chưa kết nối cơ sở dữ liệu.');
  const result=await raw('/rest/v1/quiz_workspace?id=eq.1&select=data,revision',{token:await token()});
  if(!result?.length) throw new Error('Tài khoản này chưa được cấp quyền admin.');
  return {...result[0],data:validateData(result[0].data)};
}
export async function saveAdmin(data,revision) {
  validateData(data);
  if(demo){localStorage.setItem(DEMO_KEY,JSON.stringify(data));return revision+1;}
  return raw('/rest/v1/rpc/save_quiz',{method:'POST',token:await token(),body:{p_data:data,p_revision:revision}});
}
export async function loadPublic() {
  if(demo) return (await loadAdmin()).data;
  if(!configured) return clone(SEED);
  const rows=await raw('/rest/v1/quiz_public?id=eq.1&select=data');
  if(!rows.length) return {version:1,title:'Cùng khám phá giáo lý',types:clone(SEED.types),questions:[]};
  return validateData(rows[0].data);
}
export async function signup(email,password) {
  if(password.length<10)throw new Error('Mật khẩu cần ít nhất 10 ký tự.');
  const redirect = new URL('admin.html',location.href).href.split('?')[0];
  const result=await raw(`/auth/v1/signup?redirect_to=${encodeURIComponent(redirect)}`,{method:'POST',body:{email,password}});
  if(result.access_token)storeSession(result);
  return Boolean(result.access_token);
}
export async function recover(email) {
  const redirect=new URL('admin.html',location.href).href.split('?')[0];
  await raw(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirect)}`,{method:'POST',body:{email}});
}
export async function updatePassword(password) {
  if(password.length<10)throw new Error('Mật khẩu cần ít nhất 10 ký tự.');
  await raw('/auth/v1/user',{method:'PUT',token:await token(),body:{password}});
}
export async function acceptCallback() {
  const params=new URLSearchParams(location.hash.slice(1));
  if(params.get('error_description')) {const msg=params.get('error_description');history.replaceState(null,'',location.pathname);throw new Error(`Liên kết không hợp lệ hoặc đã hết hạn: ${msg}`);}
  if(!params.get('access_token'))return false;
  const access=params.get('access_token');
  const user=await raw('/auth/v1/user',{token:access});
  storeSession({access_token:access,refresh_token:params.get('refresh_token'),expires_at:Math.floor(Date.now()/1000)+Number(params.get('expires_in')||3600),user});
  const recovery=params.get('type')==='recovery';
  history.replaceState(null,'',location.pathname);
  return recovery;
}
