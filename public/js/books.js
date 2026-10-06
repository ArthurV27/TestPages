const modal=document.getElementById('bookModal'),form=document.getElementById('bookForm');
const fields=['book_code','isbn','title','author','category','quantity','cover_url','description'];
document.querySelector('[data-modal="bookModal"]')?.addEventListener('click',()=>{form.action='/librarian/books';document.getElementById('bookModalTitle').textContent='Add book';fields.forEach(x=>document.getElementById(x).value='');modal.classList.add('open')});
document.querySelectorAll('[data-edit-book]').forEach(btn=>btn.addEventListener('click',()=>{const b=JSON.parse(btn.dataset.editBook);form.action=`/librarian/books/${b.id}/update`;document.getElementById('bookModalTitle').textContent='Edit book';fields.forEach(x=>document.getElementById(x).value=b[x]??'');modal.classList.add('open')}));
