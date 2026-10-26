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
    maintenance: {
      on: false,
      title: 'Preparando web',
      message: 'Estamos preparando la nueva web del estudio. Mientras tanto, pide tu cita por WhatsApp o Instagram.',
    },
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
      privacidad: "Última actualización: octubre de 2026.\n\n## Responsable del tratamiento\n- Responsable: Cristhian Pérez [segundo apellido] («Cristhian Pérez Tattoo»)\n- NIF: [NIF]\n- Dirección: C. Álvaro Martín Díaz, 18, 38320 San Cristóbal de La Laguna, Santa Cruz de Tenerife\n- Teléfono: +34 646 62 37 06\n- Correo electrónico para temas de privacidad: [email del estudio]\n\n## Qué datos tratamos\n- Datos de contacto: nombre y apellidos, correo electrónico y teléfono.\n- Datos de la cita: estilo, zona del cuerpo, tamaño, descripción de tu idea, fecha y hora, y la confirmación de que eres mayor de edad.\n- Imágenes que adjuntas como diseño o referencia para tu tatuaje.\n- Datos de pedidos: productos, dirección de envío y, si lo pides, datos de facturación (nombre o razón social y NIF).\n- Datos de pago: los gestiona Stripe. Nosotros nunca vemos ni guardamos el número de tu tarjeta.\n- Registro de aceptación de las condiciones de reserva (fecha y texto aceptado).\n\n## Para qué los usamos y con qué base legal\n- Gestionar tu solicitud de cita, preparar tu diseño, cobrar la señal y comunicarnos contigo sobre la cita. Base legal: ejecución de un contrato o de medidas precontractuales que tú solicitas (art. 6.1.b RGPD).\n- Gestionar tus pedidos de la tienda, el envío, las devoluciones y la atención al cliente. Base legal: ejecución del contrato de compraventa (art. 6.1.b RGPD).\n- Emitir facturas y cumplir obligaciones contables y fiscales. Base legal: obligación legal (art. 6.1.c RGPD).\n- Mostrar el mapa de Google o medir visitas con Google Analytics, solo si lo aceptas en el aviso de cookies. Base legal: tu consentimiento (art. 6.1.a RGPD), que puedes retirar cuando quieras.\nNo tomamos decisiones automatizadas ni elaboramos perfiles. No enviamos publicidad sin tu consentimiento.\n\n## Imágenes de diseños\nLas imágenes que adjuntas se guardan en un almacenamiento privado y solo el tatuador puede verlas, mediante enlaces temporales. No las publicamos ni las usamos para otros fines sin tu permiso. Si un tatuaje realizado se publica en redes o en el portafolio, será con tu consentimiento.\n\n## Cuánto tiempo los conservamos\n- Datos de citas e imágenes de diseño: mientras dure la relación y hasta 2 años después de la última cita, salvo que pidas antes su supresión.\n- Datos de pedidos y facturas: los plazos que exige la normativa fiscal y mercantil (hasta 6 años).\n- Reservas que no se llegan a pagar: se eliminan o anonimizan en un plazo máximo de 6 meses.\n\n## Con quién compartimos tus datos\nNo vendemos tus datos. Solo los comparten los proveedores que necesitamos para que la web funcione, con contrato de encargado del tratamiento:\n- Supabase (base de datos y almacenamiento de imágenes).\n- Stripe Payments Europe (procesamiento de pagos).\n- Resend (envío de correos de confirmación).\n- Vercel (alojamiento de la web).\n- Google (mapa y tipografías de la web; Analytics solo si lo aceptas).\n- WhatsApp / Meta, si eliges escribirnos por WhatsApp.\nAlgunos de estos proveedores pueden tratar datos fuera del Espacio Económico Europeo (por ejemplo, en Estados Unidos). En esos casos la transferencia se ampara en el Marco de Privacidad de Datos UE-EE. UU. o en cláusulas contractuales tipo aprobadas por la Comisión Europea.\nTambién podremos comunicar datos a las administraciones públicas cuando lo exija la ley.\n\n## Tus derechos\nPuedes ejercer en cualquier momento tus derechos de acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad, así como retirar tu consentimiento, escribiendo a [email del estudio] o por WhatsApp al +34 646 62 37 06, indicando qué derecho quieres ejercer.\nSi consideras que no hemos atendido bien tu solicitud, puedes presentar una reclamación ante la Agencia Española de Protección de Datos (www.aepd.es).\n\n## Menores\nLos servicios de tatuaje y las reservas online son solo para mayores de 18 años. No recogemos conscientemente datos de menores.\n\n## Seguridad\nAplicamos medidas técnicas y organizativas para proteger tus datos: conexión cifrada (HTTPS), acceso restringido a la base de datos, almacenamiento privado de imágenes y panel de gestión protegido con contraseña.",
      'aviso-legal': "Última actualización: octubre de 2026.\n\n## Datos del titular\nEn cumplimiento del artículo 10 de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se informa de los datos del titular de esta web:\n- Titular: Cristhian Pérez [segundo apellido], que actúa con el nombre comercial «Cristhian Pérez Tattoo».\n- NIF: [NIF]\n- Domicilio: C. Álvaro Martín Díaz, 18, 38320 San Cristóbal de La Laguna, Santa Cruz de Tenerife\n- Teléfono y WhatsApp: +34 646 62 37 06\n- Correo electrónico: [email del estudio]\n- Actividad: estudio de tatuaje y venta online de productos relacionados (ropa, productos de cuidado del tatuaje, prints y tarjetas regalo).\n\n## Objeto\nEsta web informa sobre los servicios del estudio, permite solicitar citas de tatuaje con pago de una señal y comprar productos de la tienda online. El acceso y uso de la web atribuye la condición de usuario e implica la aceptación de este aviso legal.\n\n## Condiciones de uso\n- El usuario se compromete a hacer un uso adecuado de la web y de sus contenidos, de acuerdo con la ley, la buena fe y el orden público.\n- Queda prohibido utilizar la web con fines ilícitos, introducir virus o cualquier sistema que pueda dañar los sistemas del titular o de terceros, y enviar datos o imágenes de terceros sin su consentimiento.\n- Los datos que facilites en los formularios deben ser veraces y estar actualizados. Para reservar una cita debes ser mayor de edad.\n\n## Propiedad intelectual e industrial\nTodos los contenidos de esta web (textos, fotografías, vídeos, diseños de tatuajes, logotipos, marca y código) son propiedad del titular o se usan con autorización, y están protegidos por la normativa de propiedad intelectual e industrial. Queda prohibida su reproducción, distribución, comunicación pública o transformación sin autorización expresa del titular, salvo para uso personal y privado.\n\nLos diseños que el estudio crea para cada cliente son obra del tatuador. Su uso por terceros o en otros estudios requiere autorización.\n\n## Responsabilidad\n- El titular no se hace responsable de interrupciones o errores en el acceso a la web por causas técnicas ajenas, ni de los daños que pueda causar un uso indebido de la web.\n- La web puede contener enlaces a sitios de terceros (Instagram, Google Maps, WhatsApp, Stripe). El titular no controla esos sitios ni responde de sus contenidos o políticas.\n- Los precios de los tatuajes no se publican en la web: el presupuesto lo confirma el tatuador tras revisar cada solicitud.\n\n## Compras y reservas\nLas compras en la tienda se rigen por la política de envíos y devoluciones, y las reservas de cita por las condiciones de reserva, ambas disponibles en esta web. Los pagos se procesan de forma segura a través de Stripe.\n\n## Resolución de litigios\nDe acuerdo con el Reglamento (UE) 524/2013, te informamos de que la plataforma europea de resolución de litigios en línea está disponible en https://ec.europa.eu/consumers/odr. También puedes dirigirte a la Dirección General de Comercio y Consumo del Gobierno de Canarias.\n\n## Legislación aplicable y jurisdicción\nEste aviso legal se rige por la legislación española. Para cualquier controversia serán competentes los juzgados y tribunales del domicilio del consumidor o, si el usuario no tiene la condición de consumidor, los de San Cristóbal de La Laguna.",
      cookies: "Última actualización: octubre de 2026.\n\n## Qué son las cookies\nLas cookies y tecnologías similares (como el almacenamiento local del navegador) son pequeños archivos que una web guarda en tu dispositivo para funcionar o para recordar información sobre tu visita.\n\n## Cookies que usa esta web\nTécnicas (necesarias, no requieren consentimiento):\n- cp_cart_v1 (almacenamiento local, propia): guarda los productos de tu carrito. Se conserva hasta que vacías el carrito o borras los datos del navegador.\n- cp_cookie_consent (almacenamiento local, propia): recuerda tu elección sobre las cookies durante 12 meses.\n- cp_sound_on (almacenamiento local, propia): recuerda si quieres oír la música de los vídeos.\n- cp_booking_draft y cp_checkout_draft (propias): guardan lo que llevas escrito en la reserva o en el carrito para que no lo pierdas. Se borran al cerrar el navegador o al terminar.\n- cp_admin (cookie propia): mantiene la sesión del panel del estudio. Solo afecta al personal del estudio.\n- Stripe (terceros): al pagar, Stripe usa cookies propias para prevenir el fraude y procesar el pago de forma segura.\n\nDe terceros (solo con tu consentimiento):\n- Google Maps (Google LLC): el mapa del estudio carga contenido de Google, que puede instalar cookies para recordar preferencias y medir el uso del mapa. Más información: https://policies.google.com/technologies/cookies\n- Google Analytics (Google LLC), solo si el estudio lo activa: cookies _ga y _ga_* para contar visitas de forma agregada, con duración de hasta 2 años.\n\n## Cómo gestionar tu consentimiento\nLa primera vez que entras te mostramos un aviso para aceptar, rechazar o configurar las cookies. Rechazar es tan fácil como aceptar y la web funciona igual: si las rechazas, el mapa no se carga hasta que lo pidas.\nPuedes cambiar tu elección en cualquier momento con el enlace «Configurar cookies» del pie de página.\nTambién puedes borrar o bloquear las cookies desde los ajustes de tu navegador (Safari, Chrome, Firefox o Edge).\n\n## Responsable\nEl responsable de esta web es Cristhian Pérez Tattoo. Consulta la política de privacidad para más información sobre cómo tratamos tus datos.",
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
    { id: 'demo-g100', slug: 'tarjeta-regalo-100', name: 'Tarjeta regalo 100 €', category: 'regalo', price_cents: 10000, stock: 999, featured: false, active: true, sort: 8,
      images: ['img/products/tarjeta-regalo-100.svg'],
      description: 'Regala un tatuaje: tarjeta de 100 € para usar en el estudio. Válida durante 12 meses desde la compra.',
      variants: [] },
    { id: 'demo-g150', slug: 'tarjeta-regalo-150', name: 'Tarjeta regalo 150 €', category: 'regalo', price_cents: 15000, stock: 999, featured: false, active: true, sort: 9,
      images: ['img/products/tarjeta-regalo-150.svg'],
      description: 'Regala un tatuaje: tarjeta de 150 € para usar en el estudio. Válida durante 12 meses desde la compra.',
      variants: [] },
    { id: 'demo-g200', slug: 'tarjeta-regalo-200', name: 'Tarjeta regalo 200 €', category: 'regalo', price_cents: 20000, stock: 999, featured: false, active: true, sort: 10,
      images: ['img/products/tarjeta-regalo-200.svg'],
      description: 'Regala un tatuaje: tarjeta de 200 € para usar en el estudio. Válida durante 12 meses desde la compra.',
      variants: [] },
    { id: 'demo-g250', slug: 'tarjeta-regalo-250', name: 'Tarjeta regalo 250 €', category: 'regalo', price_cents: 25000, stock: 999, featured: false, active: true, sort: 11,
      images: ['img/products/tarjeta-regalo-250.svg'],
      description: 'Regala un tatuaje: tarjeta de 250 € para usar en el estudio. Válida durante 12 meses desde la compra.',
      variants: [] },
    { id: 'demo-gbrazo', slug: 'tarjeta-regalo-brazo', name: 'Tarjeta regalo · Sesión de brazo', category: 'regalo', price_cents: 37000, stock: 999, featured: false, active: true, sort: 12,
      images: ['img/products/tarjeta-regalo-brazo.svg'],
      description: 'Regala una sesión de brazo completa con Cristhian. Válida durante 12 meses desde la compra.',
      variants: [] },
  ];

  const CATEGORIES = [
    { id: 'ropa', label: 'Ropa' },
    { id: 'gorras', label: 'Gorras' },
    { id: 'cuidado', label: 'Cuidado' },
    { id: 'prints', label: 'Prints' },
    { id: 'regalo', label: 'Tarjetas regalo' },
  ];

  const PORTFOLIO = [
    { id: 'c0', kind: 'video', src: 'media/clip-estudio.mp4', poster: 'media/clip-estudio.jpg', title: 'Sesión en el estudio · costillas', style: 'Blackwork', sort: 0, visible: true },
    { id: 'c1', kind: 'video', src: 'media/clip-sesion.mp4', poster: 'media/clip-sesion.jpg', title: 'Sesión en el estudio', style: 'Blackwork', sort: 1, visible: true },
    { id: 'c2', kind: 'video', src: 'media/clip-detalle.mp4', poster: 'media/clip-detalle.jpg', title: 'Línea a línea', style: 'Realismo black & grey', sort: 2, visible: true },
    { id: 'c3', kind: 'video', src: 'media/clip-llegada.mp4', poster: 'media/clip-llegada.jpg', title: 'Un día con Cristhian', style: 'Backstage', sort: 3, visible: true },
    { id: 'p1', kind: 'video', src: 'media/video-1.mp4', poster: 'media/video-1.jpg', title: 'Sesión en el estudio · fine line', style: 'Fine line', sort: 4, visible: true },
    { id: 'p2', kind: 'video', src: 'media/video-2.mp4', poster: 'media/video-2.jpg', title: 'Del stencil a la pieza', style: 'Microrealismo', sort: 5, visible: true },
  ];

  const api = { DEFAULT_SETTINGS, PRODUCTS, CATEGORIES, PORTFOLIO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CPSeed = api;
})(typeof window !== 'undefined' ? window : globalThis);
