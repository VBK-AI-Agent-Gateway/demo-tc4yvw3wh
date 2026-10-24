/* ============ 云OA 办公系统 ============ */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const USERS = [
  { id:'u1', name:'张伟', role:'研发部 · 部门经理', initials:'张' },
  { id:'u2', name:'李娜', role:'研发部 · 工程师', initials:'李' },
  { id:'u3', name:'王强', role:'总经理 · 高管', initials:'王' },
  { id:'u4', name:'赵敏', role:'财务部 · 会计', initials:'赵' },
];
let currentUser = USERS[0];
let flowType = '请假';
let recordFilter = 'all';

/* ---- 数据 (localStorage) ---- */
const DB = {
  get att() { return JSON.parse(localStorage.getItem('oa_att') || '{}'); },
  set att(v) { localStorage.setItem('oa_att', JSON.stringify(v)); },
  get flows() {
    if (!localStorage.getItem('oa_flows')) {
      const now = new Date();
      const d = n => { const x = new Date(now); x.setDate(x.getDate()-n); return fmtDate(x); };
      localStorage.setItem('oa_flows', JSON.stringify([
        { id:1001, type:'请假', applicant:'李娜', approver:'张伟', start:d(2), end:d(1), amount:0, reason:'家中有事，申请事假两天', status:'待审批', time:d(2)+' 09:20' },
        { id:1002, type:'报销', applicant:'赵敏', approver:'王强', start:d(3), end:d(3), amount:1280, reason:'采购办公耗材及打印纸', status:'已通过', time:d(3)+' 14:05' },
        { id:1003, type:'加班', applicant:'张伟', approver:'王强', start:d(1), end:d(1), amount:0, reason:'版本发布紧急加班 3 小时', status:'已通过', time:d(1)+' 20:41' },
        { id:1004, type:'出差', applicant:'李娜', approver:'张伟', start:d(5), end:d(3), amount:0, reason:'赴上海参加技术峰会', status:'已驳回', time:d(5)+' 11:12' },
      ]));
    }
    return JSON.parse(localStorage.getItem('oa_flows'));
  },
  set flows(v) { localStorage.setItem('oa_flows', JSON.stringify(v)); },
};

function fmtDate(d) {
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(()=>t.classList.remove('show'), 2200);
}
const ICONS = { 请假:'🌴', 报销:'💰', 加班:'🌙', 出差:'✈️' };

/* ---- 导航 ---- */
$$('.nav-item').forEach(item => item.onclick = () => {
  $$('.nav-item').forEach(i => i.classList.remove('active'));
  $$('.page').forEach(p => p.classList.remove('active'));
  item.classList.add('active');
  $('#page-'+item.dataset.page).classList.add('active');
  render();
});

/* ---- 用户切换 ---- */
const sel = $('#userSelect');
USERS.forEach(u => { const o = document.createElement('option'); o.value = u.id; o.textContent = u.name+'（'+u.role+'）'; sel.appendChild(o); });
sel.onchange = () => {
  currentUser = USERS.find(u => u.id === sel.value);
  $('#userName').textContent = currentUser.name;
  $('#userRole').textContent = currentUser.role;
  $('#userAvatar').textContent = currentUser.initials;
  render();
};

/* ---- 工作台 ---- */
function renderDashboard() {
  const att = DB.att;
  const today = fmtDate(new Date());
  const myRec = att[currentUser.id] || {};
  const todayRec = myRec[today];
  const flows = DB.flows;
  const myPending = flows.filter(f => f.status==='待审批');
  const needMe = flows.filter(f => f.status==='待审批' && f.approver===currentUser.name);

  const inDays = Object.keys(myRec).filter(d => d.startsWith(today.slice(0,7)) && myRec[d].in).length;

  $('#statGrid').innerHTML = `
    <div class="stat-card"><div class="s-label">今日打卡</div><div class="s-value" style="color:${todayRec&&todayRec.in?'#10b981':'#9ca3af'}">${todayRec&&todayRec.in?'✓':'—'}</div><div class="s-sub">${todayRec&&todayRec.in?('上班 '+todayRec.in+(todayRec.out?(' · 下班 '+todayRec.out):'')):'尚未上班打卡'}</div></div>
    <div class="stat-card"><div class="s-label">本月出勤</div><div class="s-value">${inDays}<span style="font-size:14px;color:#9ca3af"> 天</span></div><div class="s-sub">正常出勤记录</div></div>
    <div class="stat-card"><div class="s-label">待我审批</div><div class="s-value" style="color:#f59e0b">${needMe.length}</div><div class="s-sub">请及时处理</div></div>
    <div class="stat-card"><div class="s-label">我发起的审批</div><div class="s-value">${flows.filter(f=>f.applicant===currentUser.name).length}</div><div class="s-sub">含待审批 ${myPending.filter(f=>f.applicant===currentUser.name).length} 条</div></div>`;

  // 本周柱状图
  const week = ['一','二','三','四','五','六','日'];
  const now = new Date();
  const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay()+6)%7));
  let html = '';
  week.forEach((w,i) => {
    const d = new Date(monday); d.setDate(monday.getDate()+i);
    const key = fmtDate(d);
    const rec = myRec[key];
    const has = !!rec && !!rec.in;
    const late = has && rec.late;
    const future = d > now;
    const h = has ? (late?55:100) : (future?10:20);
    html += `<div class="wc-col">
      <div class="wc-val">${has ? (late?'迟到':'✓') : (future?'':'缺')}</div>
      <div class="wc-bar ${late?'late':''}" style="height:${h}%;"></div>
      <div class="wc-label">周${w}</div></div>`;
  });
  $('#weekChart').innerHTML = html;

  // 最新动态
  const latest = flows.slice(-5).reverse();
  $('#latestFlow').innerHTML = latest.map(f => `
    <div class="flow-row">
      <span class="dot ${f.status==='已通过'?'ok':f.status==='已驳回'?'no':'wait'}"></span>
      <span>${ICONS[f.type]||''} ${f.applicant} 的${f.type}申请 → ${f.approver}</span>
      <span class="f-time">${f.status} · ${f.time}</span>
    </div>`).join('') || '<div class="empty">暂无动态</div>';
}

/* ---- 考勤 ---- */
function tickClock() {
  const n = new Date();
  $('#clockTime').textContent = n.toTimeString().slice(0,8);
  $('#clockDate').textContent = n.toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'});
}
function renderAttendance() {
  const att = DB.att;
  if (!att[currentUser.id]) att[currentUser.id] = {};
  const rec = att[currentUser.id];
  const today = fmtDate(new Date());
  const t = rec[today] || {};
  const st = $('#clockStatus');
  if (t.out) { st.textContent = '已下班 ('+t.out+')'; st.className = 'clock-status out'; }
  else if (t.in) { st.textContent = '已上班 ('+t.in+')'; st.className = 'clock-status in'; }
  else { st.textContent = '未打卡'; st.className = 'clock-status'; }
  $('#btnClockIn').disabled = !!t.in;
  $('#btnClockOut').disabled = !t.in || !!t.out;
  $('#clockTip').textContent = t.note || '工作日 09:00 前打卡为正常，09:00 后记为迟到';

  // 本月记录
  const now = new Date();
  const days = [];
  for (let d=1; d<=now.getDate(); d++) days.push(fmtDate(new Date(now.getFullYear(), now.getMonth(), d)));
  days.reverse();
  const wk = ['日','一','二','三','四','五','六'];
  $('#attTable tbody').innerHTML = days.map(key => {
    const r = rec[key] || {};
    const dt = new Date(key+'T00:00:00');
    const weekend = dt.getDay()===0 || dt.getDay()===6;
    let tag;
    if (r.in) tag = r.late ? '<span class="tag late">迟到</span>' : '<span class="tag ok">正常</span>';
    else if (weekend) tag = '<span class="tag none">休息</span>';
    else if (key > fmtDate(now)) tag = '<span class="tag none">—</span>';
    else tag = '<span class="tag late">缺卡</span>';
    return `<tr><td>${key}</td><td>周${wk[dt.getDay()]}</td><td>${r.in||'—'}</td><td>${r.out||'—'}</td><td>${tag}</td></tr>`;
  }).join('');
}
$('#btnClockIn').onclick = () => {
  const att = DB.att;
  if (!att[currentUser.id]) att[currentUser.id] = {};
  const rec = att[currentUser.id];
  const today = fmtDate(new Date());
  const now = new Date();
  const hm = now.toTimeString().slice(0,5);
  const late = hm > '09:00';
  rec[today] = { ...(rec[today]||{}), in: hm, late, date:today,
    note: late ? '⚠ 打卡时间 '+hm+'，已记为迟到' : '✓ '+hm+' 打卡成功，正常出勤' };
  DB.att = att;
  toast(late ? '打卡成功，但已迟到 ('+hm+')' : '上班打卡成功！(' + hm + ')');
  render();
};
$('#btnClockOut').onclick = () => {
  const att = DB.att;
  if (!att[currentUser.id]) att[currentUser.id] = {};
  const rec = att[currentUser.id];
  const today = fmtDate(new Date());
  const hm = new Date().toTimeString().slice(0,5);
  rec[today] = { ...(rec[today]||{}), out: hm, note:'下班打卡成功 ('+hm+')，辛苦了！' };
  DB.att = att;
  toast('下班打卡成功！('+hm+')');
  render();
};

/* ---- 发起审批 ---- */
$$('.type-item').forEach(el => el.onclick = () => {
  $$('.type-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  flowType = el.dataset.type;
  $('#amountField').style.display = flowType==='报销' ? 'block' : 'none';
  $('#dateFields').querySelector('label').textContent = flowType==='报销' ? '消费日期' : '起止时间';
});
function fillApprovers() {
  const s = $('#fApprover'); s.innerHTML = '';
  USERS.filter(u => u.id !== currentUser.id).forEach(u => {
    const o = document.createElement('option'); o.value = u.name; o.textContent = u.name+'（'+u.role+'）'; s.appendChild(o);
  });
}
$('#btnSubmitFlow').onclick = () => {
  const start = $('#fStart').value, end = $('#fEnd').value || $('#fStart').value;
  const reason = $('#fReason').value.trim();
  const amount = parseFloat($('#fAmount').value || 0);
  if (!start) return toast('请选择起止时间');
  if (flowType==='报销' && !(amount>0)) return toast('请输入报销金额');
  if (!reason) return toast('请填写事由说明');
  const flows = DB.flows;
  flows.push({
    id: Date.now(), type: flowType, applicant: currentUser.name, approver: $('#fApprover').value,
    start, end, amount, reason, status:'待审批',
    time: fmtDate(new Date())+' '+new Date().toTimeString().slice(0,5)
  });
  DB.flows = flows;
  $('#fReason').value=''; $('#fAmount').value='';
  toast('审批已提交，等待 '+$('#fApprover').value+' 审批');
  render();
};

/* ---- 待我审批 ---- */
function renderPending() {
  const list = DB.flows.filter(f => f.status==='待审批' && f.approver===currentUser.name);
  $('#pendingBadge').textContent = list.length;
  $('#pendingList').innerHTML = list.length ? list.map(f => cardHTML(f, true)).join('')
    : '<div class="empty">🎉 没有待审批事项</div>';
}
function cardHTML(f, withActions) {
  const cls = f.status==='已通过'?'ok':f.status==='已驳回'?'no':'wait';
  return `<div class="flow-card" data-id="${f.id}">
    <div class="fc-icon">${ICONS[f.type]||'📄'}</div>
    <div class="fc-body">
      <div class="fc-title">${f.type}申请 · ${f.applicant} → ${f.approver}</div>
      <div class="fc-meta">${f.start}${f.end&&f.end!==f.start?' 至 '+f.end:''} ${f.amount?('| 金额 ¥'+f.amount.toFixed(2)):''} | 单号 #${String(f.id).slice(-6)} | ${f.time}</div>
      <div class="fc-reason">${f.reason}</div>
    </div>
    ${withActions
      ? `<div class="fc-actions"><button class="btn success sm" data-act="ok">通过</button><button class="btn danger sm" data-act="no">驳回</button></div>`
      : `<div class="fc-status ${cls}">${f.status}</div>`}
  </div>`;
}
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-act]'); if (!btn) return;
  const id = +btn.closest('.flow-card').dataset.id;
  const flows = DB.flows;
  const f = flows.find(x => x.id === id); if (!f) return;
  if (btn.dataset.act === 'ok') { f.status='已通过'; toast('已通过该审批 ✓'); }
  else { f.status='已驳回'; toast('已驳回该审批'); }
  DB.flows = flows; render();
});

/* ---- 审批记录 ---- */
$$('.chip').forEach(c => c.onclick = () => {
  $$('.chip').forEach(x => x.classList.remove('active'));
  c.classList.add('active'); recordFilter = c.dataset.f; renderRecords();
});
function renderRecords() {
  let list = DB.flows.slice().reverse();
  if (recordFilter !== 'all') list = list.filter(f => f.status === recordFilter);
  const mine = list.filter(f => f.applicant===currentUser.name || f.approver===currentUser.name);
  $('#recordList').innerHTML = mine.length ? mine.map(f => cardHTML(f, false)).join('')
    : '<div class="empty">暂无相关审批记录</div>';
}

/* ---- 渲染入口 ---- */
function render() {
  const now = new Date();
  $('#todayStr').textContent = now.toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'});
  fillApprovers();
  renderDashboard(); renderAttendance(); renderPending(); renderRecords();
}
tickClock(); setInterval(tickClock, 1000);
render();