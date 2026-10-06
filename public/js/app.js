document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('[data-confirm]').forEach(form=>form.addEventListener('submit',e=>{if(!confirm(form.dataset.confirm))e.preventDefault()}));
  document.querySelectorAll('[data-table-search]').forEach(input=>input.addEventListener('input',()=>{const table=document.querySelector(input.dataset.tableSearch.startsWith('#')?input.dataset.tableSearch:'#'+input.dataset.tableSearch);const q=input.value.toLowerCase();table?.querySelectorAll('tbody tr').forEach(row=>row.style.display=(row.dataset.search||row.textContent).toLowerCase().includes(q)?'':'none')}));
  const loading=document.getElementById('loading');document.querySelectorAll('form').forEach(f=>f.addEventListener('submit',()=>{if(!f.dataset.noLoading)loading?.classList.add('show')}));
  const today=new Date().toISOString().slice(0,10);document.querySelectorAll('input[type=date]').forEach(i=>{if(i.id!=='due_date'||i.value==='')i.min=today});
  document.querySelectorAll('[data-modal-open]').forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.modalOpen)?.classList.add('open')));
  document.querySelectorAll('[data-close],[data-modal-close]').forEach(b=>b.addEventListener('click',()=>b.closest('.modal')?.classList.remove('open')));
  document.querySelectorAll('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open')}));
});
