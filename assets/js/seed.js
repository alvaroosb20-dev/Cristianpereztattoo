/* Datos por defecto de la web. Se usan:
   - en el servidor, como valores iniciales que el panel de administración sobrescribe;
   - en el navegador, como modo demostración si la base de datos aún no está conectada.
   Todo lo de aquí se puede cambiar desde /admin sin tocar código. */
(function (root) {
  const DEFAULT_SETTINGS = {
    studio: {
      name: 'Cristhian Pérez Tattoo',
      artist: 'Cristhian Pérez',
      tagline: 'Realismo, fine line y piezas con alma editorial. Tenerife.',
      address: 'C. Álvaro Martín Díaz, 18, 38320 La Laguna, Santa Cruz de Tenerife',
      city: 'La Laguna, Tenerife',
      phone: '+34 646 62 37 06',
      whatsapp: '34646623706',
      email: '',
      instagram: 'cristianperez.tat',
      maps_query: 'C. Álvaro Martín Díaz, 18, 38320 La Laguna, Santa Cruz de Tenerife',
      hours_text: 'Martes a sábado · Solo con cita previa',
    },
    about:
      'Cristhian Pérez tatúa desde Tenerife con una idea fija: que cada pieza tenga composición, contraste y una razón de ser. ' +
      'Trabaja realismo en negro y grises, fine line y diseños propios con aire de collage editorial, de la estatua clásica a la tipografía de revista.\n\n' +
      'Cada proyecto empieza con una conversación. Cuéntale tu idea, adjunta referencias y él te propone el diseño, el tamaño y la zona que mejor van a envejecer en tu piel.',
    announcement: 'Reserva tu cita con una señal de 50 € · Envíos a toda España · Tienda oficial',
    deposit_cents: 5000,
    deposit_deducted: true,
    sizes: [
      { id: 'mini', label: 'Mini', detail: 'hasta 5 cm', price_cents: 6000, duration_min: 60 },
      { id: 'pequeno', label: 'Pequeño', detail: '5 – 10 cm', price_cents: 10000, duration_min: 90 },
      { id: 'mediano', label: 'Mediano', detail: '10 – 15 cm', price_cents: 18000, duration_min: 180 },
      { id: 'grande', label: 'Grande', detail: '15 – 25 cm', price_cents: 30000, duration_min: 300 },
      { id: 'sesion', label: 'Sesión completa', detail: 'brazo, espalda, piezas grandes', price_cents: 45000, duration_min: 420 },
    ],
    styles: ['Realismo black & grey', 'Fine line', 'Microrealismo', 'Lettering editorial', 'Blackwork', 'Diseño propio / collage'],
    body_zones: ['Antebrazo', 'Brazo', 'Hombro', 'Espalda', 'Pecho', 'Costillas', 'Pierna', 'Gemelo', 'Muñeca', 'Mano', 'Cuello', 'Otra zona'],
    schedule: {
      slot_step_min: 30,
      min_notice_hours: 24,
      max_days_ahead: 90,
      hold_minutes: 35,
      // 0 = domingo … 6 = sábado
      days: {
        0: { closed: true },
        1: { closed: true },
        2: { open: '11:00', close: '20:00', breaks: [] },
        3: { open: '11:00', close: '20:00', breaks: [] },
        4: { open: '11:00', close: '20:00', breaks: [] },
        5: { open: '11:00', close: '20:00', breaks: [] },
        6: { open: '11:00', close: '19:00', breaks: [] },
      },
    },
    shipping: {
      free_over_cents: 6000,
      zones: [
        { id: 'canarias', label: 'Canarias', price_cents: 495 },
        { id: 'peninsula', label: 'Península', price_cents: 695 },
        { id: 'baleares', label: 'Baleares', price_cents: 795 },
        { id: 'recogida', label: 'Recogida en el estudio', price_cents: 0 },
      ],
    },
    texts: {
      'condiciones-reserva':
        'TEXTO DE EJEMPLO. El estudio debe revisarlo y adaptarlo desde el panel antes de publicar la web.\n\n' +
        '## Señal de reserva\n' +
        '- Para bloquear tu fecha se paga una señal de [IMPORTE] €.\n' +
        '- La señal es un pago a cuenta: se descuenta del precio final del tatuaje.\n\n' +
        '## Cambios de fecha\n' +
        '- Puedes pedir un cambio de fecha con al menos [HORAS] horas de antelación escribiendo al estudio.\n' +
        '- [Número de cambios permitidos y condiciones].\n\n' +
        '## Cancelaciones y devolución de la señal\n' +
        '- [Indica en qué casos se devuelve la señal y en cuáles se pierde].\n' +
        '- Si el estudio cancela la cita, [condiciones de devolución o nueva fecha].\n\n' +
        '## Precio final\n' +
        '- El tatuador confirma el presupuesto del tatuaje según el diseño, el tamaño y la zona después de revisar tu solicitud.\n\n' +
        '## Requisitos\n' +
        '- Ser mayor de edad y presentar documento de identidad el día de la cita.\n\n' +
        '## Imágenes enviadas\n' +
        '- Las imágenes que adjuntas se usan solo para preparar tu diseño y se guardan de forma privada. Puedes pedir que se borren en cualquier momento.',
      'envios-devoluciones':
        'TEXTO DE EJEMPLO. Revísalo desde el panel.\n\n' +
        '## Envíos\n' +
        '- Preparamos los pedidos en [X] días laborables.\n' +
        '- Envíos a Canarias, Península y Baleares. Los gastos se calculan en el carrito.\n' +
        '- Los envíos desde Canarias a Península y Baleares pueden requerir trámites aduaneros (DUA). [Indica quién los asume].\n\n' +
        '## Devoluciones\n' +
        '- Tienes 14 días naturales desde la entrega para desistir de tu compra, salvo productos personalizados o de higiene precintados una vez abiertos.\n' +
        '- Escríbenos a [email] para gestionar la devolución.',
      privacidad:
        'TEXTO DE EJEMPLO. Revísalo con tu asesor antes de publicar.\n\n' +
        '## Responsable\n[Nombre y apellidos o razón social] · [NIF] · [Dirección] · [Email]\n\n' +
        '## Qué datos tratamos\n- Datos de contacto y de la cita que nos facilitas en el formulario.\n- Imágenes de referencia que adjuntas para tu diseño.\n- Datos de envío y facturación de tus pedidos.\n\n' +
        '## Finalidad\n- Gestionar tu cita, tus pedidos y comunicarnos contigo.\n\n' +
        '## Pagos\n- Los pagos los procesa Stripe. Nunca vemos ni guardamos los datos de tu tarjeta.\n\n' +
        '## Tus derechos\n- Puedes acceder, rectificar o suprimir tus datos escribiendo a [email].',
      'aviso-legal':
        'TEXTO DE EJEMPLO.\n\n## Titular\n[Nombre y apellidos o razón social] · [NIF] · [Dirección] · [Email] · [Teléfono]\n\n## Condiciones de uso\n[Condiciones de uso de la web].',
      cookies:
        'Esta web solo usa almacenamiento técnico del navegador para guardar tu carrito. Si activas Google Analytics, actualiza este texto y añade un aviso de consentimiento.',
    },
  };

  const PRODUCTS = [
    { id: 'demo-1', slug: 'camiseta-estatua', name: 'Camiseta Estatua', category: 'ropa', price_cents: 3500, stock: 40, featured: true, active: true, sort: 1,
      images: ['img/products/camiseta-estatua.svg'],
      description: 'Camiseta negra de algodón grueso con la estatua clásica del estudio serigrafiada en blanco hueso. Corte recto, cuello reforzado.',
      variants: [{ name: 'Talla', options: [{ label: 'S' }, { label: 'M' }, { label: 'L' }, { label: 'XL' }, { label: 'XXL' }] }] },
    { id: 'demo-2', slug: 'camiseta-impossible', name: 'Camiseta Impossible', category: 'ropa', price_cents: 3500, stock: 30, featured: true, active: true, sort: 2,
      images: ['img/products/camiseta-impossible.svg'],
      description: 'Camiseta blanca con la portada «Impossible» en tipografía de revista. Tinta negra al agua, tacto suave.',
      variants: [{ name: 'Talla', options: [{ label: 'S' }, { label: 'M' }, { label: 'L' }, { label: 'XL' }] }] },
    { id: 'demo-3', slug: 'gorra-cp', name: 'Gorra CP', category: 'gorras', price_cents: 3000, stock: 25, featured: true, active: true, sort: 3,
      images: ['img/products/gorra-cp.svg'],
      description: 'Gorra de seis paneles con el monograma CP bordado. Cierre ajustable.',
      variants: [{ name: 'Color', options: [{ label: 'Negro' }, { label: 'Hueso' }] }] },
    { id: 'demo-4', slug: 'sudadera-estudio', name: 'Sudadera Estudio', category: 'ropa', price_cents: 5900, stock: 20, featured: false, active: true, sort: 4,
      images: ['img/products/sudadera-estudio.svg'],
      description: 'Sudadera con capucha, felpa perchada y el nombre del estudio en la espalda.',
      variants: [{ name: 'Talla', options: [{ label: 'S' }, { label: 'M' }, { label: 'L' }, { label: 'XL' }] }] },
    { id: 'demo-5', slug: 'balsamo-aftercare', name: 'Bálsamo Aftercare 50 ml', category: 'cuidado', price_cents: 1400, stock: 60, featured: true, active: true, sort: 5,
      images: ['img/products/balsamo.svg'],
      description: 'Bálsamo para la cicatrización del tatuaje. Aplica una capa fina dos o tres veces al día durante las dos primeras semanas.',
      variants: [] },
    { id: 'demo-6', slug: 'kit-cuidado', name: 'Kit de cuidado', category: 'cuidado', price_cents: 2400, stock: 30, featured: false, active: true, sort: 6,
      images: ['img/products/kit.svg'],
      description: 'Bálsamo de 50 ml, jabón neutro y film protector. Todo lo que necesitas para los primeros días.',
      variants: [] },
    { id: 'demo-7', slug: 'print-proporcion-aurea', name: 'Print Proporción Áurea', category: 'prints', price_cents: 4000, stock: 15, featured: false, active: true, sort: 7,
      images: ['img/products/print.svg'],
      description: 'Lámina A3 del boceto original de la estatua con espiral áurea. Papel algodón de 300 g, edición numerada.',
      variants: [{ name: 'Formato', options: [{ label: 'A3' }, { label: 'A4', price_cents: 2800 }] }] },
    { id: 'demo-8', slug: 'tarjeta-regalo', name: 'Tarjeta regalo', category: 'regalo', price_cents: 10000, stock: 999, featured: false, active: true, sort: 8,
      images: ['img/products/tarjeta-regalo.svg'],
      description: 'Regala un tatuaje. Elige el importe (100 €, 150 €, 200 € o 250 €) o una sesión de brazo completa por 370 €. Válida para sesiones en el estudio durante 12 meses.',
      variants: [{ name: 'Importe', options: [{ label: '100 €', price_cents: 10000 }, { label: '150 €', price_cents: 15000 }, { label: '200 €', price_cents: 20000 }, { label: '250 €', price_cents: 25000 }, { label: 'Sesión de brazo · 370 €', price_cents: 37000 }] }] },
  ];

  const CATEGORIES = [
    { id: 'ropa', label: 'Ropa' },
    { id: 'gorras', label: 'Gorras' },
    { id: 'cuidado', label: 'Cuidado' },
    { id: 'prints', label: 'Prints' },
    { id: 'regalo', label: 'Tarjetas regalo' },
  ];

  const PORTFOLIO = [
    { id: 'p1', kind: 'video', src: 'media/video-1.mp4', poster: 'media/video-1.jpg', title: 'Sesión en el estudio · fine line', style: 'Fine line', sort: 1, visible: true },
    { id: 'p2', kind: 'video', src: 'media/video-2.mp4', poster: 'media/video-2.jpg', title: 'Del stencil a la pieza', style: 'Microrealismo', sort: 2, visible: true },
    { id: 'p3', kind: 'photo', src: 'media/tattoo-estatua.webp', poster: '', title: 'Estatua clásica y proporción áurea', style: 'Realismo black & grey', sort: 3, visible: true },
    { id: 'p4', kind: 'photo', src: 'media/tattoo-impossible.webp', poster: '', title: 'Impossible · espalda editorial', style: 'Lettering editorial', sort: 4, visible: true },
  ];

  const api = { DEFAULT_SETTINGS, PRODUCTS, CATEGORIES, PORTFOLIO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CPSeed = api;
})(typeof window !== 'undefined' ? window : globalThis);
