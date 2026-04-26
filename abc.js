/* abc.js — El ABC de la Gestión OAC
   Inyecta un modal con los 5 pasos esenciales del sistema.
   Uso: incluir <script src="abc.js"></script> y un botón con onclick="openABC()" */

(function () {
  const STEPS = [
    {
      letter: 'A',
      color:  '#E07A3E',  // accent OAC
      title:  'Parametrizar el Panel de Control',
      desc:   'Configura tu empresa, usuarios y roles. Es el fundamento: sin esto, el resto no refleja tu negocio.',
      href:   'panel.html',
      cta:    'Ir al Panel'
    },
    {
      letter: 'B',
      color:  '#0E2A4E',  // navy OAC
      title:  'Capturar Costos Fijos',
      desc:   'Carga tus gastos mensuales recurrentes (renta, luz, sueldos base). Con esto, OAC calcula tu Punto de Equilibrio.',
      href:   'costos.html',
      cta:    'Ir a Costos'
    },
    {
      letter: 'C',
      color:  '#1E7F5C',  // good OAC
      title:  'Capturar la Nómina',
      desc:   'Registra los pagos a tu personal por semana. Alimenta los reportes y la hoja financiera.',
      href:   'nomina.html',
      cta:    'Ir a Nómina'
    },
    {
      letter: 'D',
      color:  '#B97A1B',  // warn OAC (ocre)
      title:  'Capturar la Hoja Financiera',
      desc:   'Todos los días capturas ventas, compras, cobros y caja. Es el corazón operativo: de aquí salen todos los números.',
      href:   'registro.html',
      cta:    'Ir a Captura'
    },
    {
      letter: 'E',
      color:  '#7C5BD9',  // purple OAC
      title:  'Leer el Dashboard',
      desc:   'Con los 4 pasos anteriores, ves tu negocio en tiempo real: utilidad, flujo, CxC/CxP, comparativas. Aquí decides.',
      href:   'dashboard.html',
      cta:    'Ir al Dashboard'
    }
  ];

  function buildCards() {
    return STEPS.map(s => `
      <div class="abc-card" style="--abc-col:${s.color}">
        <div class="abc-letter">${s.letter}</div>
        <div class="abc-step-title">${s.title}</div>
        <div class="abc-step-desc">${s.desc}</div>
        <a href="${s.href}" class="abc-step-btn">${s.cta} →</a>
      </div>
    `).join('');
  }

  function inject() {
    if (document.getElementById('abcOverlay')) return; // evita duplicados
    const overlay = document.createElement('div');
    overlay.className = 'abc-overlay';
    overlay.id = 'abcOverlay';
    overlay.innerHTML = `
      <div class="abc-box" role="dialog" aria-label="El ABC de la Gestión OAC">
        <button class="abc-close" onclick="closeABC()" aria-label="Cerrar">✕</button>
        <div class="abc-title">🔤 EL ABC DE LA GESTIÓN OAC</div>
        <div class="abc-sub">Los 5 pasos para sacarle el mejor provecho al sistema</div>
        <div class="abc-grid">${buildCards()}</div>
      </div>
    `;
    overlay.addEventListener('click', e => { if (e.target === overlay) closeABC(); });
    document.body.appendChild(overlay);

    // Cerrar con ESC
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeABC();
    });
  }

  window.openABC = function () {
    const ov = document.getElementById('abcOverlay');
    if (ov) ov.classList.add('open');
  };
  window.closeABC = function () {
    const ov = document.getElementById('abcOverlay');
    if (ov) ov.classList.remove('open');
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
