document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('formFiltro');
    const alertaFiltro = document.getElementById('alertaFiltro');
  
    form.addEventListener('submit', (event) => {
      const palabraClave = form.elements['palabraClave'].value.trim();
      const departamento = form.elements['departamento'].value;
      const ubicacion = form.elements['ubicacion'].value;
  
      if (!palabraClave && !departamento && !ubicacion) {
        event.preventDefault();
        alertaFiltro.style.display = 'block';
      } else {
        alertaFiltro.style.display = 'none';
      }
    });
  });
