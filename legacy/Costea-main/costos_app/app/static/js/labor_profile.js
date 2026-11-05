document.querySelectorAll('[data-add-labor-row]').forEach((button) => {
  const name = button.dataset.addLaborRow;
  const rows = document.querySelector(`[data-labor-rows="${name}"]`);
  const template = document.querySelector(`[data-labor-template="${name}"]`);
  const maximum = Number(rows.dataset.maxRows);
  button.disabled = rows.children.length >= maximum;
  button.addEventListener('click', () => {
    if (rows.children.length >= maximum) return;
    const indices = Array.from(rows.querySelectorAll('[name]')).map((field) =>
      Number(field.name.split('-')[1])
    );
    const next = indices.length ? Math.max(...indices) + 1 : 0;
    rows.insertAdjacentHTML('beforeend', template.innerHTML.replaceAll('__index__', String(next)));
    rows.lastElementChild.querySelector('input, select, textarea')?.focus();
    if (rows.children.length >= maximum) button.disabled = true;
  });
});
