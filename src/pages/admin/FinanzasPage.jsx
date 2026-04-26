import React, { useState, useEffect, useMemo, useRef } from 'react';

const STORAGE_KEY = 'da_finanzas_v3';

const CATEGORIAS = {
  ingreso: ['Matrícula', 'Cuota mensual', 'Transferencia alumno', 'Nequi', 'Daviplata', 'Efectivo', 'Otro ingreso'],
  egreso:  ['Publicidad', 'Plataformas digitales', 'Material didáctico', 'Software / licencias', 'Equipamiento', 'Alquiler', 'Servicios (luz/internet)', 'Impuestos', 'Devolución', 'Otro egreso'],
};
const METODOS = ['Efectivo', 'Transferencia bancaria', 'Nequi', 'Daviplata', 'Bancolombia', 'MercadoPago', 'Tarjeta', 'Otro'];
const DUENOS  = ['Luis', 'Cristian'];
const TODAY   = new Date().toISOString().slice(0, 10);

const EMPTY_PAGO = { fecha: TODAY, monto: '', metodo: 'Efectivo', notas: '', cobrador: '' };
const EMPTY_FORM = {
  tipo: 'ingreso', categoria: 'Matrícula', descripcion: '', monto: '',
  fecha: TODAY, metodo: 'Transferencia bancaria', notas: '',
  tiene_deuda: false, beneficiario: '', cobrador: '', comprobantes: [], pagos: [],
  alumno_data: null, // { nombre, apellido, email, telefono, cursada } — solo en Matrícula
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid() { return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2); }
function fmt(n) { return Number(n || 0).toLocaleString('es'); }
function pct(pagado, total) { return total > 0 ? Math.min(100, (pagado / total) * 100) : 0; }

async function compressImage(file, maxWidth = 800, maxQ = 0.6) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = e => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let [w, h] = [img.width, img.height];
        if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(b => res(b), 'image/jpeg', maxQ);
      };
      img.onerror = rej;
    };
    reader.onerror = rej;
  });
}
function loadLocal() { try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : []; } catch { return []; } }
function saveLocal(d) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {} }
function toCSV(rows) {
  const cols = ['fecha', 'tipo', 'categoria', 'descripcion', 'monto', 'monto_pagado', 'deuda_restante', 'metodo', 'cobrador', 'tiene_deuda', 'deuda_estado'];
  return [cols.join(','), ...rows.map(r => cols.map(c => `"${r[c] ?? ''}"`).join(','))].join('\n');
}

// ── Helper de cursada ─────────────────────────────────────────────────────────
function normalizarCursada(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (/^\d+$/.test(s)) return `Cursada ${s}`;
  const m = s.match(/cursada\s*(\d+)/i);
  if (m) return `Cursada ${m[1]}`;
  return s;
}

// ── Helpers de cobrador ───────────────────────────────────────────────────────
// Regla única: si el pago tiene cobrador propio → ese. Si no → hereda el del movimiento.
function cobradorDePago(pago, movCobrador) {
  return pago.cobrador || movCobrador || 'Sin asignar';
}

function movMatchesCobrador(m, cobrador) {
  // Movimiento sin deuda: solo el cobrador del movimiento
  if (!m.tiene_deuda) return m.cobrador === cobrador;
  // Con deuda: algún pago (con fallback al cobrador del movimiento) coincide
  const pagos = m.pagos || [];
  if (pagos.length === 0) return m.cobrador === cobrador;
  return pagos.some(p => cobradorDePago(p, m.cobrador) === cobrador);
}

function montoDeCobradorEnMov(m, cobrador) {
  if (!m.tiene_deuda) {
    return m.cobrador === cobrador ? Number(m.monto_pagado ?? m.monto ?? 0) : 0;
  }
  const pagos = m.pagos || [];
  if (pagos.length === 0) {
    return m.cobrador === cobrador ? Number(m.monto_pagado ?? 0) : 0;
  }
  return pagos
    .filter(p => cobradorDePago(p, m.cobrador) === cobrador)
    .reduce((s, p) => s + Number(p.monto || 0), 0);
}

function distribuirPorCobrador(movimientos) {
  const result = {};
  DUENOS.forEach(d => { result[d] = 0; });
  result['Sin asignar'] = 0;
  movimientos.filter(m => m.tipo === 'ingreso').forEach(m => {
    const pagos = m.pagos || [];
    if (m.tiene_deuda && pagos.length > 0) {
      pagos.forEach(p => {
        const key = cobradorDePago(p, m.cobrador);
        result[key] = (result[key] || 0) + Number(p.monto || 0);
      });
    } else {
      const key = m.cobrador || 'Sin asignar';
      result[key] = (result[key] || 0) + Number(m.monto_pagado ?? m.monto ?? 0);
    }
  });
  return result;
}

// ── Summary Card ──────────────────────────────────────────────────────────────
function SummaryCard({ label, value, icon, colorClass, borderClass, sub }) {
  return (
    <div className={`card border ${borderClass} flex-1 min-w-[150px]`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`material-symbols-outlined ${colorClass}`}>{icon}</span>
        <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{label}</span>
      </div>
      <p className={`font-headline text-3xl font-black ${colorClass}`}>${fmt(Math.abs(value))}</p>
      {sub && <p className="text-xs text-on-surface-variant mt-1">{sub}</p>}
    </div>
  );
}

// ── Barra de progreso de deuda ────────────────────────────────────────────────
function DebtBar({ monto, montoPagado, deudaRestante, tipo, compact = false }) {
  const p      = pct(montoPagado, monto);
  const done   = deudaRestante === 0 && monto > 0;
  const color  = done ? 'bg-secondary' : tipo === 'ingreso' ? 'bg-amber-400' : 'bg-error';
  return (
    <div className="w-full">
      <div className={`flex justify-between ${compact ? 'text-[10px]' : 'text-xs'} mb-1`}>
        <span className="text-on-surface-variant">
          Abonado: <b className="text-on-surface">${fmt(montoPagado)}</b>
        </span>
        {done
          ? <span className="text-secondary font-bold">Pago completo ✓</span>
          : <span className={`font-bold ${tipo === 'ingreso' ? 'text-amber-400' : 'text-error'}`}>
              Restante: ${fmt(deudaRestante)}
            </span>
        }
        <span className="text-on-surface-variant">
          Total: <b className="text-on-surface">${fmt(monto)}</b>
        </span>
      </div>
      <div className={`${compact ? 'h-1.5' : 'h-2.5'} bg-outline-variant/20 rounded-full overflow-hidden`}>
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

// ── Mini modal de abono rápido ────────────────────────────────────────────────
function QuickAbonoModal({ mov, onClose, onSave, isSaving }) {
  const esMeDeben    = mov.tipo === 'ingreso';
  const deudaRestante = Number(mov.deuda_restante ?? (mov.monto - (mov.monto_pagado || 0)));
  const [pago, setPago] = useState({ ...EMPTY_PAGO, cobrador: mov.cobrador || '' });

  function handleSubmit(e) {
    e.preventDefault();
    const n = Number(pago.monto);
    if (!n || n <= 0) return alert('Ingresá un monto válido.');
    if (n > deudaRestante) return alert(`El abono no puede superar la deuda restante ($${fmt(deudaRestante)}).`);
    onSave(mov, { id: uid(), fecha: pago.fecha, monto: n, metodo: pago.metodo, notas: pago.notas || '', cobrador: pago.cobrador || '' });
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`bg-surface-container w-full max-w-sm rounded-2xl border-2 overflow-hidden ${esMeDeben ? 'border-amber-500/50' : 'border-error/50'}`}>

        {/* Header */}
        <div className={`px-5 py-4 flex items-center justify-between ${esMeDeben ? 'bg-amber-500/10' : 'bg-error/10'}`}>
          <div>
            <p className={`font-headline font-bold ${esMeDeben ? 'text-amber-400' : 'text-error'}`}>
              {esMeDeben ? 'Registrar cobro' : 'Registrar pago'}
            </p>
            <p className="text-xs text-on-surface-variant mt-0.5 truncate max-w-[220px]">{mov.descripcion}</p>
          </div>
          <button type="button" onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Barra de progreso */}
        <div className="px-5 pt-4">
          <DebtBar
            monto={Number(mov.monto)}
            montoPagado={Number(mov.monto_pagado || 0)}
            deudaRestante={deudaRestante}
            tipo={mov.tipo}
          />
        </div>

        {/* Abonos previos */}
        {(mov.pagos || []).length > 0 && (
          <div className="px-5 pt-3 space-y-1 max-h-32 overflow-y-auto">
            {(mov.pagos || []).map((p, i) => (
              <div key={p.id ?? i} className="flex items-center gap-2 text-xs text-on-surface-variant bg-surface-variant/30 rounded-lg px-2.5 py-1.5">
                <span className="material-symbols-outlined text-[12px] text-secondary shrink-0">check_circle</span>
                <span className="whitespace-nowrap">{new Date(p.fecha + 'T12:00').toLocaleDateString('es', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                <span className="font-bold text-on-surface">${fmt(p.monto)}</span>
                <span>{p.metodo}</span>
                {p.cobrador && <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary font-bold">{p.cobrador}</span>}
                {p.notas && <span className="italic truncate">{p.notas}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Formulario nuevo abono */}
        {deudaRestante > 0 ? (
          <form onSubmit={handleSubmit} className="p-5 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Nuevo abono</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-on-surface-variant block mb-1">Fecha</label>
                <input type="date" required value={pago.fecha}
                  onChange={e => setPago(p => ({ ...p, fecha: e.target.value }))}
                  className="input-field py-2 text-sm" />
              </div>
              <div>
                <label className="text-[10px] text-on-surface-variant block mb-1">
                  Monto (máx ${fmt(deudaRestante)})
                </label>
                <input type="number" required min="1" step="1"
                  placeholder={fmt(deudaRestante)}
                  value={pago.monto}
                  onChange={e => setPago(p => ({ ...p, monto: e.target.value }))}
                  className="input-field py-2 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-on-surface-variant block mb-1">Método</label>
                <select value={pago.metodo}
                  onChange={e => setPago(p => ({ ...p, metodo: e.target.value }))}
                  className="input-field py-2 text-sm">
                  {METODOS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-on-surface-variant block mb-1">Cobrador</label>
                <select value={pago.cobrador}
                  onChange={e => setPago(p => ({ ...p, cobrador: e.target.value }))}
                  className="input-field py-2 text-sm">
                  <option value="">— Sin asignar —</option>
                  {DUENOS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-on-surface-variant block mb-1">Nota (opcional)</label>
              <input value={pago.notas}
                onChange={e => setPago(p => ({ ...p, notas: e.target.value }))}
                className="input-field py-2 text-sm" placeholder="ej: 1ª cuota" />
            </div>
            {/* Botón pagar todo */}
            {deudaRestante > 0 && (
              <button type="button"
                onClick={() => setPago(p => ({ ...p, monto: String(deudaRestante) }))}
                className="text-xs text-primary hover:underline font-bold">
                Pagar todo el restante (${fmt(deudaRestante)})
              </button>
            )}
            <button type="submit" disabled={isSaving}
              className={`w-full py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                esMeDeben ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400' : 'bg-error/20 hover:bg-error/30 text-error'
              }`}>
              {isSaving
                ? <><span className="material-symbols-outlined animate-spin text-sm">sync</span> Guardando...</>
                : <><span className="material-symbols-outlined text-sm">add</span> Registrar abono</>
              }
            </button>
          </form>
        ) : (
          <div className="p-5 text-center">
            <span className="material-symbols-outlined text-4xl text-secondary block mb-2">check_circle</span>
            <p className="font-bold text-secondary">Deuda completamente saldada</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Movement Row ──────────────────────────────────────────────────────────────
function Row({ m, onEdit, onDelete, onAbono, filterCobrador }) {
  const done    = m.tiene_deuda && m.deuda_estado === 'pagado';
  const pending = m.tiene_deuda && m.deuda_estado !== 'pagado';
  const montoPagado   = Number(m.monto_pagado ?? (m.tiene_deuda ? 0 : m.monto) ?? 0);
  const deudaRestante = Number(m.deuda_restante ?? 0);

  // Desglose de cobradores: cada pago hereda el cobrador del movimiento si no tiene uno propio
  const pagos = m.pagos || [];
  const cobradorBreakdown = pagos.length > 0
    ? Object.entries(
        pagos.reduce((acc, p) => {
          const k = cobradorDePago(p, m.cobrador);
          acc[k] = (acc[k] || 0) + Number(p.monto || 0);
          return acc;
        }, {})
      )
    : [];

  // Monto atribuido al cobrador filtrado (para resaltarlo)
  const montoFiltrado = filterCobrador ? montoDeCobradorEnMov(m, filterCobrador) : null;

  return (
    <tr className="border-b border-outline-variant/10 hover:bg-surface-variant/30 transition-colors group">
      <td className="py-3 px-4 text-on-surface-variant text-sm whitespace-nowrap">
        {new Date(m.fecha + 'T12:00').toLocaleDateString('es', { day: '2-digit', month: 'short', year: '2-digit' })}
      </td>
      <td className="py-3 px-4">
        <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full ${
          m.tipo === 'ingreso' ? 'bg-secondary/15 text-secondary' : 'bg-error/15 text-error'
        }`}>
          <span className="material-symbols-outlined text-[12px]">{m.tipo === 'ingreso' ? 'trending_up' : 'trending_down'}</span>
          {m.tipo}
        </span>
      </td>
      <td className="py-3 px-4 text-sm text-on-surface-variant">{m.categoria}</td>
      <td className="py-3 px-4 text-sm font-medium max-w-[180px] truncate">
        {m.descripcion}
        {m.comprobantes?.length > 0 && (
          <span title={`${m.comprobantes.length} adjunto(s)`} className="material-symbols-outlined text-[14px] text-primary align-middle ml-1">attachment</span>
        )}
      </td>
      <td className="py-3 px-4 text-sm text-on-surface-variant">{m.metodo}</td>
      {/* Cobrador: si hay pagos con cobrador propio, muestra el desglose */}
      <td className="py-3 px-4">
        {cobradorBreakdown.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            {cobradorBreakdown.map(([nombre, monto]) => (
              <span key={nombre}
                className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full w-fit ${
                  filterCobrador === nombre
                    ? 'bg-primary/25 text-primary ring-1 ring-primary/40'
                    : 'bg-primary/10 text-primary'
                }`}>
                <span className="material-symbols-outlined text-[9px]">person</span>
                {nombre}: ${fmt(monto)}
              </span>
            ))}
          </div>
        ) : m.cobrador ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            <span className="material-symbols-outlined text-[10px]">person</span>{m.cobrador}
          </span>
        ) : null}
      </td>
      <td className="py-3 px-4">
        {pending && (
          <button onClick={() => onAbono(m)}
            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full transition-colors hover:opacity-80 ${m.tipo === 'ingreso' ? 'bg-amber-500/15 text-amber-400' : 'bg-error/15 text-error'}`}>
            {m.tipo === 'ingreso' ? 'Me deben' : 'Les debo'}
          </button>
        )}
        {done && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-secondary/15 text-secondary">Saldado ✓</span>}
        {!m.tiene_deuda && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-secondary/15 text-secondary">Pagado</span>}
      </td>
      <td className="py-3 px-4">
        <span className={`font-black text-sm ${m.tipo === 'ingreso' ? 'text-secondary' : 'text-error'}`}>
          {m.tipo === 'egreso' ? '-' : '+'}${fmt(m.monto)}
        </span>
        {/* Cuando hay filtro de cobrador, muestra su porción destacada */}
        {filterCobrador && montoFiltrado !== null && montoFiltrado !== Number(m.monto) && (
          <div className="mt-0.5">
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
              {filterCobrador}: ${fmt(montoFiltrado)}
            </span>
          </div>
        )}
        {m.tiene_deuda && (
          <div className="mt-1 w-28">
            <div className="flex justify-between text-[9px] text-on-surface-variant mb-0.5">
              <span>${fmt(montoPagado)}</span>
              <span className={done ? 'text-secondary' : m.tipo === 'ingreso' ? 'text-amber-400' : 'text-error'}>
                {done ? '✓' : `-$${fmt(deudaRestante)}`}
              </span>
            </div>
            <div className="h-1 bg-outline-variant/20 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${done ? 'bg-secondary' : m.tipo === 'ingreso' ? 'bg-amber-400' : 'bg-error'}`}
                style={{ width: `${pct(montoPagado, Number(m.monto))}%` }} />
            </div>
          </div>
        )}
      </td>
      <td className="py-3 px-4">
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(m)} className="text-on-surface-variant hover:text-primary p-1 rounded">
            <span className="material-symbols-outlined text-base">edit</span>
          </button>
          <button onClick={() => onDelete(m.id)} className="text-on-surface-variant hover:text-error p-1 rounded">
            <span className="material-symbols-outlined text-base">delete</span>
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Deuda Card ────────────────────────────────────────────────────────────────
function DeudaCard({ d, onAbono, onEdit }) {
  const esMeDeben     = d.tipo === 'ingreso';
  const done          = d.deuda_estado === 'pagado';
  const montoPagado   = Number(d.monto_pagado ?? 0);
  const deudaRestante = Number(d.deuda_restante ?? Math.max(d.monto - montoPagado, 0));

  return (
    <div className={`card border transition-all ${done ? 'border-outline-variant/10 opacity-60' : esMeDeben ? 'border-amber-500/40' : 'border-error/40'}`}>
      {/* Top row */}
      <div className="flex items-start gap-4 mb-4">
        <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center mt-0.5 ${esMeDeben ? 'bg-amber-500/15' : 'bg-error/15'}`}>
          <span className={`material-symbols-outlined text-base ${esMeDeben ? 'text-amber-400' : 'text-error'}`}>
            {esMeDeben ? 'arrow_downward' : 'arrow_upward'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-bold truncate">{d.descripcion}</span>
            {d.comprobantes?.length > 0 && (
              <span className="material-symbols-outlined text-[14px] text-primary shrink-0">attachment</span>
            )}
            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${done ? 'bg-secondary/15 text-secondary' : esMeDeben ? 'bg-amber-500/15 text-amber-400' : 'bg-error/15 text-error'}`}>
              {done ? 'Saldado' : esMeDeben ? 'Me deben' : 'Les debo'}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-on-surface-variant">
            <span>{d.categoria}</span>
            {d.beneficiario && <span className="font-medium text-on-surface">→ {d.beneficiario}</span>}
            <span>{new Date(d.fecha + 'T12:00').toLocaleDateString('es')}</span>
            {d.cobrador && (
              <span className="inline-flex items-center gap-1 font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                <span className="material-symbols-outlined text-[10px]">person</span>{d.cobrador}
              </span>
            )}
          </div>
        </div>
        {/* Precio total */}
        <div className="text-right shrink-0">
          <p className={`font-headline font-black text-2xl ${esMeDeben ? 'text-amber-400' : 'text-error'}`}>
            ${fmt(deudaRestante)}
          </p>
          <p className="text-[10px] text-on-surface-variant">restante de ${fmt(d.monto)}</p>
        </div>
      </div>

      {/* Barra de progreso */}
      <DebtBar
        monto={Number(d.monto)}
        montoPagado={montoPagado}
        deudaRestante={deudaRestante}
        tipo={d.tipo}
        compact
      />

      {/* Abonos registrados */}
      {(d.pagos || []).length > 0 && (
        <div className="mt-3 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Abonos</p>
          {(d.pagos || []).map((p, i) => (
            <div key={p.id ?? i} className="flex items-center gap-2 text-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-[12px] text-secondary">check_circle</span>
              <span className="whitespace-nowrap">{new Date(p.fecha + 'T12:00').toLocaleDateString('es', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
              <span className="font-bold text-on-surface">${fmt(p.monto)}</span>
              <span>{p.metodo}</span>
              {p.notas && <span className="italic truncate">{p.notas}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Acciones */}
      <div className="flex gap-2 mt-4">
        {!done && (
          <button onClick={() => onAbono(d)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
              esMeDeben
                ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-400'
                : 'bg-error/15 hover:bg-error/25 text-error'
            }`}>
            <span className="material-symbols-outlined text-sm">payments</span>
            {esMeDeben ? 'Registrar cobro' : 'Registrar pago'}
          </button>
        )}
        <button onClick={() => onEdit(d)}
          className="py-2.5 px-4 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-surface-variant/50 transition-colors flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm">edit</span>
          Editar
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function FinanzasPage() {
  const isMountedRef = useRef(true);
  const [syncStatus, setSyncStatus]         = useState('idle');
  const [isUploading, setIsUploading]       = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [selectedFiles, setSelectedFiles]   = useState([]);
  const [isSavingAbono, setIsSavingAbono]   = useState(false);

  const [movimientos, setMovimientos] = useState([]);
  const [showModal, setShowModal]     = useState(false);
  const [editingId, setEditingId]     = useState(null);
  const [form, setForm]               = useState({ ...EMPTY_FORM });
  const [nuevoPago, setNuevoPago]     = useState({ ...EMPTY_PAGO });

  // Mini modal de abono rápido
  const [abonoTarget, setAbonoTarget] = useState(null); // movimiento activo para abonar

  const [filterTipo, setFilterTipo]         = useState('todos');
  const [filterMes, setFilterMes]           = useState('');
  const [filterDeuda, setFilterDeuda]       = useState('todos');
  const [filterCobrador, setFilterCobrador] = useState('');
  const [filterCursada, setFilterCursada]   = useState('');
  const [filterFechaDesde, setFilterFechaDesde] = useState('');
  const [filterFechaHasta, setFilterFechaHasta] = useState('');
  const [search, setSearch]                 = useState('');
  const [activeTab, setActiveTab]           = useState('movimientos');

  // Notas / recordatorios
  const [notas, setNotas]               = useState([]);
  const [showNotaForm, setShowNotaForm] = useState(false);
  const [isSavingNota, setIsSavingNota] = useState(false);
  const [notaForm, setNotaForm]         = useState({ fecha: TODAY, autor: DUENOS[0], texto: '' });
  const [notaFile, setNotaFile]         = useState(null);
  const [editingNotaId, setEditingNotaId]   = useState(null);
  const [editNotaForm, setEditNotaForm]     = useState({ fecha: '', autor: '', texto: '' });
  const [isSavingEditNota, setIsSavingEditNota] = useState(false);
  const [editingPagoId, setEditingPagoId]   = useState(null);
  const [editPagoForm, setEditPagoForm]     = useState({ fecha: '', monto: '', metodo: 'Efectivo', cobrador: '', notas: '' });

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const authHeaders = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    isMountedRef.current = true;
    loadFromSupabase();
    loadNotas();
    return () => { isMountedRef.current = false; };
  }, []);

  // ── Supabase CRUD ─────────────────────────────────────────────────────────

  async function loadFromSupabase() {
    setSyncStatus('syncing');
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/finanzas_movimientos?select=*&order=fecha.desc,created_at.desc`,
        { headers: authHeaders }
      );
      if (!isMountedRef.current) return;
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`HTTP ${res.status}: ${err}`);
      }
      const rows = await res.json();
      if (isMountedRef.current) { setMovimientos(rows); saveLocal(rows); setSyncStatus('ok'); }
    } catch (e) {
      console.error('[Finanzas] Error cargando:', e.message);
      if (isMountedRef.current) { setSyncStatus('error'); setMovimientos(loadLocal()); }
    }
  }

  async function apiInsert(payload) {
    const res = await fetch(`${supabaseUrl}/rest/v1/finanzas_movimientos`, {
      method: 'POST',
      headers: { ...authHeaders, Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Insert HTTP ${res.status}: ${err}`);
    }
    return (await res.json())[0];
  }

  async function apiUpdate(id, patch) {
    const res = await fetch(`${supabaseUrl}/rest/v1/finanzas_movimientos?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...authHeaders, Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Update HTTP ${res.status}: ${err}`);
    }
    return (await res.json())[0];
  }

  async function apiDelete(id) {
    const res = await fetch(`${supabaseUrl}/rest/v1/finanzas_movimientos?id=eq.${id}`, {
      method: 'DELETE', headers: authHeaders,
    });
    if (!res.ok) throw new Error(`Delete HTTP ${res.status}`);
  }

  // ── CRUD Notas ───────────────────────────────────────────────────────────
  async function loadNotas() {
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/finanzas_notas?select=*&order=fecha.desc,created_at.desc`,
        { headers: authHeaders }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (isMountedRef.current) setNotas(data || []);
    } catch (e) { console.error('[Notas]', e.message); }
  }

  async function guardarNota() {
    if (!notaForm.texto.trim() || !notaForm.autor) return;
    setIsSavingNota(true);
    try {
      let comprobante_url = null;
      if (notaFile) {
        const blob     = await compressImage(notaFile, 800, 0.55);
        const fileName = `notas_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
        const upRes    = await fetch(`${supabaseUrl}/storage/v1/object/comprobantes/${fileName}`, {
          method: 'POST',
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'image/jpeg' },
          body: blob,
        });
        if (upRes.ok) comprobante_url = `${supabaseUrl}/storage/v1/object/public/comprobantes/${fileName}`;
      }
      const res = await fetch(`${supabaseUrl}/rest/v1/finanzas_notas`, {
        method: 'POST',
        headers: { ...authHeaders, Prefer: 'return=representation' },
        body: JSON.stringify({ ...notaForm, comprobante_url }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const [saved] = await res.json();
      setNotas(prev => [saved, ...prev]);
      setNotaForm({ fecha: TODAY, autor: DUENOS[0], texto: '' });
      setNotaFile(null);
      setShowNotaForm(false);
    } catch (e) { alert(`Error guardando nota: ${e.message}`); }
    finally { setIsSavingNota(false); }
  }

  function abrirEditNota(n) {
    setEditingNotaId(n.id);
    setEditNotaForm({ fecha: n.fecha, autor: n.autor, texto: n.texto });
  }

  async function guardarEditNota() {
    if (!editNotaForm.texto.trim()) return;
    setIsSavingEditNota(true);
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/finanzas_notas?id=eq.${editingNotaId}`, {
        method: 'PATCH',
        headers: { ...authHeaders, Prefer: 'return=representation' },
        body: JSON.stringify({
          fecha:  editNotaForm.fecha,
          autor:  editNotaForm.autor,
          texto:  editNotaForm.texto,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const [updated] = await res.json();
      setNotas(prev => prev.map(n => n.id === editingNotaId ? updated : n));
      setEditingNotaId(null);
    } catch (e) { alert(`Error: ${e.message}`); }
    finally { setIsSavingEditNota(false); }
  }

  async function eliminarNota(id) {
    if (!confirm('¿Eliminar esta nota?')) return;
    await fetch(`${supabaseUrl}/rest/v1/finanzas_notas?id=eq.${id}`, {
      method: 'DELETE', headers: authHeaders,
    });
    setNotas(prev => prev.filter(n => n.id !== id));
  }

  // ── Abono DIRECTO (desde DeudaCard o Row) ────────────────────────────────

  async function registrarAbono(mov, nuevoPago) {
    setIsSavingAbono(true);
    setSyncStatus('syncing');
    try {
      const nuevosPagos = [...(mov.pagos || []), nuevoPago];
      const updated = await apiUpdate(mov.id, { pagos: nuevosPagos });
      // updated tiene monto_pagado y deuda_restante calculados por el trigger
      const next = movimientos.map(m => m.id === mov.id ? updated : m);
      setMovimientos(next);
      saveLocal(next);
      setSyncStatus('ok');
      // Actualizar abonoTarget con datos frescos
      setAbonoTarget(updated);
      // Si ya está saldado, cerrar el mini modal
      if (updated.deuda_estado === 'pagado') setAbonoTarget(null);
    } catch (err) {
      console.error('[Finanzas] Error registrando abono:', err.message);
      setSyncStatus('error');
      alert(`Error al guardar el abono: ${err.message}`);
    } finally {
      setIsSavingAbono(false);
    }
  }

  // ── Modal helpers ─────────────────────────────────────────────────────────

  function openNew(tipo = 'ingreso', extraForm = {}) {
    setEditingId(null); setSelectedFiles([]);
    setNuevoPago({ ...EMPTY_PAGO });
    setForm({ ...EMPTY_FORM, tipo, categoria: CATEGORIAS[tipo][0], ...extraForm });
    setShowModal(true);
  }

  function openEdit(m) {
    setEditingId(m.id); setSelectedFiles([]);
    setNuevoPago({ ...EMPTY_PAGO, cobrador: m.cobrador || '' });
    setForm({ ...EMPTY_FORM, ...m, pagos: m.pagos || [], comprobantes: m.comprobantes || [] });
    setShowModal(true);
  }

  // ── Pago helpers (client-side preview en modal) ───────────────────────────

  // Suma de abonos ya confirmados en la lista
  const localMontoPagado   = useMemo(() => (form.pagos || []).reduce((a, p) => a + Number(p.monto || 0), 0), [form.pagos]);
  // Preview en tiempo real: incluye también lo que se está escribiendo en el campo de nuevo abono
  const previewMontoPagado = useMemo(() =>
    localMontoPagado + (form.tiene_deuda ? Math.max(Number(nuevoPago.monto) || 0, 0) : 0),
    [localMontoPagado, nuevoPago.monto, form.tiene_deuda]);
  const localDeudaRestante = useMemo(() => Math.max(Number(form.monto || 0) - localMontoPagado, 0), [form.monto, localMontoPagado]);
  const previewRestante    = useMemo(() => Math.max(Number(form.monto || 0) - previewMontoPagado, 0), [form.monto, previewMontoPagado]);
  const deudaCompleta      = previewRestante === 0 && Number(form.monto) > 0 && form.tiene_deuda;

  function addPago() {
    const n = Number(nuevoPago.monto);
    if (!n || n <= 0) return alert('Ingresá un monto válido.');
    if (Number(form.monto) > 0 && n > localDeudaRestante) {
      return alert(`El abono ($${fmt(n)}) no puede superar la deuda restante ($${fmt(localDeudaRestante)}).`);
    }
    const pago = { id: uid(), fecha: nuevoPago.fecha, monto: n, metodo: nuevoPago.metodo, notas: nuevoPago.notas || '', cobrador: nuevoPago.cobrador || form.cobrador || '' };
    setForm(p => ({ ...p, pagos: [...(p.pagos || []), pago] }));
    setNuevoPago({ ...EMPTY_PAGO, cobrador: form.cobrador || '' });
  }

  function removePago(pagoId) {
    setForm(p => ({ ...p, pagos: (p.pagos || []).filter(x => x.id !== pagoId) }));
    if (editingPagoId === pagoId) setEditingPagoId(null);
  }

  function abrirEditPago(p) {
    setEditingPagoId(p.id);
    setEditPagoForm({ fecha: p.fecha, monto: String(p.monto), metodo: p.metodo, cobrador: p.cobrador || '', notas: p.notas || '' });
  }

  function guardarEditPago() {
    const n = Number(editPagoForm.monto);
    if (!n || n <= 0) return alert('Ingresá un monto válido.');
    setForm(p => ({
      ...p,
      pagos: (p.pagos || []).map(x =>
        x.id === editingPagoId
          ? { ...x, fecha: editPagoForm.fecha, monto: n, metodo: editPagoForm.metodo, cobrador: editPagoForm.cobrador, notas: editPagoForm.notas }
          : x
      ),
    }));
    setEditingPagoId(null);
  }

  // ── Save modal ────────────────────────────────────────────────────────────

  async function handleSave(e) {
    e.preventDefault();
    if (!form.monto || !form.descripcion) return;
    if (selectedFiles.length + (form.comprobantes?.length || 0) > 3) return alert('Máximo 3 comprobantes.');

    setIsUploading(true);
    let finalComprobantes = [...(form.comprobantes || [])];
    for (let i = 0; i < selectedFiles.length; i++) {
      setUploadProgress(`Subiendo imagen ${i + 1} de ${selectedFiles.length}...`);
      try {
        const blob     = await compressImage(selectedFiles[i]);
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}.jpg`;
        const upRes    = await fetch(`${supabaseUrl}/storage/v1/object/comprobantes/${fileName}`, {
          method: 'POST',
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'image/jpeg' },
          body: blob,
        });
        if (!upRes.ok) throw new Error('Falló bucket');
        finalComprobantes.push(`${supabaseUrl}/storage/v1/object/public/comprobantes/${fileName}`);
      } catch (err) { console.error(err); alert(`No se pudo subir la imagen ${i + 1}.`); }
    }

    if (!isMountedRef.current) return;
    setIsUploading(false); setUploadProgress('');

    // Si hay un abono pendiente en el campo, lo incluimos automáticamente al guardar
    let pagosFinales = form.tiene_deuda ? (form.pagos || []) : [];
    if (form.tiene_deuda && nuevoPago.monto && Number(nuevoPago.monto) > 0) {
      pagosFinales = [...pagosFinales, {
        id:      uid(),
        fecha:   nuevoPago.fecha,
        monto:   Number(nuevoPago.monto),
        metodo:  nuevoPago.metodo,
        notas:   nuevoPago.notas || '',
        cobrador: nuevoPago.cobrador || form.cobrador || '',
      }];
    }

    // Construir alumno_data solo si es Matrícula y hay email (campo mínimo requerido)
    const esMatricula = form.tipo === 'ingreso' && form.categoria === 'Matrícula';
    const alumnoDataPayload = esMatricula && form.alumno_data?.email
      ? {
          nombre:   form.alumno_data.nombre   || '',
          apellido: form.alumno_data.apellido  || '',
          email:    form.alumno_data.email     || '',
          telefono: form.alumno_data.telefono  || '',
          cursada:  form.alumno_data.cursada   || 'Cursada 1',
        }
      : null;

    const payload = {
      tipo:         form.tipo,
      categoria:    form.categoria,
      descripcion:  form.descripcion,
      monto:        Number(form.monto),
      fecha:        form.fecha,
      metodo:       form.metodo || 'Transferencia bancaria',
      cobrador:     form.cobrador  || null,
      beneficiario: form.beneficiario || null,
      notas:        form.notas    || null,
      tiene_deuda:  Boolean(form.tiene_deuda),
      pagos:        pagosFinales,
      comprobantes: finalComprobantes,
      alumno_data:  alumnoDataPayload,
      // monto_pagado, deuda_restante, deuda_estado ← calculados por trigger
    };

    setSyncStatus('syncing');
    try {
      let savedRow;
      if (editingId) {
        savedRow    = await apiUpdate(editingId, payload);
        const next  = movimientos.map(m => m.id === editingId ? savedRow : m);
        setMovimientos(next); saveLocal(next);
      } else {
        savedRow    = await apiInsert(payload);
        const next  = [savedRow, ...movimientos];
        setMovimientos(next); saveLocal(next);
      }
      setSyncStatus('ok');
      setShowModal(false); setEditingId(null); setSelectedFiles([]);
    } catch (err) {
      console.error('[Finanzas] Error guardando:', err.message);
      setSyncStatus('error');
      alert(`No se pudo guardar: ${err.message}\n\nAsegurate de haber ejecutado el SQL 11_fix_finanzas_trigger.sql en Supabase.`);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este movimiento?')) return;
    setSyncStatus('syncing');
    try {
      await apiDelete(id);
      const next = movimientos.filter(m => m.id !== id);
      setMovimientos(next); saveLocal(next); setSyncStatus('ok');
    } catch (err) { console.error(err); setSyncStatus('error'); }
    setShowModal(false);
  }

  // ── Derived stats ─────────────────────────────────────────────────────────

  // monto_pagado viene del trigger. Si no existe (columna no creada), usa fallback.
  const ingresosRecibidos = useMemo(() =>
    movimientos.filter(m => m.tipo === 'ingreso')
      .reduce((a, b) => a + Number(b.tiene_deuda ? (b.monto_pagado ?? 0) : (b.monto_pagado ?? b.monto ?? 0)), 0),
    [movimientos]);

  const egresosRealizados = useMemo(() =>
    movimientos.filter(m => m.tipo === 'egreso')
      .reduce((a, b) => a + Number(b.tiene_deuda ? (b.monto_pagado ?? 0) : (b.monto_pagado ?? b.monto ?? 0)), 0),
    [movimientos]);

  const balance = ingresosRecibidos - egresosRealizados;

  const meDeben = useMemo(() =>
    movimientos.filter(m => m.tiene_deuda && m.tipo === 'ingreso' && m.deuda_estado !== 'pagado'),
    [movimientos]);
  const lesDebo = useMemo(() =>
    movimientos.filter(m => m.tiene_deuda && m.tipo === 'egreso' && m.deuda_estado !== 'pagado'),
    [movimientos]);

  const totalMeDeben = useMemo(() => meDeben.reduce((a, b) => a + Number(b.deuda_restante ?? b.monto ?? 0), 0), [meDeben]);
  const totalLesDebo = useMemo(() => lesDebo.reduce((a, b) => a + Number(b.deuda_restante ?? b.monto ?? 0), 0), [lesDebo]);

  const todasDeudas = useMemo(() =>
    movimientos.filter(m => m.tiene_deuda).sort((a, b) => {
      if (a.deuda_estado === 'pagado' && b.deuda_estado !== 'pagado') return 1;
      if (a.deuda_estado !== 'pagado' && b.deuda_estado === 'pagado') return -1;
      return (b.fecha ?? '').localeCompare(a.fecha ?? '');
    }), [movimientos]);

  const meses = useMemo(() => {
    const s = new Set(movimientos.map(m => m.fecha?.slice(0, 7)).filter(Boolean));
    return [...s].sort().reverse();
  }, [movimientos]);

  const cursadasDisponibles = useMemo(() => {
    const s = new Set();
    // Cursada 1 implícita: matrículas sin alumno_data (anteriores al sistema)
    const hayAntiguas = movimientos.some(
      m => m.categoria === 'Matrícula' && m.tipo === 'ingreso' && !m.alumno_data?.cursada
    );
    if (hayAntiguas) s.add('Cursada 1');
    // Cursadas explícitas: normalizadas desde alumno_data
    movimientos
      .filter(m => m.categoria === 'Matrícula' && m.alumno_data?.cursada)
      .forEach(m => { const c = normalizarCursada(m.alumno_data.cursada); if (c) s.add(c); });
    return [...s].sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, '')) || 0;
      const nb = parseInt(b.replace(/\D/g, '')) || 0;
      return na - nb;
    });
  }, [movimientos]);

  const filtered = useMemo(() => {
    let list = movimientos;
    if (filterTipo !== 'todos')      list = list.filter(m => m.tipo === filterTipo);
    if (filterMes)                   list = list.filter(m => m.fecha?.slice(0, 7) === filterMes);
    if (filterDeuda === 'deuda')     list = list.filter(m => m.tiene_deuda);
    if (filterDeuda === 'sin_deuda') list = list.filter(m => !m.tiene_deuda);
    if (filterCobrador) list = list.filter(m => movMatchesCobrador(m, filterCobrador));
    if (filterCursada) list = list.filter(m => {
      if (m.categoria !== 'Matrícula' || m.tipo !== 'ingreso') return true;
      const c = normalizarCursada(m.alumno_data?.cursada) || 'Cursada 1';
      return c === filterCursada;
    });
    if (filterFechaDesde) list = list.filter(m => m.fecha >= filterFechaDesde);
    if (filterFechaHasta) list = list.filter(m => m.fecha <= filterFechaHasta);
    if (search) list = list.filter(m =>
      [m.descripcion, m.categoria, m.notas, m.beneficiario, m.cobrador].join(' ').toLowerCase().includes(search.toLowerCase())
    );
    return list.sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''));
  }, [movimientos, filterTipo, filterMes, filterDeuda, filterCobrador, filterCursada, filterFechaDesde, filterFechaHasta, search]);

  const filteredIngresos = useMemo(() =>
    filtered.filter(m => m.tipo === 'ingreso').reduce((a, m) =>
      a + (filterCobrador ? montoDeCobradorEnMov(m, filterCobrador) : Number(m.tiene_deuda ? (m.monto_pagado ?? 0) : (m.monto_pagado ?? m.monto ?? 0)))
    , 0),
    [filtered, filterCobrador]);

  const filteredEgresos = useMemo(() =>
    filtered.filter(m => m.tipo === 'egreso').reduce((a, m) =>
      a + (filterCobrador ? montoDeCobradorEnMov(m, filterCobrador) : Number(m.tiene_deuda ? (m.monto_pagado ?? 0) : (m.monto_pagado ?? m.monto ?? 0)))
    , 0),
    [filtered, filterCobrador]);

  const filteredBalance = filteredIngresos - filteredEgresos;

  const catBreakdown = useMemo(() => {
    const map = {};
    movimientos.filter(m => m.tipo === 'egreso').forEach(m => { map[m.categoria] = (map[m.categoria] || 0) + Number(m.monto || 0); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [movimientos]);

  const porCobrador = useMemo(() => distribuirPorCobrador(movimientos), [movimientos]);

  function exportCSV() {
    const blob = new Blob([toCSV(filtered)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'finanzas.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const pendientesCount = meDeben.length + lesDebo.length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Mini modal abono rápido */}
      {abonoTarget && (
        <QuickAbonoModal
          mov={abonoTarget}
          onClose={() => setAbonoTarget(null)}
          onSave={registrarAbono}
          isSaving={isSavingAbono}
        />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-headline text-2xl font-bold">Finanzas</h2>
          <p className="text-on-surface-variant text-sm flex items-center gap-1.5">
            Ingresos y egresos de tu negocio
            {syncStatus !== 'idle' && (
              <span title={syncStatus === 'syncing' ? 'Sincronizando...' : syncStatus === 'error' ? 'Error al guardar.' : 'Datos a salvo en la nube'}
                className={`material-symbols-outlined text-[14px] ${syncStatus === 'syncing' ? 'text-primary animate-pulse' : syncStatus === 'error' ? 'text-error animate-bounce' : 'text-green-500'}`}>
                {syncStatus === 'syncing' ? 'cloud_sync' : syncStatus === 'error' ? 'cloud_off' : 'cloud_done'}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3">
            <span className="material-symbols-outlined text-sm">download</span>CSV
          </button>
          <button onClick={() => openNew('egreso')} className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3">
            <span className="material-symbols-outlined text-sm">trending_down</span>Gasto
          </button>
          <button onClick={() => openNew('ingreso')} className="btn-primary flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">add</span>Ingreso
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="flex flex-wrap gap-4">
        <SummaryCard label="Cobrado" value={ingresosRecibidos} icon="trending_up"
          colorClass="text-secondary" borderClass="border-secondary/30" sub="Dinero efectivamente recibido" />
        <SummaryCard label="Pagado" value={egresosRealizados} icon="trending_down"
          colorClass="text-error" borderClass="border-error/30" sub="Dinero efectivamente salido" />
        <SummaryCard label={balance >= 0 ? 'Ganancia' : 'Pérdida'} value={balance}
          icon="account_balance_wallet" colorClass={balance >= 0 ? 'text-primary' : 'text-error'}
          borderClass={balance >= 0 ? 'border-primary/30' : 'border-error/30'} sub="Cobrado − Pagado" />
        <SummaryCard label="Me deben" value={totalMeDeben} icon="arrow_downward"
          colorClass="text-amber-400" borderClass="border-amber-500/30"
          sub={`${meDeben.length} cobro(s) pendiente(s)`} />
        <SummaryCard label="Les debo" value={totalLesDebo} icon="arrow_upward"
          colorClass="text-error" borderClass="border-error/30"
          sub={`${lesDebo.length} pago(s) pendiente(s)`} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-outline-variant/20">
        {[['movimientos', 'Movimientos'], ['deudas', 'Deudas'], ['resumen', 'Resumen'], ['notas', 'Notas']].map(([val, label]) => (
          <button key={val} onClick={() => setActiveTab(val)}
            className={`px-5 py-2.5 font-headline text-xs font-bold uppercase tracking-widest transition-all border-b-2 -mb-px ${
              activeTab === val ? 'text-primary border-primary' : 'text-on-surface-variant border-transparent hover:text-on-surface'
            }`}>
            {label}
            {val === 'deudas' && pendientesCount > 0 && (
              <span className="ml-1.5 bg-amber-500/20 text-amber-400 text-[9px] px-1.5 py-0.5 rounded-full font-black">{pendientesCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Movimientos ── */}
      {activeTab === 'movimientos' && (
        <div>
          <div className="flex flex-wrap gap-3 mb-4">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="input-field py-2 text-sm max-w-[200px]" />
            <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className="input-field py-2 text-sm max-w-[130px]">
              <option value="todos">Todos</option>
              <option value="ingreso">Ingresos</option>
              <option value="egreso">Egresos</option>
            </select>
            <select value={filterDeuda} onChange={e => setFilterDeuda(e.target.value)} className="input-field py-2 text-sm max-w-[160px]">
              <option value="todos">Con y sin deuda</option>
              <option value="deuda">Solo con deuda</option>
              <option value="sin_deuda">Sin deuda</option>
            </select>
            <select value={filterMes} onChange={e => setFilterMes(e.target.value)} className="input-field py-2 text-sm max-w-[155px]">
              <option value="">Todos los meses</option>
              {meses.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={filterCobrador} onChange={e => setFilterCobrador(e.target.value)} className="input-field py-2 text-sm max-w-[150px]">
              <option value="">Todos los cobradores</option>
              {DUENOS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            {cursadasDisponibles.length > 0 && (
              <select value={filterCursada} onChange={e => setFilterCursada(e.target.value)} className="input-field py-2 text-sm max-w-[140px]">
                <option value="">Todas las cursadas</option>
                {cursadasDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            {(filterTipo !== 'todos' || filterMes || search || filterDeuda !== 'todos' || filterCobrador || filterCursada || filterFechaDesde || filterFechaHasta) && (
              <button onClick={() => { setFilterTipo('todos'); setFilterMes(''); setSearch(''); setFilterDeuda('todos'); setFilterCobrador(''); setFilterCursada(''); setFilterFechaDesde(''); setFilterFechaHasta(''); }}
                className="text-xs text-primary hover:underline font-bold">Limpiar</button>
            )}
          </div>
          {/* Filtro por rango de fechas */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-on-surface-variant">date_range</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Rango de fechas</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-on-surface-variant">Desde</label>
              <input
                type="date"
                value={filterFechaDesde}
                onChange={e => setFilterFechaDesde(e.target.value)}
                className="input-field py-1.5 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-on-surface-variant">Hasta</label>
              <input
                type="date"
                value={filterFechaHasta}
                onChange={e => setFilterFechaHasta(e.target.value)}
                className="input-field py-1.5 text-sm"
              />
            </div>
            {(filterFechaDesde || filterFechaHasta) && (
              <button
                onClick={() => { setFilterFechaDesde(''); setFilterFechaHasta(''); }}
                className="text-xs text-on-surface-variant hover:text-error transition-colors"
                title="Quitar filtro de fecha"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>
          <div className="flex justify-end -mt-2 mb-1">
            <span className="text-xs text-on-surface-variant">{filtered.length} registros</span>
          </div>

          {/* Totales de la selección actual */}
          <div className="flex flex-wrap gap-3 mb-4 p-3 rounded-xl bg-surface-container border border-outline-variant/20">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-on-surface-variant">filter_alt</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Totales filtrados</span>
            </div>
            <div className="flex flex-wrap gap-4 ml-1">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-secondary">trending_up</span>
                <span className="text-xs text-on-surface-variant">Cobrado:</span>
                <span className="text-sm font-black text-secondary">${fmt(filteredIngresos)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-error">trending_down</span>
                <span className="text-xs text-on-surface-variant">Pagado:</span>
                <span className="text-sm font-black text-error">${fmt(filteredEgresos)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-primary">account_balance_wallet</span>
                <span className="text-xs text-on-surface-variant">Balance:</span>
                <span className={`text-sm font-black ${filteredBalance >= 0 ? 'text-primary' : 'text-error'}`}>
                  {filteredBalance >= 0 ? `+$${fmt(filteredBalance)}` : `-$${fmt(Math.abs(filteredBalance))}`}
                </span>
              </div>
            </div>
          </div>
          <div className="card border border-outline-variant/20 overflow-x-auto p-0">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl block mb-3">receipt_long</span>
                <p className="font-bold">No hay movimientos.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/20">
                    {['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Método', 'Cobrador', 'Estado', 'Monto / Progreso', ''].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(m => (
                    <Row key={m.id} m={m} onEdit={openEdit} onDelete={handleDelete} onAbono={setAbonoTarget} filterCobrador={filterCobrador} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Deudas ── */}
      {activeTab === 'deudas' && (
        <div className="space-y-8">
          {/* Me deben */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-headline font-bold text-sm uppercase tracking-widest text-amber-400 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">arrow_downward</span>Me deben
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {meDeben.length} pendiente(s) · ${fmt(totalMeDeben)} restante
                </p>
              </div>
              <button className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3"
                onClick={() => openNew('ingreso', { tiene_deuda: true })}>
                <span className="material-symbols-outlined text-sm">add</span>Nuevo
              </button>
            </div>
            {todasDeudas.filter(d => d.tipo === 'ingreso').length === 0 ? (
              <div className="card border border-outline-variant/20 py-10 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-3xl block mb-2">check_circle</span>
                <p className="font-bold text-sm">Sin cobros pendientes.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todasDeudas.filter(d => d.tipo === 'ingreso').map(d => (
                  <DeudaCard key={d.id} d={d} onAbono={setAbonoTarget} onEdit={openEdit} />
                ))}
              </div>
            )}
          </div>

          {/* Les debo */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-headline font-bold text-sm uppercase tracking-widest text-error flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">arrow_upward</span>Les debo
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {lesDebo.length} pendiente(s) · ${fmt(totalLesDebo)} restante
                </p>
              </div>
              <button className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3"
                onClick={() => openNew('egreso', { tiene_deuda: true })}>
                <span className="material-symbols-outlined text-sm">add</span>Nuevo
              </button>
            </div>
            {todasDeudas.filter(d => d.tipo === 'egreso').length === 0 ? (
              <div className="card border border-outline-variant/20 py-10 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-3xl block mb-2">check_circle</span>
                <p className="font-bold text-sm">Sin pagos pendientes.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todasDeudas.filter(d => d.tipo === 'egreso').map(d => (
                  <DeudaCard key={d.id} d={d} onAbono={setAbonoTarget} onEdit={openEdit} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Resumen ── */}
      {activeTab === 'resumen' && (
        <div className="space-y-6">

          {/* Por cobrador */}
          <div className="card border border-outline-variant/20">
            <h3 className="font-headline font-bold mb-4 uppercase text-xs tracking-widest text-on-surface-variant">Cobrado por socio</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {DUENOS.map(d => {
                const total = porCobrador[d] || 0;
                const totalGeneral = ingresosRecibidos || 1;
                return (
                  <div key={d} className="bg-surface-variant/40 rounded-xl p-4 border border-outline-variant/20">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-primary text-lg">person</span>
                      <p className="font-headline font-bold">{d}</p>
                    </div>
                    <p className="font-headline text-2xl font-black text-secondary">${fmt(total)}</p>
                    <div className="mt-2 h-1.5 bg-outline-variant/20 rounded-full overflow-hidden">
                      <div className="h-full bg-secondary/60 rounded-full transition-all" style={{ width: `${(total / totalGeneral) * 100}%` }} />
                    </div>
                    <p className="text-[10px] text-on-surface-variant mt-1">
                      {totalGeneral > 0 ? Math.round((total / totalGeneral) * 100) : 0}% del total cobrado
                    </p>
                  </div>
                );
              })}
              {(porCobrador['Sin asignar'] || 0) > 0 && (
                <div className="bg-surface-variant/40 rounded-xl p-4 border border-outline-variant/20 opacity-60">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-on-surface-variant text-lg">person_off</span>
                    <p className="font-headline font-bold text-on-surface-variant">Sin asignar</p>
                  </div>
                  <p className="font-headline text-2xl font-black text-on-surface-variant">${fmt(porCobrador['Sin asignar'])}</p>
                </div>
              )}
            </div>
          </div>

          <div className="card border border-outline-variant/20">
            <h3 className="font-headline font-bold mb-4 uppercase text-xs tracking-widest text-on-surface-variant">Por mes</h3>
            {meses.length === 0 ? <p className="text-on-surface-variant text-sm">Sin datos</p> : (
              <div className="space-y-3">
                {meses.slice(0, 6).map(mes => {
                  const mesIng = movimientos.filter(m => m.tipo === 'ingreso' && m.fecha?.slice(0, 7) === mes)
                    .reduce((a, b) => a + Number(b.tiene_deuda ? (b.monto_pagado ?? 0) : (b.monto_pagado ?? b.monto ?? 0)), 0);
                  const mesEgr = movimientos.filter(m => m.tipo === 'egreso' && m.fecha?.slice(0, 7) === mes)
                    .reduce((a, b) => a + Number(b.tiene_deuda ? (b.monto_pagado ?? 0) : (b.monto_pagado ?? b.monto ?? 0)), 0);
                  const maxVal = Math.max(ingresosRecibidos, 1);
                  return (
                    <div key={mes}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-bold">{mes}</span>
                        <span className="text-secondary">+${fmt(mesIng)}</span>
                        <span className="text-error">-${fmt(mesEgr)}</span>
                      </div>
                      <div className="h-2 bg-outline-variant/20 rounded-full overflow-hidden">
                        <div className="h-full bg-secondary/60 rounded-full" style={{ width: `${(mesIng / maxVal) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="card border border-outline-variant/20">
            <h3 className="font-headline font-bold mb-4 uppercase text-xs tracking-widest text-on-surface-variant">Egresos por categoría</h3>
            {catBreakdown.length === 0 ? <p className="text-on-surface-variant text-sm">Sin egresos</p> : (
              <div className="space-y-3">
                {catBreakdown.map(([cat, val]) => (
                  <div key={cat}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-bold">{cat}</span>
                      <span className="text-error">${fmt(val)}</span>
                    </div>
                    <div className="h-1.5 bg-outline-variant/20 rounded-full overflow-hidden">
                      <div className="h-full bg-error/50 rounded-full" style={{ width: `${(val / (egresosRealizados || 1)) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Notas ── */}
      {activeTab === 'notas' && (
        <div className="space-y-4">
          {/* Header + botón nueva nota */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-headline font-bold text-base">Notas y recordatorios</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">Anotaciones internas, ajustes de cuentas, evidencias.</p>
            </div>
            <button
              onClick={() => { setShowNotaForm(v => !v); setNotaForm({ fecha: TODAY, autor: DUENOS[0], texto: '' }); setNotaFile(null); }}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <span className="material-symbols-outlined text-sm">{showNotaForm ? 'close' : 'add'}</span>
              {showNotaForm ? 'Cancelar' : 'Nueva nota'}
            </button>
          </div>

          {/* Formulario nueva nota */}
          {showNotaForm && (
            <div className="card border border-primary/30 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Fecha</label>
                  <input
                    type="date"
                    value={notaForm.fecha}
                    onChange={e => setNotaForm(p => ({ ...p, fecha: e.target.value }))}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Quién escribe</label>
                  <select
                    value={notaForm.autor}
                    onChange={e => setNotaForm(p => ({ ...p, autor: e.target.value }))}
                    className="input-field"
                  >
                    {DUENOS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Nota / recordatorio *</label>
                <textarea
                  rows={4}
                  value={notaForm.texto}
                  onChange={e => setNotaForm(p => ({ ...p, texto: e.target.value }))}
                  className="input-field resize-none"
                  placeholder="Ej: Ajuste de caja — diferencia de $5.000 por cambio de billetes..."
                />
              </div>
              {/* Adjuntar foto */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-2">
                  Foto adjunta (opcional)
                </label>
                {notaFile ? (
                  <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-primary/30 group">
                    <img src={URL.createObjectURL(notaFile)} className="w-full h-full object-cover" alt="preview" />
                    <button
                      type="button"
                      onClick={() => setNotaFile(null)}
                      className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                ) : (
                  <label className="w-24 h-24 rounded-xl border-2 border-dashed border-outline-variant/40 flex flex-col items-center justify-center text-on-surface-variant hover:border-primary hover:text-primary cursor-pointer transition-colors">
                    <span className="material-symbols-outlined font-light">add_photo_alternate</span>
                    <span className="text-[9px] mt-1">Subir foto</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => setNotaFile(e.target.files[0] || null)} />
                  </label>
                )}
                <p className="text-[10px] text-on-surface-variant mt-1">Se comprimirá automáticamente.</p>
              </div>
              <button
                onClick={guardarNota}
                disabled={!notaForm.texto.trim() || isSavingNota}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSavingNota
                  ? <><span className="material-symbols-outlined animate-spin text-sm">sync</span> Guardando...</>
                  : <><span className="material-symbols-outlined text-sm">save</span> Guardar nota</>
                }
              </button>
            </div>
          )}

          {/* Lista de notas */}
          {notas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl mb-3">sticky_note_2</span>
              <p className="text-sm">No hay notas aún. Creá la primera.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notas.map(n => (
                <div key={n.id} className={`card border space-y-3 transition-all ${editingNotaId === n.id ? 'border-primary/40 bg-primary/3' : 'border-outline-variant/20'}`}>
                  {editingNotaId === n.id ? (
                    /* ── Modo edición ── */
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Fecha</label>
                          <input
                            type="date"
                            value={editNotaForm.fecha}
                            onChange={e => setEditNotaForm(p => ({ ...p, fecha: e.target.value }))}
                            className="input-field py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Quién</label>
                          <select
                            value={editNotaForm.autor}
                            onChange={e => setEditNotaForm(p => ({ ...p, autor: e.target.value }))}
                            className="input-field py-1.5 text-sm"
                          >
                            {DUENOS.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                      </div>
                      <textarea
                        rows={4}
                        value={editNotaForm.texto}
                        onChange={e => setEditNotaForm(p => ({ ...p, texto: e.target.value }))}
                        className="input-field resize-none text-sm w-full"
                      />
                      {n.comprobante_url && (
                        <img src={n.comprobante_url} alt="comprobante" className="rounded-xl max-h-32 object-cover border border-outline-variant/20 opacity-60" />
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={guardarEditNota}
                          disabled={isSavingEditNota || !editNotaForm.texto.trim()}
                          className="btn-primary flex-1 flex items-center justify-center gap-2 py-2 text-sm disabled:opacity-50"
                        >
                          {isSavingEditNota
                            ? <><span className="material-symbols-outlined animate-spin text-sm">sync</span>Guardando...</>
                            : <><span className="material-symbols-outlined text-sm">save</span>Guardar</>
                          }
                        </button>
                        <button
                          onClick={() => setEditingNotaId(null)}
                          className="btn-secondary px-4 py-2 text-sm"
                        >
                          Cancelar
                        </button>
                      </div>
                    </>
                  ) : (
                    /* ── Modo lectura ── */
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary uppercase tracking-widest">
                            {n.autor}
                          </span>
                          <span className="text-xs text-on-surface-variant">
                            {new Date(n.fecha + 'T12:00').toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => abrirEditNota(n)}
                            className="text-on-surface-variant hover:text-primary transition-colors p-1"
                            title="Editar nota"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                          <button
                            onClick={() => eliminarNota(n.id)}
                            className="text-on-surface-variant hover:text-error transition-colors p-1"
                            title="Eliminar nota"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{n.texto}</p>
                      {n.comprobante_url && (
                        <a href={n.comprobante_url} target="_blank" rel="noreferrer" className="block">
                          <img
                            src={n.comprobante_url}
                            alt="comprobante"
                            className="rounded-xl max-h-48 object-cover border border-outline-variant/20 hover:opacity-90 transition-opacity"
                          />
                        </a>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <form onSubmit={handleSave} className="bg-surface-container w-full max-w-lg rounded-2xl border border-outline-variant/30 overflow-auto max-h-[90vh]">

            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20 sticky top-0 bg-surface-container z-10">
              <h3 className="font-headline font-bold text-lg flex items-center gap-2">
                {editingId ? 'Editar' : 'Nuevo'} {form.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}
                {form.tiene_deuda && !deudaCompleta && (
                  <span className={`text-xs font-normal px-2 py-0.5 rounded-full ${form.tipo === 'ingreso' ? 'bg-amber-500/15 text-amber-400' : 'bg-error/15 text-error'}`}>
                    {form.tipo === 'ingreso' ? 'cobro pendiente' : 'pago pendiente'}
                  </span>
                )}
                {deudaCompleta && <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-secondary/15 text-secondary">pago completo ✓</span>}
              </h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">

              {/* Tipo */}
              {!editingId && (
                <div className="flex gap-2">
                  {[['ingreso', 'Ingreso', 'trending_up'], ['egreso', 'Gasto', 'trending_down']].map(([val, lbl, icon]) => (
                    <button key={val} type="button"
                      onClick={() => setForm(p => ({ ...p, tipo: val, categoria: CATEGORIAS[val][0] }))}
                      className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-xs font-bold uppercase tracking-wide ${
                        form.tipo === val
                          ? (val === 'ingreso' ? 'bg-secondary/10 border-secondary text-secondary' : 'bg-error/10 border-error text-error')
                          : 'border-outline-variant/20 text-on-surface-variant hover:bg-surface-variant'}`}>
                      <span className="material-symbols-outlined text-xl">{icon}</span>{lbl}
                    </button>
                  ))}
                </div>
              )}

              {/* Categoría + Fecha */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Categoría</label>
                  <select value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} className="input-field">
                    {CATEGORIAS[form.tipo].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Fecha</label>
                  <input required type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} className="input-field" />
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Descripción *</label>
                <input required value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} className="input-field" placeholder="ej: Matrícula de Ana García" />
              </div>

              {/* ── Datos del alumno (solo Matrícula) ── */}
              {form.tipo === 'ingreso' && form.categoria === 'Matrícula' && (
                <div className="rounded-xl border-2 border-primary/30 overflow-hidden">
                  <div className="px-4 py-2.5 bg-primary/8 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-primary">school</span>
                    <span className="text-xs font-bold text-primary uppercase tracking-widest">Datos del alumno</span>
                    <span className="ml-auto text-[10px] text-on-surface-variant">(para dar de alta desde Estudiantes)</span>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Nombre</label>
                        <input
                          type="text"
                          value={form.alumno_data?.nombre || ''}
                          onChange={e => {
                            const v = e.target.value;
                            setForm(p => ({
                              ...p,
                              alumno_data: { ...(p.alumno_data || {}), nombre: v },
                              descripcion: `${v}${p.alumno_data?.apellido ? ' ' + p.alumno_data.apellido : ''}`.trim(),
                            }));
                          }}
                          className="input-field py-2 text-sm"
                          placeholder="María"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Apellido</label>
                        <input
                          type="text"
                          value={form.alumno_data?.apellido || ''}
                          onChange={e => {
                            const v = e.target.value;
                            setForm(p => ({
                              ...p,
                              alumno_data: { ...(p.alumno_data || {}), apellido: v },
                              descripcion: `${p.alumno_data?.nombre || ''} ${v}`.trim(),
                            }));
                          }}
                          className="input-field py-2 text-sm"
                          placeholder="López"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Email *</label>
                      <input
                        type="email"
                        value={form.alumno_data?.email || ''}
                        onChange={e => setForm(p => ({ ...p, alumno_data: { ...(p.alumno_data || {}), email: e.target.value } }))}
                        className="input-field py-2 text-sm"
                        placeholder="maria@mail.com"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Teléfono / WhatsApp</label>
                        <input
                          type="tel"
                          value={form.alumno_data?.telefono || ''}
                          onChange={e => setForm(p => ({ ...p, alumno_data: { ...(p.alumno_data || {}), telefono: e.target.value } }))}
                          className="input-field py-2 text-sm"
                          placeholder="+54 381..."
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block mb-1">Cursada</label>
                        <input
                          type="text"
                          list="cursada-list-finanzas"
                          value={form.alumno_data?.cursada || ''}
                          onChange={e => setForm(p => ({ ...p, alumno_data: { ...(p.alumno_data || {}), cursada: e.target.value } }))}
                          onBlur={e => {
                            const v = normalizarCursada(e.target.value);
                            if (v) setForm(p => ({ ...p, alumno_data: { ...(p.alumno_data || {}), cursada: v } }));
                          }}
                          className="input-field py-2 text-sm"
                          placeholder="Cursada 1"
                        />
                        <datalist id="cursada-list-finanzas">
                          {['Cursada 1','Cursada 2','Cursada 3','Cursada 4','Cursada 5'].map(c => (
                            <option key={c} value={c} />
                          ))}
                        </datalist>
                      </div>
                    </div>
                    <p className="text-[10px] text-on-surface-variant flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">info</span>
                      El email es requerido para poder dar de alta al alumno luego.
                    </p>
                  </div>
                </div>
              )}

              {/* Monto + Método */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">
                    {form.tiene_deuda ? 'Precio total acordado (COP) *' : 'Monto (COP) *'}
                  </label>
                  <input required type="number" min="0" step="1" value={form.monto}
                    onChange={e => setForm(p => ({ ...p, monto: e.target.value }))} className="input-field" placeholder="400000" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Método</label>
                  <select value={form.metodo} onChange={e => setForm(p => ({ ...p, metodo: e.target.value }))} className="input-field">
                    {METODOS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Cobrado por */}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Cobrado por</label>
                <select value={form.cobrador || ''} onChange={e => setForm(p => ({ ...p, cobrador: e.target.value }))} className="input-field">
                  <option value="">— Sin asignar —</option>
                  {DUENOS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              {/* Estado del pago */}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Estado del pago</label>
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => setForm(p => ({ ...p, tiene_deuda: false, pagos: [] }))}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 text-sm font-bold transition-all ${
                      !form.tiene_deuda ? 'bg-secondary/10 border-secondary text-secondary' : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant/50'}`}>
                    <span className="material-symbols-outlined text-base">check_circle</span>
                    Pago completo
                  </button>
                  <button type="button"
                    onClick={() => setForm(p => ({ ...p, tiene_deuda: true }))}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 text-sm font-bold transition-all ${
                      form.tiene_deuda
                        ? form.tipo === 'ingreso'
                          ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                          : 'bg-error/10 border-error text-error'
                        : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant/50'}`}>
                    <span className="material-symbols-outlined text-base">{form.tipo === 'ingreso' ? 'arrow_downward' : 'arrow_upward'}</span>
                    {form.tipo === 'ingreso' ? 'Me deben' : 'Les debo'}
                  </button>
                </div>
              </div>

              {/* Sección deuda + abonos */}
              {form.tiene_deuda && (
                <div className={`rounded-xl border-2 overflow-hidden ${form.tipo === 'ingreso' ? 'border-amber-500/40' : 'border-error/40'}`}>
                  <div className={`px-4 py-2.5 flex items-center gap-2 ${form.tipo === 'ingreso' ? 'bg-amber-500/10' : 'bg-error/10'}`}>
                    <span className={`material-symbols-outlined text-sm ${form.tipo === 'ingreso' ? 'text-amber-400' : 'text-error'}`}>
                      {form.tipo === 'ingreso' ? 'arrow_downward' : 'arrow_upward'}
                    </span>
                    <span className={`text-xs font-bold ${form.tipo === 'ingreso' ? 'text-amber-400' : 'text-error'}`}>
                      {form.tipo === 'ingreso' ? 'Registrá los abonos a medida que te paguen' : 'Registrá los abonos a medida que pagues'}
                    </span>
                  </div>
                  <div className="p-4 space-y-4">

                    {/* Deudor / acreedor */}
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">
                        {form.tipo === 'ingreso' ? 'Deudor / Alumno' : 'Acreedor / Proveedor'}
                      </label>
                      <input value={form.beneficiario || ''}
                        onChange={e => setForm(p => ({ ...p, beneficiario: e.target.value }))}
                        className="input-field"
                        placeholder={form.tipo === 'ingreso' ? 'ej: Ana García' : 'ej: Proveedor X'} />
                    </div>

                    {/* Barra de progreso (solo si hay monto) */}
                    {Number(form.monto) > 0 ? (
                      <DebtBar
                        monto={Number(form.monto)}
                        montoPagado={previewMontoPagado}
                        deudaRestante={previewRestante}
                        tipo={form.tipo}
                      />
                    ) : (
                      <p className="text-xs text-on-surface-variant bg-surface-variant/30 rounded-lg px-3 py-2 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">info</span>
                        Ingresá el precio total para ver la barra de progreso
                      </p>
                    )}

                    {/* Abonos registrados */}
                    {(form.pagos || []).length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Abonos registrados</p>
                        {(form.pagos || []).map(p => (
                          <div key={p.id} className={`rounded-lg overflow-hidden border transition-all ${editingPagoId === p.id ? 'border-primary/40' : 'border-transparent'}`}>
                            {editingPagoId === p.id ? (
                              /* ── Modo edición del abono ── */
                              <div className="bg-surface-variant/50 p-3 space-y-2">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Editando abono</p>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-[9px] text-on-surface-variant block mb-0.5">Fecha</label>
                                    <input type="date" value={editPagoForm.fecha}
                                      onChange={e => setEditPagoForm(p => ({ ...p, fecha: e.target.value }))}
                                      className="input-field py-1 text-xs" />
                                  </div>
                                  <div>
                                    <label className="text-[9px] text-on-surface-variant block mb-0.5">Monto *</label>
                                    <input type="number" min="1" value={editPagoForm.monto}
                                      onChange={e => setEditPagoForm(p => ({ ...p, monto: e.target.value }))}
                                      className="input-field py-1 text-xs font-bold" />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-[9px] text-on-surface-variant block mb-0.5">Método</label>
                                    <select value={editPagoForm.metodo}
                                      onChange={e => setEditPagoForm(p => ({ ...p, metodo: e.target.value }))}
                                      className="input-field py-1 text-xs">
                                      {METODOS.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-[9px] text-on-surface-variant block mb-0.5">Cobrador</label>
                                    <select value={editPagoForm.cobrador}
                                      onChange={e => setEditPagoForm(p => ({ ...p, cobrador: e.target.value }))}
                                      className="input-field py-1 text-xs">
                                      <option value="">— Sin asignar —</option>
                                      {DUENOS.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                  </div>
                                </div>
                                <div className="flex gap-2 pt-1">
                                  <button type="button" onClick={guardarEditPago}
                                    className="flex-1 py-1.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 text-xs font-bold transition-colors">
                                    Guardar cambio
                                  </button>
                                  <button type="button" onClick={() => setEditingPagoId(null)}
                                    className="px-3 py-1.5 rounded-lg bg-surface-variant text-on-surface-variant text-xs font-bold hover:bg-outline-variant/30 transition-colors">
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* ── Modo lectura del abono ── */
                              <div className="flex items-center gap-2 bg-surface-variant/30 rounded-lg px-3 py-2">
                                <span className="material-symbols-outlined text-[14px] text-secondary shrink-0">check_circle</span>
                                <span className="text-xs text-on-surface-variant whitespace-nowrap">
                                  {new Date(p.fecha + 'T12:00').toLocaleDateString('es', { day: '2-digit', month: 'short', year: '2-digit' })}
                                </span>
                                <span className="font-bold text-sm">${fmt(p.monto)}</span>
                                <span className="text-xs text-on-surface-variant">{p.metodo}</span>
                                {p.cobrador && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary">{p.cobrador}</span>}
                                {p.notas && <span className="text-xs italic truncate text-on-surface-variant">{p.notas}</span>}
                                <div className="ml-auto flex items-center gap-1 shrink-0">
                                  <button type="button" onClick={() => abrirEditPago(p)}
                                    className="text-on-surface-variant hover:text-primary transition-colors p-0.5" title="Editar abono">
                                    <span className="material-symbols-outlined text-[15px]">edit</span>
                                  </button>
                                  <button type="button" onClick={() => removePago(p.id)}
                                    className="text-on-surface-variant hover:text-error transition-colors p-0.5" title="Eliminar abono">
                                    <span className="material-symbols-outlined text-[15px]">close</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Formulario agregar abono */}
                    {!deudaCompleta && (
                      <div className="border border-outline-variant/20 rounded-xl p-3 space-y-3">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm">add_circle</span>Agregar abono
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-on-surface-variant block mb-1">Fecha</label>
                            <input type="date" value={nuevoPago.fecha}
                              onChange={e => setNuevoPago(p => ({ ...p, fecha: e.target.value }))}
                              className="input-field py-1.5 text-sm" />
                          </div>
                          <div>
                            <label className="text-[10px] text-on-surface-variant block mb-1">
                              Monto{Number(form.monto) > 0 ? ` (máx $${fmt(localDeudaRestante)})` : ''}
                            </label>
                            <input type="number" min="1" step="1" placeholder="0"
                              value={nuevoPago.monto}
                              onChange={e => setNuevoPago(p => ({ ...p, monto: e.target.value }))}
                              className="input-field py-1.5 text-sm" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-on-surface-variant block mb-1">Método</label>
                            <select value={nuevoPago.metodo}
                              onChange={e => setNuevoPago(p => ({ ...p, metodo: e.target.value }))}
                              className="input-field py-1.5 text-sm">
                              {METODOS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-on-surface-variant block mb-1">Cobrador</label>
                            <select value={nuevoPago.cobrador}
                              onChange={e => setNuevoPago(p => ({ ...p, cobrador: e.target.value }))}
                              className="input-field py-1.5 text-sm">
                              <option value="">— Sin asignar —</option>
                              {DUENOS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-on-surface-variant block mb-1">Nota</label>
                          <input value={nuevoPago.notas}
                            onChange={e => setNuevoPago(p => ({ ...p, notas: e.target.value }))}
                            className="input-field py-1.5 text-sm" placeholder="ej: 1ª cuota" />
                        </div>
                        {Number(form.monto) > 0 && localDeudaRestante > 0 && (
                          <button type="button"
                            onClick={() => setNuevoPago(p => ({ ...p, monto: String(localDeudaRestante) }))}
                            className="text-xs text-primary hover:underline font-bold">
                            Pagar todo (${fmt(localDeudaRestante)})
                          </button>
                        )}
                        <button type="button" onClick={addPago}
                          className={`w-full py-2.5 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
                            form.tipo === 'ingreso'
                              ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400'
                              : 'bg-error/20 hover:bg-error/30 text-error'}`}>
                          <span className="material-symbols-outlined text-sm">add</span>Agregar abono
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notas */}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Notas (opcional)</label>
                <textarea rows={2} value={form.notas || ''} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} className="input-field resize-none" placeholder="Observaciones adicionales..." />
              </div>

              {/* Comprobantes */}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">
                  Archivos adjuntos ({(form.comprobantes?.length || 0) + selectedFiles.length} / 3)
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(form.comprobantes || []).map((url, idx) => (
                    <div key={'c_' + idx} className="relative group w-16 h-16 rounded overflow-hidden border border-outline-variant/30">
                      <img src={url} className="w-full h-full object-cover" alt="comprobante" />
                      <a href={url} target="_blank" rel="noreferrer" className="absolute top-1 left-1 bg-black/60 text-white rounded p-0.5 text-[10px] z-10">ver</a>
                      <button type="button" onClick={() => setForm(p => ({ ...p, comprobantes: p.comprobantes.filter((_, i) => i !== idx) }))}
                        className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center">
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  ))}
                  {selectedFiles.map((f, idx) => (
                    <div key={'n_' + idx} className="relative group w-16 h-16 rounded overflow-hidden border-2 border-primary/50 opacity-70">
                      <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" alt="prev" />
                      <button type="button" disabled={isUploading} onClick={() => setSelectedFiles(p => p.filter((_, i) => i !== idx))}
                        className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center">
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                      {isUploading && <div className="absolute inset-0 flex items-center justify-center bg-black/50"><span className="material-symbols-outlined animate-spin text-white">sync</span></div>}
                    </div>
                  ))}
                  {(form.comprobantes?.length || 0) + selectedFiles.length < 3 && !isUploading && (
                    <label className="w-16 h-16 rounded border-2 border-dashed border-outline-variant/40 flex flex-col items-center justify-center text-on-surface-variant hover:border-primary hover:text-primary cursor-pointer transition-colors">
                      <span className="material-symbols-outlined font-light">add_photo_alternate</span>
                      <input type="file" multiple accept="image/*" onChange={e => {
                        const files = Array.from(e.target.files);
                        if (files.length + selectedFiles.length + (form.comprobantes?.length || 0) > 3) return alert('Máximo 3.');
                        setSelectedFiles(prev => [...prev, ...files]); e.target.value = '';
                      }} className="hidden" />
                    </label>
                  )}
                </div>
                <p className="text-[10px] text-on-surface-variant">Se comprimirán automáticamente.</p>
              </div>
            </div>

            <div className="flex gap-3 px-6 pb-6">
              {editingId && (
                <button type="button" disabled={isUploading} onClick={() => handleDelete(editingId)}
                  className="text-error hover:bg-error/10 px-3 py-2 rounded-lg disabled:opacity-50">
                  <span className="material-symbols-outlined">delete</span>
                </button>
              )}
              <button type="button" disabled={isUploading} onClick={() => setShowModal(false)} className="btn-secondary flex-1 disabled:opacity-50">Cancelar</button>
              <button type="submit" disabled={isUploading} className="btn-primary flex-1 disabled:opacity-50 flex items-center justify-center gap-2">
                {isUploading ? <><span className="material-symbols-outlined animate-spin text-sm">sync</span>{uploadProgress || 'Guardando...'}</> : editingId ? 'Guardar cambios' : `Registrar ${form.tipo}`}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
