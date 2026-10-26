CP.ready(async (site) => {
  const box = CP.$('#confirm');
  const sid = new URLSearchParams(location.search).get('session_id');
  const st = site.settings.studio;
  const contact = `<p class="muted" style="margin:0">${CP.esc(st.name)} · ${CP.esc(st.address || st.city)}${st.phone ? ' · ' + CP.esc(st.phone) : ''}${st.instagram ? ` · <a class="link" href="https://instagram.com/${CP.esc(st.instagram)}" target="_blank" rel="noopener">@${CP.esc(st.instagram)}</a>` : ''}</p>`;
  if (!sid) { box.innerHTML = `<h1 class="display h2">Falta el enlace de pago</h1><p class="muted">Abre esta página desde el enlace al que te devuelve Stripe tras pagar.</p><a class="btn" href="index.html">Volver al inicio</a>`; return; }
  let data;
  try { data = await CP.api('status?session_id=' + encodeURIComponent(sid)); }
  catch (e) { box.innerHTML = `<h1 class="display h2">No hemos podido comprobar el pago</h1><p class="muted">${CP.esc(e.message)} Recarga la página en unos segundos. Si el cargo aparece en tu banco, escríbenos y lo revisamos.</p>${contact}`; return; }

  if (!data.paid) {
    box.innerHTML = `<h1 class="display h2">El pago no se ha completado</h1><p class="muted">Stripe todavía no ha confirmado el pago, así que ${data.type === 'booking' ? 'la cita no está reservada' : 'el pedido no está confirmado'}. Si acabas de pagar, recarga en unos segundos.</p><a class="btn" href="${data.type === 'booking' ? 'reservar.html' : 'carrito.html'}">Volver a intentarlo</a>${contact}`;
    return;
  }

  if (data.type === 'booking') {
    const b = data.booking;
    CP.session.del('cp_booking_draft');
    const needs = data.status === 'needs_attention';
    const dl = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
    box.innerHTML = `
      <span class="label gold">${needs ? 'Pago recibido' : 'Señal pagada'}</span>
      <h1 class="display h2">${needs ? 'Te contactamos para fijar fecha' : `Gracias, ${CP.esc(b.name.split(' ')[0])}. Tu fecha está bloqueada.`}</h1>
      <p class="muted" style="margin:0">${needs ? 'Hemos recibido tu señal, pero esa hora se ocupó mientras pagabas. El estudio te escribirá para darte otra fecha o devolverte la señal.' : 'Cristhian revisará tu idea y te confirmará la cita y el presupuesto por correo.'} Te hemos enviado el justificante a tu email.</p>
      <div class="ref">Ref. ${CP.esc(b.ref)}</div>
      <dl class="ticket" style="position:static;padding:1.2rem">
        ${dl('Nombre', CP.esc(b.name))}
        ${dl('Fecha', CP.esc(CP.cap(b.date_label)))}
        ${dl('Hora', `${CP.esc(b.time)} h · ${Math.round(b.duration_min / 6) / 10} h aprox.`)}
        ${dl('Tatuaje', `${CP.esc(b.style)} · ${CP.esc(b.body_zone)} · ${CP.esc(b.size_label)}`)}
        ${dl('Señal pagada', CP.euros(b.deposit_cents))}
        ${dl('Diseño', b.design_url ? `<img class="design-thumb" src="${CP.esc(b.design_url)}" alt="Diseño adjuntado" style="margin-left:auto">` : 'Sin adjuntar')}
      </dl>
      ${contact}
      <div style="display:flex;gap:.8rem;flex-wrap:wrap">
        ${st.whatsapp ? `<a class="btn" href="https://wa.me/${CP.esc(st.whatsapp.replace(/\D/g, ''))}?text=${encodeURIComponent(`Hola Cristhian, acabo de reservar mi cita (ref. ${b.ref}) para el ${b.date_label} a las ${b.time} h. Soy ${b.name}.`)}" target="_blank" rel="noopener">Escribir por WhatsApp</a>` : ''}
        <a class="btn btn-ghost" href="index.html">Volver al inicio</a>
      </div>`;
  } else {
    const o = data.order;
    CP.cart.clear();
    box.innerHTML = `
      <span class="label gold">Pedido confirmado</span>
      <h1 class="display h2">Gracias, ${CP.esc(o.name.split(' ')[0])}.</h1>
      <p class="muted" style="margin:0">Te hemos enviado la confirmación a ${CP.esc(o.email)}. Te avisaremos cuando salga.</p>
      <div class="ref">Ref. ${CP.esc(o.ref)}</div>
      <div class="summary">${o.items.map((i) => `<div class="sum-row"><span>${CP.esc(i.name)}${i.options_label ? ` <span class="muted mono">${CP.esc(i.options_label)}</span>` : ''} × ${i.qty}</span><span class="mono">${CP.euros(i.unit_cents * i.qty)}</span></div>`).join('')}
        <div class="sum-row"><span>Envío · ${CP.esc(o.shipping_label)}</span><span class="mono">${o.shipping_cents ? CP.euros(o.shipping_cents) : 'Gratis'}</span></div>
        <div class="sum-row total"><span>Total pagado</span><span class="mono">${CP.euros(o.total_cents)}</span></div></div>
      ${contact}
      <a class="btn" href="tienda.html">Volver a la tienda</a>`;
  }
});
