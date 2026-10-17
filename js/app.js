/* 25C02001_DataViz_Midterm – Lê Thị Hồng Đào
 * Trực quan hoá tương tác bộ dữ liệu Urban Retail Sales – HCMC 2025.
 * Toàn bộ biểu đồ dùng chung một bộ lọc (state.filters) và vẽ lại khi bộ lọc thay đổi.
 */
(function () {
  'use strict';

  if (typeof echarts === 'undefined' || !window.SALES_DATA) {
    const main = document.querySelector('main');
    if (main) {
      const note = document.createElement('p');
      note.className = 'muted';
      note.textContent = 'Không tải được thư viện biểu đồ hoặc dữ liệu. Hãy mở trang bằng máy chủ cục bộ, kiểm tra kết nối mạng, rồi tải lại.';
      main.prepend(note);
    }
    return;
  }

  const DATA = window.SALES_DATA.map((d, i) => Object.assign({}, d, {
    idx: i,
    mi: Number(d.Date.slice(5, 7)) - 1,
    margin: d.Revenue ? d.Profit / d.Revenue * 100 : NaN,
  }));

  // ---------- Từ điển & thứ tự cố định ----------
  const MONTH_VI = ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12'];
  const STORES = ['District 1', 'District 3', 'District 7', 'Thu Duc'];
  const STORE_VI = { 'District 1': 'Quận 1', 'District 3': 'Quận 3', 'District 7': 'Quận 7', 'Thu Duc': 'Thủ Đức' };
  const STORE_LATLNG = {
    'District 1': [10.7769, 106.7009], 'District 3': [10.7843, 106.6844],
    'District 7': [10.7340, 106.7218], 'Thu Duc': [10.8494, 106.7537],
  };
  const CATS = ['Electronics', 'Fashion', 'Food & Beverage', 'Home', 'Sports'];
  const PRODUCTS = CATS.flatMap(cat =>
    [...new Set(DATA.filter(d => d.Product_Category === cat).map(d => d.Product))]
      .sort((a, b) => a.localeCompare(b, 'en')));
  const PRODUCT_CAT = {};
  DATA.forEach(d => { PRODUCT_CAT[d.Product] = d.Product_Category; });
  const CUSTS = ['Office Worker', 'Family', 'Student', 'Tourist'];
  const CUST_VI = { 'Office Worker': 'Nhân viên VP', 'Family': 'Gia đình', 'Student': 'Sinh viên', 'Tourist': 'Khách du lịch' };
  const PAYS = ['E-wallet', 'Credit Card', 'Cash', 'Bank Transfer'];
  const PAY_VI = { 'E-wallet': 'Ví điện tử', 'Credit Card': 'Thẻ tín dụng', 'Cash': 'Tiền mặt', 'Bank Transfer': 'Chuyển khoản' };
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const DAY_VI = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
  const DISCOUNTS = [0, 5, 10, 15, 20, 25, 30, 35];
  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  // ---------- Trạng thái bộ lọc ----------
  const state = {
    filters: {
      mFrom: 0, mTo: 11, store: 'all', category: 'all', customer: 'all', payment: 'all',
      weekday: 'all', discount: 'all', product: 'all',
    },
    parallelPreset: null,
  };

  function filtered(exclude) {
    const f = state.filters;
    return DATA.filter(d =>
      (exclude === 'month' || (d.mi >= f.mFrom && d.mi <= f.mTo)) &&
      (exclude === 'store' || f.store === 'all' || d.Store === f.store) &&
      (exclude === 'category' || f.category === 'all' || d.Product_Category === f.category) &&
      (exclude === 'customer' || f.customer === 'all' || d.Customer_Type === f.customer) &&
      (exclude === 'payment' || f.payment === 'all' || d.Payment_Method === f.payment) &&
      (exclude === 'weekday' || f.weekday === 'all' || d.Day_of_Week === f.weekday) &&
      (exclude === 'discount' || f.discount === 'all' || d.Discount === f.discount) &&
      (exclude === 'product' || f.product === 'all' || d.Product === f.product));
  }

  function isFullData() {
    const f = state.filters;
    return f.mFrom === 0 && f.mTo === 11 &&
      f.store === 'all' && f.category === 'all' && f.customer === 'all' && f.payment === 'all' &&
      f.weekday === 'all' && f.discount === 'all' && f.product === 'all';
  }

  function toggleFilter(key, value) {
    state.filters[key] = state.filters[key] === value ? 'all' : value;
    syncControls();
    updateAll();
  }

  // ---------- Tiện ích ----------
  const C = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const nf1 = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  const nf0 = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
  const tr = v => nf1.format(v / 1e6) + ' tr';
  const moneyLabel = v => (isFinite(v) && Math.abs(v) < 1e5) ? nf0.format(v) + ' ₫' : tr(v);
  const pct = v => (isFinite(v) ? nf1.format(v) : '–') + '%';
  const sum = (rows, k) => rows.reduce((s, d) => s + d[k], 0);
  const mean = (rows, k) => {
    const v = rows.map(d => d[k]).filter(x => x !== null && x !== undefined);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
  };
  function pearson(rows, xOf, yOf) {
    const pts = [];
    rows.forEach(d => {
      const x = xOf(d), y = yOf(d);
      if (x == null || y == null || !isFinite(x) || !isFinite(y)) return;
      pts.push([x, y]);
    });
    const n = pts.length;
    if (n < 3) return { r: NaN, n };
    const mx = pts.reduce((s, p) => s + p[0], 0) / n;
    const my = pts.reduce((s, p) => s + p[1], 0) / n;
    let num = 0, dx = 0, dy = 0;
    pts.forEach(([x, y]) => { const a = x - mx, b = y - my; num += a * b; dx += a * a; dy += b * b; });
    const den = Math.sqrt(dx * dy);
    return { r: den ? num / den : NaN, n };
  }
  const strong = s => `<strong>${esc(s)}</strong>`;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function agg(rows) {
    const rev = sum(rows, 'Revenue'), profit = sum(rows, 'Profit');
    return {
      n: rows.length, rev, profit, margin: rev ? profit / rev * 100 : NaN,
      qty: sum(rows, 'Quantity'), rating: mean(rows, 'Customer_Rating'),
      deliv: mean(rows, 'Delivery_Days'), disc: mean(rows, 'Discount'),
    };
  }
  function group(rows, key) {
    const m = new Map();
    rows.forEach(d => { const k = d[key]; if (!m.has(k)) m.set(k, []); m.get(k).push(d); });
    return m;
  }
  const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';
  const seriesColors = () => [C('--s1'), C('--s2'), C('--s3'), C('--s4'), C('--s5')];
  const catColor = cat => seriesColors()[CATS.indexOf(cat)];
  // Thang thứ bậc (ordinal) một sắc độ xanh – nhạt → đậm (sáng), đậm → sáng (tối)
  const ordinalRamp = n => {
    const light = ['#86b6ef', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#0d366b'];
    const dark = ['#184f95', '#1c5cab', '#256abf', '#2a78d6', '#3987e5', '#5598e7', '#6da7ec', '#9ec5f4'];
    const r = isDark() ? dark : light;
    if (n <= 1) return [r[r.length - 1]];
    if (n === r.length) return r;
    return Array.from({ length: n }, (_, i) => r[Math.round(i * (r.length - 1) / (n - 1))]);
  };
  // Cửa sổ trục điểm: nằm trong thang 1–5, rộng ít nhất 2,5 điểm để độ dốc không bị phóng đại
  function ratingScale(values) {
    const nums = values.filter(v => v != null && isFinite(v));
    if (!nums.length) return { min: 1, max: 5 };
    const dataLo = Math.min(...nums), dataHi = Math.max(...nums);
    let lo = dataLo - 0.5, hi = dataHi + 0.5;
    if (hi - lo < 2.5) {
      const mid = (dataLo + dataHi) / 2;
      lo = mid - 1.25;
      hi = mid + 1.25;
    }
    lo = Math.max(1, Math.floor(lo * 2) / 2);
    hi = Math.min(5, Math.ceil(hi * 2) / 2);
    if (hi - lo < 2) lo = Math.max(1, hi - 2.5);
    return { min: lo, max: hi };
  }
  // Chọn màu chữ (đậm/trắng) đủ tương phản trên nền màu của thanh
  function textOn(hex) {
    const h = hex.replace('#', '');
    const ch = [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    const lum = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
    return lum > 0.22 ? '#0b0b0b' : '#ffffff';
  }
  const payColors = () => ({ 'E-wallet': C('--s1'), 'Credit Card': C('--neutral-3'), 'Cash': C('--neutral-2'), 'Bank Transfer': C('--neutral-1') });

  // ---------- Khung ECharts dùng chung ----------
  const charts = {};
  function chart(id) {
    if (!charts[id]) charts[id] = echarts.init(document.getElementById(id), null, { renderer: 'canvas' });
    return charts[id];
  }
  function base() {
    return {
      animationDuration: 450,
      textStyle: { fontFamily: FONT, color: C('--text-2') },
      tooltip: {
        confine: true,
        backgroundColor: C('--surface'), borderColor: C('--border'), borderWidth: 1,
        textStyle: { color: C('--text'), fontSize: 13, fontFamily: FONT },
        extraCssText: 'border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.14);',
      },
      grid: { left: 8, right: 18, top: 40, bottom: 8, containLabel: true },
    };
  }
  const legendBase = extra => Object.assign({
    top: 0, left: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 8, itemGap: 14,
    textStyle: { color: C('--text-2'), fontSize: 12 }, inactiveColor: C('--neutral-1'),
  }, extra || {});
  const valAxis = extra => Object.assign({
    type: 'value', axisLine: { show: false }, axisTick: { show: false },
    axisLabel: { color: C('--muted'), fontSize: 11 }, splitLine: { lineStyle: { color: C('--grid') } },
    nameTextStyle: { color: C('--muted'), fontSize: 11 },
  }, extra || {});
  const catAxis = (data, extra) => Object.assign({
    type: 'category', data, axisLine: { lineStyle: { color: C('--axis') } }, axisTick: { show: false },
    axisLabel: { color: C('--text-2'), fontSize: 12 },
  }, extra || {});
  // Dòng tooltip: giá trị đậm đi trước, tên đi sau, khoá màu dạng vạch ngắn
  const tipRow = (color, value, label) =>
    `<div style="display:flex;align-items:center;gap:8px;margin:2px 0">` +
    (color ? `<span style="display:inline-block;width:12px;height:3px;border-radius:2px;background:${color}"></span>` : '') +
    `<b>${esc(value)}</b><span style="color:${C('--text-2')}">${esc(label)}</span></div>`;
  const tipTitle = t => `<div style="font-weight:600;margin-bottom:4px">${esc(t)}</div>`;
  const dimmed = (selected, key) => selected !== 'all' && selected !== key ? 0.3 : 1;

  // =====================================================================
  // KPI
  // =====================================================================
  function renderKpis() {
    const rows = filtered(), a = agg(rows), all = agg(DATA);
    const items = [
      ['Doanh thu', tr(a.rev), `${pct(a.rev / all.rev * 100)} tổng cả năm`],
      ['Lợi nhuận', tr(a.profit), `${pct(a.profit / all.profit * 100)} tổng cả năm`],
      ['Biên lợi nhuận', pct(a.margin), `Toàn chuỗi: ${pct(all.margin)}`],
      ['Số giao dịch', nf0.format(a.n), `${nf0.format(a.qty)} đơn vị hàng đã bán`],
      ['Giảm giá TB', pct(a.disc), `Toàn chuỗi: ${pct(all.disc)}`],
      ['Điểm đánh giá TB', isFinite(a.rating) ? nf2.format(a.rating) + ' / 5' : '–', `Toàn chuỗi: ${nf2.format(all.rating)}`],
      ['Ngày giao TB', isFinite(a.deliv) ? nf2.format(a.deliv) + ' ngày' : '–', `Toàn chuỗi: ${nf2.format(all.deliv)}`],
    ];
    const box = document.getElementById('kpis');
    box.replaceChildren(...items.map(([l, v, s]) => {
      const el = document.createElement('div'); el.className = 'kpi';
      const a1 = document.createElement('div'); a1.className = 'k-label'; a1.textContent = l;
      const a2 = document.createElement('div'); a2.className = 'k-value'; a2.textContent = v;
      const a3 = document.createElement('div'); a3.className = 'k-sub'; a3.textContent = s;
      el.append(a1, a2, a3); return el;
    }));
    document.getElementById('filterCount').textContent = `Đang hiển thị ${a.n}/${DATA.length} giao dịch`;
  }

  // =====================================================================
  // Bản đồ chi nhánh (Leaflet)
  // =====================================================================
  let map, tileLayer, markerLayer;
  function renderMap() {
    if (typeof L === 'undefined') {
      const box = document.getElementById('map');
      if (box) box.textContent = 'Không tải được bản đồ. Hãy kiểm tra kết nối mạng rồi tải lại trang.';
      return;
    }
    if (!map) {
      map = L.map('map', { scrollWheelZoom: false, attributionControl: true });
      markerLayer = L.layerGroup().addTo(map);
      map.fitBounds(Object.values(STORE_LATLNG), { padding: [30, 30] });
    }
    if (!tileLayer) {
      tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
    }
    markerLayer.clearLayers();
    const rows = filtered('store'), chain = agg(rows), g = group(rows, 'Store');
    const maxRev = Math.max(1, ...STORES.map(s => agg(g.get(s) || []).rev));
    STORES.forEach(s => {
      const a = agg(g.get(s) || []);
      const below = a.margin < chain.margin;
      const color = below ? C('--s2') : C('--s1');
      const sel = state.filters.store;
      const m = L.circleMarker(STORE_LATLNG[s], {
        radius: 7 + 15 * Math.sqrt(a.rev / maxRev), color: C('--surface'), weight: 2,
        fillColor: color, fillOpacity: sel === 'all' || sel === s ? 0.85 : 0.25,
      });
      const dir = { 'District 1': 'right', 'District 3': 'left', 'District 7': 'bottom', 'Thu Duc': 'top' }[s];
      m.bindTooltip(STORE_VI[s], { permanent: true, direction: dir, offset: dir === 'right' ? [14, 0] : dir === 'left' ? [-14, 0] : dir === 'top' ? [0, -12] : [0, 12] });
      const html = `<b>${esc(STORE_VI[s])}</b><br>Doanh thu: <b>${tr(a.rev)}</b><br>Lợi nhuận: <b>${tr(a.profit)}</b>` +
        `<br>Biên LN: <b>${pct(a.margin)}</b> ${below ? '(dưới TB chuỗi)' : '(trên TB chuỗi)'}` +
        `<br>Giao dịch: ${a.n} · Điểm TB: ${isFinite(a.rating) ? nf2.format(a.rating) : '–'}` +
        `<br>Ngày giao TB: ${isFinite(a.deliv) ? nf2.format(a.deliv) : '–'}<br><i>Nhấn để lọc theo chi nhánh</i>`;
      m.on('mouseover', () => m.openPopup()).bindPopup(html, { autoPan: false });
      m.on('click', () => toggleFilter('store', s));
      markerLayer.addLayer(m);
    });
    const leg = document.getElementById('mapLegend');
    leg.replaceChildren();
    [[C('--s1'), `Biên LN ≥ TB chuỗi (${pct(chain.margin)})`], [C('--s2'), 'Biên LN dưới TB chuỗi']].forEach(([c, t]) => {
      const span = document.createElement('span'); const i = document.createElement('i');
      i.style.background = c; span.append(i, document.createTextNode(t)); leg.append(span);
    });
  }

  // =====================================================================
  // Cột chồng lồng: doanh thu (nhạt) bao lợi nhuận (đậm)
  // =====================================================================
  function revenueProfitBars(id, keys, labels, rows, field, filterKey) {
    const g = group(rows, field), sel = state.filters[filterKey];
    const stats = keys.map(k => agg(g.get(k) || []));
    const light = C('--seq1'), darkC = C('--s1');
    const c = chart(id);
    c.setOption(Object.assign(base(), {
      legend: legendBase({ data: ['Doanh thu', 'Lợi nhuận'] }),
      grid: { left: 8, right: 18, top: 60, bottom: 8, containLabel: true },
      tooltip: Object.assign(base().tooltip, {
        trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: C('--grid'), opacity: 0.4 } },
        formatter: ps => {
          const i = ps[0].dataIndex, a = stats[i];
          return tipTitle(labels[i]) + tipRow(light, tr(a.rev), 'Doanh thu') + tipRow(darkC, tr(a.profit), 'Lợi nhuận') +
            tipRow(null, pct(a.margin), 'Biên lợi nhuận') + tipRow(null, a.n, 'giao dịch') +
            `<div style="color:${C('--muted')};font-size:12px;margin-top:4px">Nhấn để lọc</div>`;
        },
      }),
      xAxis: catAxis(labels, { axisLabel: { color: C('--text-2'), fontSize: 12, interval: 0, hideOverlap: false, width: 90, overflow: 'break' } }),
      yAxis: valAxis({ name: 'triệu ₫', axisLabel: { color: C('--muted'), fontSize: 11, formatter: v => nf0.format(v / 1e6) } }),
      series: [
        {
          name: 'Doanh thu', type: 'bar', barWidth: '52%', z: 1,
          itemStyle: { color: light, borderRadius: [4, 4, 0, 0] },
          data: stats.map((a, i) => ({ value: a.rev, itemStyle: { opacity: dimmed(sel, keys[i]) } })),
          label: {
            show: true, position: 'top', color: C('--text'), fontWeight: 600, fontSize: 12,
            formatter: p => 'Biên ' + pct(stats[p.dataIndex].margin),
          },
        },
        {
          name: 'Lợi nhuận', type: 'bar', barWidth: '52%', barGap: '-100%', z: 2,
          itemStyle: { color: darkC, borderRadius: [4, 4, 0, 0] },
          data: stats.map((a, i) => ({ value: a.profit, itemStyle: { opacity: dimmed(sel, keys[i]) } })),
        },
      ],
    }), true);
    c.off('click');
    c.on('click', p => toggleFilter(filterKey, keys[p.dataIndex]));
    c.getZr().off('click');
    c.getZr().on('click', e => {
      // nhấn vào vùng trống của cột (ngoài thanh) vẫn lọc được
      if (e.target) return;
      const pt = [e.offsetX, e.offsetY];
      if (!c.containPixel('grid', pt)) return;
      const i = c.convertFromPixel({ seriesIndex: 0 }, pt)[0];
      if (i >= 0 && i < keys.length) toggleFilter(filterKey, keys[i]);
    });
  }

  function renderStoreBars() {
    revenueProfitBars('cStore', STORES, STORES.map(s => STORE_VI[s]), filtered('store'), 'Store', 'store');
  }
  function renderCategoryBars() {
    revenueProfitBars('cCategory', CATS, CATS, filtered('category'), 'Product_Category', 'category');
  }

  // Biên lợi nhuận từng sản phẩm – thanh ngang, tô màu theo nhóm hàng
  function renderProducts() {
    const rows = filtered('product'), g = group(rows, 'Product'), total = agg(rows);
    const selProd = state.filters.product;
    const prods = [...g.entries()].map(([p, rs]) => Object.assign({ p, cat: rs[0].Product_Category }, agg(rs)))
      .sort((a, b) => a.margin - b.margin);
    const names = prods.map(d => d.p);
    const c = chart('cProduct');
    const series = CATS.map(cat => ({
      name: cat, type: 'bar', stack: 'p', barWidth: '62%',
      itemStyle: { color: catColor(cat), borderRadius: [0, 4, 4, 0] },
      data: prods.map(d => d.cat === cat ? {
        value: d.margin,
        itemStyle: { opacity: selProd === 'all' || selProd === d.p ? 1 : 0.28 },
      } : null),
    }));
    series.push({
      name: 'avg', type: 'line', data: [], silent: true,
      markLine: {
        symbol: 'none', silent: true, lineStyle: { color: C('--text-2'), width: 1, type: 'solid' },
        label: { formatter: 'TB ' + pct(total.margin), color: C('--text'), fontSize: 11, fontWeight: 600, position: 'end', rotate: 0 },
        data: [{ xAxis: total.margin }],
      },
    });
    c.setOption(Object.assign(base(), {
      legend: legendBase({ data: CATS }),
      grid: { left: 8, right: 40, top: 48, bottom: 8, containLabel: true },
      tooltip: Object.assign(base().tooltip, {
        trigger: 'item',
        formatter: p => {
          const d = prods[p.dataIndex];
          return tipTitle(d.p) + tipRow(catColor(d.cat), pct(d.margin), 'Biên lợi nhuận') +
            tipRow(null, tr(d.rev), 'Doanh thu') + tipRow(null, tr(d.profit), 'Lợi nhuận') +
            tipRow(null, d.n, 'giao dịch · ' + d.cat);
        },
      }),
      yAxis: catAxis(names, { axisLabel: { color: C('--text-2'), fontSize: 11 } }),
      xAxis: valAxis({ name: '%', axisLabel: { color: C('--muted'), fontSize: 11, formatter: '{value}%' } }),
      series,
    }), true);
    c.off('click');
    c.on('click', p => {
      if (!p || p.seriesName === 'avg' || p.dataIndex == null) return;
      const d = prods[p.dataIndex];
      if (!d || d.cat !== p.seriesName || p.value == null) return;
      toggleFilter('product', d.p);
    });
  }

  // =====================================================================
  // Nhận định 2 – Cơ cấu doanh thu theo chi nhánh
  // =====================================================================
  function renderMix() {
    const rows = filtered('store'), gs = group(rows, 'Store'), sel = state.filters.store, chain = agg(rows);
    const shares = STORES.map(s => {
      const rs = gs.get(s) || [], tot = sum(rs, 'Revenue'), gc = group(rs, 'Product_Category');
      return CATS.map(cat => { const r = sum(gc.get(cat) || [], 'Revenue'); return { rev: r, share: tot ? r / tot * 100 : 0 }; });
    });
    const c = chart('cMix');
    c.setOption(Object.assign(base(), {
      legend: legendBase({ data: CATS }),
      grid: { left: 8, right: 18, top: 48, bottom: 8, containLabel: true },
      tooltip: Object.assign(base().tooltip, {
        trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: C('--grid'), opacity: 0.4 } },
        formatter: ps => tipTitle(STORE_VI[STORES[ps[0].dataIndex]]) +
          ps.map(p => tipRow(p.color, pct(p.value), `${p.seriesName} · ${tr(shares[p.dataIndex][CATS.indexOf(p.seriesName)].rev)}`)).join(''),
      }),
      yAxis: catAxis(STORES.map(s => STORE_VI[s]), { inverse: true }),
      xAxis: valAxis({ max: 100, axisLabel: { color: C('--muted'), fontSize: 11, formatter: '{value}%' } }),
      series: CATS.map((cat, ci) => ({
        name: cat, type: 'bar', stack: 'mix', barWidth: '58%',
        itemStyle: { color: catColor(cat), borderColor: C('--surface'), borderWidth: 1 },
        emphasis: { focus: 'series' },
        label: {
          show: true, color: textOn(catColor(cat)), fontSize: 11, fontWeight: 600,
          formatter: p => p.value >= 9 ? nf0.format(p.value) + '%' : '',
        },
        data: shares.map((sh, si) => ({ value: +sh[ci].share.toFixed(1), itemStyle: { opacity: dimmed(sel, STORES[si]) } })),
      })),
    }), true);
    c.off('click');
    c.on('click', p => toggleFilter('store', STORES[p.dataIndex]));

    // Bong bóng: tỷ trọng Electronics vs biên LN
    const pts = STORES.map((s, si) => {
      const a = agg(gs.get(s) || []);
      return { s, a, elec: shares[si][0].share };
    }).filter(d => d.a.n > 0);
    const maxRev = Math.max(1, ...pts.map(d => d.a.rev));
    const c2 = chart('cMixScatter');
    c2.setOption(Object.assign(base(), {
      grid: { left: 8, right: 70, top: 36, bottom: 30, containLabel: true },
      tooltip: Object.assign(base().tooltip, {
        trigger: 'item',
        formatter: p => {
          const d = pts[p.dataIndex];
          return tipTitle(STORE_VI[d.s]) + tipRow(null, pct(d.elec), 'doanh thu từ Electronics') +
            tipRow(null, pct(d.a.margin), 'Biên lợi nhuận') + tipRow(null, tr(d.a.rev), 'Doanh thu');
        },
      }),
      xAxis: valAxis({
        name: 'Tỷ trọng Electronics trong doanh thu (%)', nameLocation: 'middle', nameGap: 28,
        scale: true, axisLabel: { color: C('--muted'), fontSize: 11, formatter: '{value}%' },
      }),
      yAxis: valAxis({
        name: 'Biên LN (%)', scale: true,
        axisLabel: { color: C('--muted'), fontSize: 11, formatter: '{value}%' },
      }),
      series: [{
        type: 'scatter',
        data: pts.map(d => ({
          value: [+d.elec.toFixed(1), +d.a.margin.toFixed(1)],
          symbolSize: 18 + 34 * Math.sqrt(d.a.rev / maxRev),
          itemStyle: { color: d.a.margin < chain.margin ? C('--s2') : C('--s1'), opacity: dimmed(sel, d.s) * 0.85, borderColor: C('--surface'), borderWidth: 2 },
        })),
        label: {
          show: true, position: 'right', distance: 10, color: C('--text'), fontSize: 12, fontWeight: 600,
          formatter: p => STORE_VI[pts[p.dataIndex].s],
        },
        labelLayout: { hideOverlap: false, moveOverlap: 'shiftY' },
      }],
    }), true);
    c2.off('click');
    c2.on('click', p => toggleFilter('store', pts[p.dataIndex].s));
  }

  // =====================================================================
  // Nhận định 3 – Giảm giá vs lợi nhuận
  // =====================================================================
  function renderDiscount() {
    const rows = filtered('discount');
    const selDisc = state.filters.discount;
    // jitter cố định theo chỉ số dòng để các điểm cùng mức giảm giá không chồng lên nhau
    const jitter = d => ((d.idx * 37) % 11 - 5) * 0.32;
    const pos = rows.filter(d => d.Profit >= 0), neg = rows.filter(d => d.Profit < 0);
    const pointOpacity = d => (selDisc === 'all' || d.Discount === selDisc ? 0.75 : 0.12);
    const toPt = d => ({
      value: [d.Discount + jitter(d), +d.margin.toFixed(2), d.idx],
      itemStyle: { opacity: pointOpacity(d) },
    });
    const c = chart('cDiscScatter');
    c.setOption(Object.assign(base(), {
      legend: legendBase({ data: ['Có lãi', 'Bị lỗ'] }),
      grid: { left: 8, right: 18, top: 60, bottom: 30, containLabel: true },
      tooltip: Object.assign(base().tooltip, {
        trigger: 'item',
        formatter: p => {
          const d = DATA[p.value[2]];
          return tipTitle(`${d.Transaction_ID} · ${d.Product}`) +
            tipRow(p.color, pct(d.margin), 'Biên lợi nhuận') + tipRow(null, d.Discount + '%', 'Giảm giá') +
            tipRow(null, tr(d.Profit), 'Lợi nhuận') +
            tipRow(null, `${STORE_VI[d.Store]} · ${d.Product_Category}`, '') +
            tipRow(null, d.Customer_Rating === null ? '–' : d.Customer_Rating, 'điểm đánh giá');
        },
      }),
      brush: {
        toolbox: ['rect', 'clear'], xAxisIndex: 0, throttleType: 'debounce', throttleDelay: 150,
        brushStyle: { borderWidth: 1, color: 'rgba(42,120,214,0.10)', borderColor: C('--s1') },
        outOfBrush: { colorAlpha: 0.15 },
      },
      toolbox: { right: 8, top: 0, itemSize: 14, iconStyle: { borderColor: C('--muted') }, feature: { brush: { title: { rect: 'Chọn vùng', clear: 'Bỏ chọn' } } } },
      xAxis: valAxis({
        name: 'Mức giảm giá (%)', nameLocation: 'middle', nameGap: 28, min: -3, max: 38, interval: 5,
        axisLabel: { color: C('--muted'), fontSize: 11, formatter: v => v < 0 ? '' : v + '%' },
      }),
      yAxis: valAxis({ name: 'Biên LN (%)', axisLabel: { color: C('--muted'), fontSize: 11, formatter: '{value}%' } }),
      series: [
        {
          name: 'Có lãi', type: 'scatter', symbolSize: 9, data: pos.map(toPt),
          itemStyle: { color: C('--s1'), borderColor: C('--surface'), borderWidth: 1 },
          markLine: {
            symbol: 'none', silent: true, lineStyle: { color: C('--axis'), width: 1, type: 'solid' },
            label: { show: false }, data: [{ yAxis: 0 }],
          },
        },
        {
          name: 'Bị lỗ', type: 'scatter', symbol: 'diamond', symbolSize: 14, data: neg.map(toPt),
          itemStyle: { color: C('--critical'), borderColor: C('--surface'), borderWidth: 1.5 },
        },
      ],
    }), true);
    c.dispatchAction({ type: 'takeGlobalCursor', key: 'brush', brushOption: { brushType: 'rect', brushMode: 'single' } });
    c.off('brushSelected');
    c.on('brushSelected', params => {
      const sel = [];
      (params.batch[0] ? params.batch[0].selected : []).forEach(s => {
        const src = s.seriesIndex === 0 ? pos : neg;
        s.dataIndex.forEach(i => sel.push(src[i]));
      });
      const info = document.getElementById('brushInfo');
      if (!sel.length) { info.textContent = 'Chưa chọn vùng nào. Hãy kéo chọn một vùng điểm để xem thống kê.'; return; }
      const a = agg(sel);
      info.textContent = `Đã chọn ${a.n} giao dịch · giảm giá TB ${pct(a.disc)} · biên LN ${pct(a.margin)} · ` +
        `lợi nhuận ${tr(a.profit)} · ${sel.filter(d => d.Profit < 0).length} giao dịch lỗ · điểm TB ${isFinite(a.rating) ? nf2.format(a.rating) : '–'}`;
    });
    document.getElementById('brushInfo').textContent = 'Chưa chọn vùng nào. Hãy kéo chọn một vùng điểm để xem thống kê.';

    // Thanh: biên LN theo mức giảm giá
    const g = group(rows, 'Discount');
    const stats = DISCOUNTS.map(d => agg(g.get(d) || []));
    const ramp = ordinalRamp(DISCOUNTS.length);
    const c2 = chart('cDiscBar');
    c2.setOption(Object.assign(base(), {
      grid: { left: 8, right: 18, top: 30, bottom: 30, containLabel: true },
      tooltip: Object.assign(base().tooltip, {
        trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: C('--grid'), opacity: 0.4 } },
        formatter: ps => {
          const i = ps[0].dataIndex, a = stats[i];
          return tipTitle('Giảm giá ' + DISCOUNTS[i] + '%') + tipRow(ramp[i], pct(a.margin), 'Biên lợi nhuận') +
            tipRow(null, tr(a.profit), 'Lợi nhuận') + tipRow(null, a.n, 'giao dịch') +
            tipRow(null, isFinite(a.rating) ? nf2.format(a.rating) : '–', 'điểm đánh giá TB');
        },
      }),
      xAxis: catAxis(DISCOUNTS.map(d => d + '%'), { name: 'Mức giảm giá', nameLocation: 'middle', nameGap: 28, nameTextStyle: { color: C('--muted'), fontSize: 11 } }),
      yAxis: valAxis({ name: 'Biên LN (%)', axisLabel: { color: C('--muted'), fontSize: 11, formatter: '{value}%' } }),
      series: [{
        type: 'bar', barWidth: '60%',
        data: stats.map((a, i) => ({
          value: a.n ? +a.margin.toFixed(1) : null,
          itemStyle: {
            color: a.margin < 0 ? C('--critical') : ramp[i],
            borderRadius: a.margin < 0 ? [0, 0, 4, 4] : [4, 4, 0, 0],
            opacity: selDisc === 'all' || DISCOUNTS[i] === selDisc ? 1 : 0.3,
          },
        })),
        label: {
          show: true, position: 'top', color: C('--text-2'), fontSize: 11,
          formatter: p => p.value === null ? '' : `${pct(p.value)}\nn=${stats[p.dataIndex].n}`,
        },
        markLine: {
          symbol: 'none', silent: true, lineStyle: { color: C('--axis'), width: 1, type: 'solid' },
          label: { show: false }, data: [{ yAxis: 0 }],
        },
      }],
    }), true);
    c2.off('click');
    c2.on('click', p => { if (p.dataIndex != null) toggleFilter('discount', DISCOUNTS[p.dataIndex]); });
    c2.getZr().off('click');
    c2.getZr().on('click', e => {
      if (e.target) return;
      const pt = [e.offsetX, e.offsetY];
      if (!c2.containPixel('grid', pt)) return;
      const i = Math.round(c2.convertFromPixel({ seriesIndex: 0 }, pt)[0]);
      if (i >= 0 && i < DISCOUNTS.length) toggleFilter('discount', DISCOUNTS[i]);
    });
  }

  // =====================================================================
  // Nhận định 4 – Xu hướng theo tháng (2 biểu đồ liên kết, không dùng 2 trục y)
  // =====================================================================
  function renderMonthly() {
    const rows = filtered('month'), f = state.filters;
    const months = MONTH_VI.map((_, i) => i);
    const g = group(rows, 'mi');
    const stats = months.map(m => agg(g.get(m) || []));
    const labels = MONTH_VI.slice();
    const active = m => m >= f.mFrom && m <= f.mTo;
    const partial = f.mFrom !== 0 || f.mTo !== 11;
    const markData = [];
    if (f.mFrom <= 10 && f.mTo >= 11) {
      markData.push([
        {
          xAxis: MONTH_VI[10],
          itemStyle: { color: C('--s2'), opacity: 0.10 },
          label: { show: true, position: 'insideTop', formatter: 'Th11–Th12', color: C('--text-2'), fontSize: 11 },
        },
        { xAxis: MONTH_VI[11] },
      ]);
    }
    if (partial && !(f.mFrom === 10 && f.mTo === 11)) {
      markData.push([
        { xAxis: labels[f.mFrom], itemStyle: { color: C('--s1'), opacity: 0.08 } },
        { xAxis: labels[f.mTo] },
      ]);
    }
    const mark = markData.length ? { silent: true, data: markData } : undefined;
    const point = (value, i) => {
      if (value == null || !isFinite(value)) return null;
      return { value, symbolSize: active(i) ? 8 : 5, itemStyle: { opacity: active(i) ? 1 : 0.28 } };
    };
    const axisLabel = {
      color: C('--text-2'), fontSize: 12,
      formatter: (val, idx) => active(idx) ? val : `{off|${val}}`,
      rich: { off: { color: C('--muted'), fontSize: 12 } },
    };
    const dz = [{ type: 'inside', xAxisIndex: 0 }];
    const lineS = (name, data, color, extra) => Object.assign({
      name, type: 'line', data, smooth: false, symbol: 'circle', symbolSize: 7,
      lineStyle: { width: 2, color }, itemStyle: { color, borderColor: C('--surface'), borderWidth: 2 },
      emphasis: { focus: 'series' },
    }, extra || {});
    const axisTip = fmt => Object.assign(base().tooltip, {
      trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: C('--axis') } }, formatter: fmt,
    });
    const monthHint = i => active(i)
      ? 'Nhấn để lọc theo tháng này'
      : 'Tháng này đang ngoài khoảng lọc · nhấn để chuyển lọc sang tháng này';
    const onMonthClick = p => {
      if (!p || p.componentType !== 'series' || p.dataIndex == null) return;
      setMonth(months[p.dataIndex]);
    };
    const fade = partial ? 0.28 : 1;
    const focus = data => data.map((v, i) => (v == null || !active(i) ? null : v));
    const overlay = (name, data, color) => lineS(name, focus(data), color, {
      silent: true, z: 3, tooltip: { show: false },
      lineStyle: { width: 2.5, color, opacity: 1 },
    });

    const c1 = chart('cMonthMoney');
    c1.group = 'monthly';
    c1.setOption(Object.assign(base(), {
      legend: legendBase({ data: ['Doanh thu', 'Lợi nhuận'], icon: 'roundRect', itemHeight: 4 }),
      grid: { left: 8, right: 24, top: 60, bottom: 44, containLabel: true },
      tooltip: axisTip(ps => {
        if (!ps || !ps.length) return '';
        const i = ps[0].dataIndex, a = stats[i];
        return tipTitle(labels[i] + ' / 2025') + tipRow(C('--s1'), tr(a.rev), 'Doanh thu') +
          tipRow(C('--s3'), tr(a.profit), 'Lợi nhuận') + tipRow(null, a.n, 'giao dịch') +
          `<div style="color:${C('--muted')};font-size:12px;margin-top:4px">${monthHint(i)}</div>`;
      }),
      xAxis: catAxis(labels, { boundaryGap: false, axisLabel }),
      yAxis: valAxis({ name: 'triệu ₫', axisLabel: { color: C('--muted'), fontSize: 11, formatter: v => nf0.format(v / 1e6) } }),
      dataZoom: dz.concat([{
        type: 'slider', xAxisIndex: 0, height: 18, bottom: 6, borderColor: C('--border'),
        fillerColor: 'rgba(42,120,214,0.12)', textStyle: { color: C('--muted') },
        dataBackground: { lineStyle: { color: C('--axis') }, areaStyle: { color: C('--grid') } },
      }]),
      series: (() => {
        const rev = stats.map((a, i) => point(a.n ? a.rev : null, i));
        const profit = stats.map((a, i) => point(a.n ? a.profit : null, i));
        const list = [
          lineS('Doanh thu', rev, C('--s1'), {
            z: 2, markArea: mark,
            lineStyle: { width: 2, color: C('--s1'), opacity: fade },
            areaStyle: { color: C('--s1'), opacity: partial ? 0.04 : 0.08 },
          }),
          lineS('Lợi nhuận', profit, C('--s3'), {
            z: 2, lineStyle: { width: 2, color: C('--s3'), opacity: fade },
          }),
        ];
        if (partial) list.push(overlay('Doanh thu đang lọc', rev, C('--s1')), overlay('Lợi nhuận đang lọc', profit, C('--s3')));
        return list;
      })(),
    }), true);
    c1.off('click');
    c1.on('click', onMonthClick);

    const c2 = chart('cMonthPct');
    c2.group = 'monthly';
    c2.setOption(Object.assign(base(), {
      legend: legendBase({ data: ['Biên lợi nhuận', 'Giảm giá TB'], icon: 'roundRect', itemHeight: 4 }),
      grid: { left: 8, right: 56, top: 40, bottom: 8, containLabel: true },
      tooltip: axisTip(ps => {
        if (!ps || !ps.length) return '';
        const i = ps[0].dataIndex, a = stats[i];
        return tipTitle(labels[i] + ' / 2025') + tipRow(C('--s1'), pct(a.margin), 'Biên lợi nhuận') +
          tipRow(C('--s2'), pct(a.disc), 'Giảm giá TB') +
          `<div style="color:${C('--muted')};font-size:12px;margin-top:4px">${monthHint(i)}</div>`;
      }),
      xAxis: catAxis(labels, { boundaryGap: false, axisLabel }),
      yAxis: valAxis({ min: 0, axisLabel: { color: C('--muted'), fontSize: 11, formatter: '{value}%' } }),
      dataZoom: dz,
      series: (() => {
        const margin = stats.map((a, i) => point(a.n ? +a.margin.toFixed(1) : null, i));
        const disc = stats.map((a, i) => point(a.n ? +a.disc.toFixed(1) : null, i));
        const endOf = pick => ({
          show: true, color: C('--text'), fontSize: 11,
          formatter: p => { const a = stats[p.dataIndex]; return a && a.n ? pct(pick(a)) : ''; },
        });
        const list = [
          lineS('Biên lợi nhuận', margin, C('--s1'), {
            z: 2, endLabel: endOf(a => a.margin),
            lineStyle: { width: 2, color: C('--s1'), opacity: fade },
          }),
          lineS('Giảm giá TB', disc, C('--s2'), {
            z: 2, endLabel: endOf(a => a.disc),
            lineStyle: { width: 2, color: C('--s2'), opacity: fade },
          }),
        ];
        if (partial) list.push(overlay('Biên lợi nhuận đang lọc', margin, C('--s1')), overlay('Giảm giá TB đang lọc', disc, C('--s2')));
        return list;
      })(),
    }), true);
    c2.off('click');
    c2.on('click', onMonthClick);
    echarts.connect('monthly');
  }
  function setMonth(m) {
    const f = state.filters;
    if (f.mFrom === m && f.mTo === m) { f.mFrom = 0; f.mTo = 11; } else { f.mFrom = m; f.mTo = m; }
    syncControls(); updateAll();
  }

  // =====================================================================
  // Nhận định 5 – Giao hàng & đánh giá
  // =====================================================================
  function renderDelivery() {
    const rows = filtered().filter(d => d.Delivery_Days !== null);
    const days = [1, 2, 3, 4];
    const ratingAt = (rs, k) => {
      const v = rs.filter(d => d.Delivery_Days === k && d.Customer_Rating !== null);
      return v.length ? { v: +(sum(v, 'Customer_Rating') / v.length).toFixed(2), n: v.length } : { v: null, n: 0 };
    };
    const MIN_N = 3;
    const overall = days.map(k => ratingAt(rows, k));
    const gs = group(rows, 'Store');
    const storeColors = [C('--s2'), C('--s3'), C('--s4'), C('--s5')];
    const storeSymbols = ['rect', 'triangle', 'diamond', 'circle'];
    const storeData = STORES.map(s => days.map(k => ratingAt(gs.get(s) || [], k)));
    let slowest = 0, slowestRating = Infinity;
    STORES.forEach((s, si) => {
      const r = mean(rows.filter(d => d.Store === s), 'Customer_Rating');
      if (isFinite(r) && r < slowestRating) { slowestRating = r; slowest = si; }
    });
    const series = [{
      name: 'Toàn chuỗi', type: 'line', data: overall.map(o => o.v), symbol: 'circle', symbolSize: 9, z: 5,
      lineStyle: { width: 3, color: C('--s1') }, itemStyle: { color: C('--s1'), borderColor: C('--surface'), borderWidth: 2 },
      label: { show: true, position: 'top', color: C('--text'), fontWeight: 600, fontSize: 12, formatter: p => p.value === null ? '' : nf2.format(p.value) },
    }].concat(STORES.map((s, si) => ({
      name: STORE_VI[s], type: 'line',
      data: storeData[si].map(o => (o.n >= MIN_N ? o.v : null)),
      connectNulls: false,
      symbol: storeSymbols[si], symbolSize: 7,
      lineStyle: { width: si === slowest ? 2.6 : 1.25, color: storeColors[si] },
      itemStyle: { color: storeColors[si] }, emphasis: { focus: 'series' },
    })));
    const plotted = overall.map(o => o.v).concat(storeData.flatMap(arr => arr.filter(o => o.n >= MIN_N).map(o => o.v)));
    const scale = ratingScale(plotted);
    const c = chart('cDelivRating');
    const leg = legendBase({ data: ['Toàn chuỗi'].concat(STORES.map(s => STORE_VI[s])) });
    delete leg.icon;
    c.setOption(Object.assign(base(), {
      legend: leg,
      grid: { left: 8, right: 18, top: 64, bottom: 30, containLabel: true },
      tooltip: Object.assign(base().tooltip, {
        trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: C('--axis') } },
        formatter: ps => {
          const i = ps[0].dataIndex;
          return tipTitle(`Giao trong ${days[i]} ngày`) + tipRow(C('--s1'), overall[i].v === null ? '–' : nf2.format(overall[i].v), `Toàn chuỗi (n=${overall[i].n})`) +
            STORES.map((s, si) => {
              const cell = storeData[si][i];
              const note = cell.n > 0 && cell.n < MIN_N ? ' · không vẽ' : '';
              return tipRow(storeColors[si], cell.v === null ? '–' : nf2.format(cell.v), `${STORE_VI[s]} (n=${cell.n})${note}`);
            }).join('');
        },
      }),
      xAxis: catAxis(days.map(d => d + ' ngày'), { name: 'Thời gian giao hàng', nameLocation: 'middle', nameGap: 28, nameTextStyle: { color: C('--muted'), fontSize: 11 } }),
      yAxis: valAxis({
        name: 'Điểm (thang 1–5)', min: scale.min, max: scale.max,
        axisLabel: { color: C('--muted'), fontSize: 11, formatter: v => nf1.format(v) },
      }),
      series,
    }), true);

    // Phân bố ngày giao theo chi nhánh (100%)
    const ramp = ordinalRamp(4), sel = state.filters.store;
    const allRows = filtered('store').filter(d => d.Delivery_Days !== null), g2 = group(allRows, 'Store');
    const dist = STORES.map(s => {
      const rs = g2.get(s) || [];
      return days.map(k => rs.length ? rs.filter(d => d.Delivery_Days === k).length / rs.length * 100 : 0);
    });
    const ylabels = STORES.map(s => {
      const a = agg(group(filtered('store'), 'Store').get(s) || []);
      return `${STORE_VI[s]}\n★ ${isFinite(a.rating) ? nf2.format(a.rating) : '–'}`;
    });
    const c2 = chart('cDelivStore');
    c2.setOption(Object.assign(base(), {
      legend: legendBase({ data: days.map(d => d + ' ngày') }),
      grid: { left: 8, right: 18, top: 40, bottom: 8, containLabel: true },
      tooltip: Object.assign(base().tooltip, {
        trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: C('--grid'), opacity: 0.4 } },
        formatter: ps => tipTitle(STORE_VI[STORES[ps[0].dataIndex]]) + ps.map(p => tipRow(p.color, pct(p.value), 'giao trong ' + p.seriesName)).join(''),
      }),
      yAxis: catAxis(ylabels, { inverse: true, axisLabel: { color: C('--text-2'), fontSize: 12, lineHeight: 16 } }),
      xAxis: valAxis({ max: 100, axisLabel: { color: C('--muted'), fontSize: 11, formatter: '{value}%' } }),
      series: days.map((k, ki) => ({
        name: k + ' ngày', type: 'bar', stack: 'd', barWidth: '58%',
        itemStyle: { color: ramp[ki], borderColor: C('--surface'), borderWidth: 1 },
        label: { show: true, color: textOn(ramp[ki]), fontSize: 11, formatter: p => p.value >= 9 ? nf0.format(p.value) + '%' : '' },
        data: dist.map((d, si) => ({ value: +d[ki].toFixed(1), itemStyle: { opacity: dimmed(sel, STORES[si]) } })),
      })),
    }), true);
    c2.off('click');
    c2.on('click', p => toggleFilter('store', STORES[p.dataIndex]));
  }

  // =====================================================================
  // Nhận định 6 – Thanh toán & khách hàng
  // =====================================================================
  function renderPayment() {
    const pc = payColors();
    const rowsP = filtered('payment'), gp = group(rowsP, 'Payment_Method'), selP = state.filters.payment;
    const tot = rowsP.length;
    const c = chart('cPayPie');
    c.setOption(Object.assign(base(), {
      tooltip: Object.assign(base().tooltip, {
        trigger: 'item',
        formatter: p => {
          const a = agg(gp.get(PAYS[p.dataIndex]) || []);
          return tipTitle(PAY_VI[PAYS[p.dataIndex]]) + tipRow(p.color, pct(p.percent), 'số giao dịch') +
            tipRow(null, a.n, 'giao dịch') + tipRow(null, tr(a.rev), 'Doanh thu') +
            tipRow(null, isFinite(a.rating) ? nf2.format(a.rating) : '–', 'điểm đánh giá TB');
        },
      }),
      series: [{
        type: 'pie', radius: ['45%', '70%'], center: ['50%', '54%'], startAngle: 90,
        itemStyle: { borderColor: C('--surface'), borderWidth: 2, borderRadius: 4 },
        label: {
          color: C('--text'), fontSize: 12, lineHeight: 16,
          formatter: p => `${p.name}\n{b|${nf0.format(p.percent)}%}`,
          rich: { b: { fontWeight: 700, fontSize: 14, color: C('--text') } },
        },
        labelLine: { lineStyle: { color: C('--axis') } },
        data: PAYS.map(p => ({
          name: PAY_VI[p], value: (gp.get(p) || []).length,
          itemStyle: { color: pc[p], opacity: dimmed(selP, p) },
        })),
      }],
      graphic: [{
        type: 'text', left: 'center', top: '49%',
        style: { text: `${nf0.format(tot)}\ngiao dịch`, align: 'center', fill: C('--text-2'), fontSize: 12, lineHeight: 16, fontFamily: FONT },
      }],
    }), true);
    c.off('click');
    c.on('click', p => toggleFilter('payment', PAYS[p.dataIndex]));

    const rowsC = filtered('customer'), gc = group(rowsC, 'Customer_Type'), selC = state.filters.customer;
    const shares = CUSTS.map(t => {
      const rs = gc.get(t) || [];
      return PAYS.map(p => rs.length ? rs.filter(d => d.Payment_Method === p).length / rs.length * 100 : 0);
    });
    const c2 = chart('cPayCust');
    c2.setOption(Object.assign(base(), {
      legend: legendBase({ data: PAYS.map(p => PAY_VI[p]) }),
      grid: { left: 8, right: 18, top: 40, bottom: 8, containLabel: true },
      tooltip: Object.assign(base().tooltip, {
        trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: C('--grid'), opacity: 0.4 } },
        formatter: ps => {
          const t = CUSTS[ps[0].dataIndex];
          return tipTitle(`${CUST_VI[t]} (${(gc.get(t) || []).length} giao dịch)`) + ps.map(p => tipRow(p.color, pct(p.value), p.seriesName)).join('');
        },
      }),
      yAxis: catAxis(CUSTS.map(t => CUST_VI[t]), { inverse: true }),
      xAxis: valAxis({ max: 100, axisLabel: { color: C('--muted'), fontSize: 11, formatter: '{value}%' } }),
      series: PAYS.map((p, pi) => ({
        name: PAY_VI[p], type: 'bar', stack: 'pay', barWidth: '58%',
        itemStyle: { color: pc[p], borderColor: C('--surface'), borderWidth: 1 },
        label: {
          show: true, fontSize: 11, fontWeight: pi === 0 ? 700 : 400,
          color: textOn(pc[p]),
          formatter: v => v.value >= 10 ? nf0.format(v.value) + '%' : '',
        },
        data: shares.map((s, ti) => ({ value: +s[pi].toFixed(1), itemStyle: { opacity: dimmed(selC, CUSTS[ti]) } })),
      })),
    }), true);
    c2.off('click');
    c2.on('click', p => toggleFilter('customer', CUSTS[p.dataIndex]));
  }

  // =====================================================================
  // Nhận định 7 – Ngày trong tuần
  // =====================================================================
  function renderWeekday() {
    const rows = filtered('weekday'), g = group(rows, 'Day_of_Week'), selDay = state.filters.weekday;
    const stats = DAYS.map(d => agg(g.get(d) || []));
    const c = chart('cWeekday');
    c.setOption(Object.assign(base(), {
      grid: { left: 8, right: 18, top: 30, bottom: 8, containLabel: true },
      tooltip: Object.assign(base().tooltip, {
        trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: C('--grid'), opacity: 0.4 } },
        formatter: ps => {
          const i = ps[0].dataIndex, a = stats[i];
          return tipTitle(DAY_VI[i]) + tipRow(ps[0].color, tr(a.rev), 'Doanh thu') + tipRow(null, tr(a.profit), 'Lợi nhuận') +
            tipRow(null, a.n, 'giao dịch') + `<div style="color:${C('--muted')};font-size:12px;margin-top:4px">Nhấn để lọc theo ngày</div>`;
        },
      }),
      xAxis: catAxis(DAY_VI),
      yAxis: valAxis({ name: 'triệu ₫', axisLabel: { color: C('--muted'), fontSize: 11, formatter: v => nf0.format(v / 1e6) } }),
      series: [{
        type: 'bar', barWidth: '58%',
        data: stats.map((a, i) => ({
          value: a.rev,
          itemStyle: { color: i >= 5 ? C('--s2') : C('--s1'), borderRadius: [4, 4, 0, 0], opacity: dimmed(selDay, DAYS[i]) },
        })),
        label: { show: true, position: 'top', color: C('--text-2'), fontSize: 11, formatter: p => nf1.format(p.value / 1e6) },
      }],
    }), true);
    c.off('click');
    c.on('click', p => { if (p.dataIndex != null) toggleFilter('weekday', DAYS[p.dataIndex]); });
    c.getZr().off('click');
    c.getZr().on('click', e => {
      if (e.target) return;
      const pt = [e.offsetX, e.offsetY];
      if (!c.containPixel('grid', pt)) return;
      const i = Math.round(c.convertFromPixel({ seriesIndex: 0 }, pt)[0]);
      if (i >= 0 && i < DAYS.length) toggleFilter('weekday', DAYS[i]);
    });

    const cells = [];
    let max = 0;
    CUSTS.forEach((t, ti) => DAYS.forEach((d, di) => {
      const v = sum(rows.filter(r => r.Customer_Type === t && r.Day_of_Week === d), 'Revenue') / 1e6;
      max = Math.max(max, v);
      cells.push({ value: [di, ti, +v.toFixed(2)], itemStyle: { opacity: dimmed(selDay, d) } });
    }));
    const heatRamp = isDark()
      ? ['#1f2a38', '#184f95', '#2a78d6', '#6da7ec', '#cde2fb']
      : ['#f0f5fc', '#b7d3f6', '#6da7ec', '#2a78d6', '#104281'];
    const c2 = chart('cHeat');
    c2.setOption(Object.assign(base(), {
      grid: { left: 8, right: 18, top: 8, bottom: 56, containLabel: true },
      tooltip: Object.assign(base().tooltip, {
        trigger: 'item',
        formatter: p => tipTitle(`${CUST_VI[CUSTS[p.value[1]]]} · ${DAY_VI[p.value[0]]}`) + tipRow(p.color, nf2.format(p.value[2]) + ' tr', 'Doanh thu') +
          `<div style="color:${C('--muted')};font-size:12px;margin-top:4px">Nhấn để lọc theo ngày</div>`,
      }),
      xAxis: catAxis(DAY_VI, { axisLabel: { color: C('--text-2'), fontSize: 11, interval: 0 } }),
      yAxis: catAxis(CUSTS.map(t => CUST_VI[t]), { inverse: true }),
      visualMap: {
        min: 0, max: Math.max(1, Math.ceil(max)), calculable: true, orient: 'horizontal', left: 'center', bottom: 0,
        itemHeight: 160, itemWidth: 12, text: ['cao', 'thấp'], textStyle: { color: C('--muted'), fontSize: 11 },
        inRange: { color: heatRamp }, formatter: v => nf1.format(v) + ' tr',
      },
      series: [{
        type: 'heatmap', data: cells,
        itemStyle: { borderColor: C('--surface'), borderWidth: 2, borderRadius: 4 },
        emphasis: { itemStyle: { borderColor: C('--text'), borderWidth: 1 } },
      }],
    }), true);
    c2.off('click');
    c2.on('click', p => { if (p.value) toggleFilter('weekday', DAYS[p.value[0]]); });
  }

  // =====================================================================
  // Nhận định 8 – Toạ độ song song
  // =====================================================================
  let parallelRows = [];
  const axisIntervals = {};
  let applyingParallel = false;
  const PAR_AXES = [
    { id: 'store', name: 'Chi nhánh', type: 'category', data: STORES.map(s => STORE_VI[s]) },
    { id: 'cat', name: 'Nhóm hàng', type: 'category', data: CATS },
    { id: 'disc', name: 'Giảm giá (%)', min: 0, max: 35 },
    { id: 'qty', name: 'Số lượng', min: 0, max: 10 },
    { id: 'rev', name: 'Doanh thu (tr)' },
    { id: 'margin', name: 'Biên LN (%)' },
    { id: 'deliv', name: 'Ngày giao', min: 1, max: 4 },
    { id: 'rating', name: 'Điểm', min: 2.5, max: 5 },
  ];
  function renderParallel() {
    parallelRows = filtered();
    const data = parallelRows.map(d => [
      STORE_VI[d.Store], d.Product_Category, d.Discount, d.Quantity, +(d.Revenue / 1e6).toFixed(2),
      parallelMargin(d), d.Delivery_Days === null ? null : d.Delivery_Days, d.Customer_Rating === null ? null : d.Customer_Rating,
    ]);
    const c = chart('cParallel');
    c.setOption(Object.assign(base(), {
      parallel: { left: 70, right: 70, top: 56, bottom: 40, parallelAxisDefault: {
        nameLocation: 'start', nameGap: 18, nameTextStyle: { color: C('--text'), fontSize: 12, fontWeight: 600 },
        axisLine: { lineStyle: { color: C('--axis') } }, axisTick: { lineStyle: { color: C('--axis') } },
        axisLabel: { color: C('--text-2'), fontSize: 11 }, realtime: true,
        areaSelectStyle: { width: 18, borderWidth: 1, borderColor: C('--s1'), color: C('--s1'), opacity: 0.25 },
      } },
      parallelAxis: PAR_AXES.map((a, i) => Object.assign({ dim: i, inverse: false }, a,
        a.id === 'store' || a.id === 'cat' ? { axisLabel: { color: C('--text-2'), fontSize: 11, width: 80, overflow: 'truncate' } } : {})),
      visualMap: {
        type: 'piecewise', dimension: 5, orient: 'horizontal', right: 10, top: 0,
        textStyle: { color: C('--text-2'), fontSize: 12 }, itemWidth: 14, itemHeight: 8,
        pieces: [
          { lt: 0, color: C('--critical'), label: 'Lỗ (< 0%)' },
          { gte: 0, lt: 20, color: C('--s2'), label: 'Biên 0–20%' },
          { gte: 20, color: C('--s1'), label: 'Biên ≥ 20%' },
        ],
      },
      tooltip: Object.assign(base().tooltip, {
        trigger: 'item',
        formatter: p => {
          const d = parallelRows[p.dataIndex];
          if (!d) return '';
          const rating = d.Customer_Rating === null ? '–' : nf2.format(d.Customer_Rating);
          const days = d.Delivery_Days === null ? '–' : String(d.Delivery_Days);
          const color = typeof p.color === 'string' ? p.color : C('--text-2');
          return tipTitle(`${d.Transaction_ID} · ${d.Product}`) +
            tipRow(color, pct(d.margin), 'Biên lợi nhuận') +
            tipRow(null, moneyLabel(d.Revenue), 'Doanh thu') +
            tipRow(null, moneyLabel(d.Profit), 'Lợi nhuận') +
            tipRow(null, `${d.Discount}% · SL ${d.Quantity}`, 'Giảm giá · số lượng') +
            tipRow(null, `${STORE_VI[d.Store]} · ${d.Product_Category}`, '') +
            tipRow(null, `${rating} điểm · ${days} ngày giao`, '');
        },
      }),
      series: [{
        type: 'parallel', smooth: false, data,
        lineStyle: { width: 1.2, opacity: 0.45 },
        emphasis: { lineStyle: { width: 3, opacity: 1 } },
        inactiveOpacity: 0.04, activeOpacity: 0.9,
      }],
    }), true);
    c.off('axisareaselected');
    c.on('axisareaselected', onAxisArea);
    applyParallelIntervals(c);
    updateParallelInfo();
  }
  // Biên làm tròn 1 chữ số. Đơn lỗ mà làm tròn thành ≥ 0 được giữ ở −0,1 để preset "Giao dịch lỗ" không bỏ sót.
  function parallelMargin(d) {
    if (d.margin == null || !isFinite(d.margin)) return null;
    const rounded = +d.margin.toFixed(1);
    if (d.Profit < 0 && !(rounded < 0)) return -0.1;
    return rounded;
  }
  function parallelValue(d, id) {
    switch (id) {
      case 'store': return STORE_VI[d.Store];
      case 'cat': return d.Product_Category;
      case 'disc': return d.Discount;
      case 'qty': return d.Quantity;
      case 'rev': return +(d.Revenue / 1e6).toFixed(2);
      case 'margin': return parallelMargin(d);
      case 'deliv': return d.Delivery_Days === null ? null : d.Delivery_Days;
      case 'rating': return d.Customer_Rating === null ? null : d.Customer_Rating;
      default: return null;
    }
  }
  function inParallelRange(v, a, b, axis) {
    if (v == null || (typeof v === 'number' && !isFinite(v))) return false;
    if (axis.type === 'category') {
      const labels = axis.data;
      const idx = x => {
        const byLabel = labels.indexOf(x);
        if (byLabel >= 0) return byLabel;
        const n = Number(x);
        return Number.isInteger(n) ? n : -1;
      };
      const ia = idx(a), ib = idx(b), iv = idx(v);
      if (ia < 0 || ib < 0 || iv < 0) return false;
      return iv >= Math.min(ia, ib) && iv <= Math.max(ia, ib);
    }
    const va = Number(a), vb = Number(b), vv = Number(v);
    if (![va, vb, vv].every(Number.isFinite)) return false;
    return vv >= Math.min(va, vb) && vv <= Math.max(va, vb);
  }
  function matchesIntervals(v, intervals, axis) {
    if (!intervals || !intervals.length) return true;
    return intervals.some(pair => inParallelRange(v, pair[0], pair[1], axis));
  }
  function activeParallelRows() {
    const active = PAR_AXES.filter(a => axisIntervals[a.id] && axisIntervals[a.id].length);
    if (!active.length) return parallelRows;
    return parallelRows.filter(d => active.every(a => matchesIntervals(parallelValue(d, a.id), axisIntervals[a.id], a)));
  }
  function onAxisArea(params) {
    if (params && params.parallelAxisId) {
      axisIntervals[params.parallelAxisId] = params.intervals || [];
      if (!applyingParallel) state.parallelPreset = null;
    }
    if (!applyingParallel) {
      syncPresetButtons();
      updateParallelInfo();
    }
  }
  function applyParallelIntervals(c) {
    if (!c) return;
    applyingParallel = true;
    try {
      PAR_AXES.forEach(a => {
        c.dispatchAction({
          type: 'axisAreaSelect',
          parallelAxisId: a.id,
          intervals: (axisIntervals[a.id] && axisIntervals[a.id].length) ? axisIntervals[a.id] : [],
        });
      });
    } finally {
      setTimeout(() => { applyingParallel = false; }, 0);
    }
  }
  function syncPresetButtons() {
    document.querySelectorAll('[data-preset]').forEach(b => {
      b.classList.toggle('on', b.dataset.preset === state.parallelPreset);
    });
  }
  function updateParallelInfo() {
    const sel = activeParallelRows(), a = agg(sel);
    const info = document.getElementById('parallelInfo');
    const isAll = sel.length === parallelRows.length;
    const lacks = rows => rows.filter(d => d.Delivery_Days == null || d.Customer_Rating == null).length;
    const missingAll = lacks(parallelRows);
    const missingSel = lacks(sel);
    let gap = '';
    if (isAll && missingAll) gap = ` · ${missingAll} đường trên biểu đồ đứt vì thiếu điểm hoặc ngày giao`;
    else if (!isAll) {
      if (missingSel) gap = ` · ${missingSel} giao dịch trong vùng chọn thiếu điểm hoặc ngày giao`;
      if (missingAll) gap += ` · ${missingAll} đường trên toàn biểu đồ đứt vì thiếu điểm hoặc ngày giao`;
    }
    info.textContent = (isAll ? 'Chưa lọc trên trục nào. ' : '') +
      `${a.n} giao dịch được chọn · doanh thu ${tr(a.rev)} · lợi nhuận ${tr(a.profit)} · biên ${pct(a.margin)} · ` +
      `giảm giá TB ${pct(a.disc)} · điểm TB ${isFinite(a.rating) ? nf2.format(a.rating) : '–'}` + gap;
    const list = sel.slice().sort((x, y) => x.margin - y.margin).slice(0, isAll ? 10 : 40);
    renderTable(document.getElementById('parallelTable'), list, false);
  }
  function parallelPreset(name) {
    const ranges = {
      loss: { margin: [[-100, -0.05]] },
      big: { qty: [[5.5, 10]] },
      slow: { deliv: [[3.8, 4]] },
      clear: {},
    }[name] || {};
    state.parallelPreset = name === 'clear' ? null : name;
    PAR_AXES.forEach(a => { axisIntervals[a.id] = ranges[a.id] ? ranges[a.id].map(pair => pair.slice()) : []; });
    applyParallelIntervals(charts.cParallel);
    syncPresetButtons();
    updateParallelInfo();
  }

  // =====================================================================
  // Bảng dữ liệu
  // =====================================================================
  const COLS = [
    ['Transaction_ID', 'Mã GD'], ['Date', 'Ngày'], ['Store', 'Chi nhánh', d => STORE_VI[d.Store]],
    ['Product_Category', 'Nhóm hàng'], ['Product', 'Sản phẩm'], ['Customer_Type', 'Loại khách', d => CUST_VI[d.Customer_Type]],
    ['Payment_Method', 'Thanh toán', d => PAY_VI[d.Payment_Method]],
    ['Quantity', 'SL', null, true], ['Unit_Price', 'Đơn giá (₫)', d => nf0.format(d.Unit_Price), true],
    ['Discount', 'Giảm giá', d => d.Discount + '%', true], ['Revenue', 'Doanh thu (₫)', d => nf0.format(d.Revenue), true],
    ['Profit', 'Lợi nhuận (₫)', d => nf0.format(d.Profit), true], ['margin', 'Biên LN', d => pct(d.margin), true],
    ['Customer_Rating', 'Điểm', d => d.Customer_Rating === null ? '–' : nf2.format(d.Customer_Rating), true],
    ['Delivery_Days', 'Ngày giao', d => d.Delivery_Days === null ? '–' : d.Delivery_Days, true],
  ];
  const sortState = { key: 'Transaction_ID', dir: 1 };
  function renderTable(table, rows, sortable) {
    const thead = document.createElement('thead'), tr0 = document.createElement('tr');
    COLS.forEach(([k, label, , num]) => {
      const th = document.createElement('th');
      th.textContent = label + (sortable && sortState.key === k ? (sortState.dir > 0 ? ' ▲' : ' ▼') : '');
      if (num) th.classList.add('num');
      if (sortable) {
        th.classList.add('sortable');
        th.addEventListener('click', () => {
          sortState.dir = sortState.key === k ? -sortState.dir : 1; sortState.key = k; renderDataTable();
        });
      }
      tr0.append(th);
    });
    thead.append(tr0);
    const tbody = document.createElement('tbody');
    rows.forEach(d => {
      const tr1 = document.createElement('tr');
      COLS.forEach(([k, , fmt, num]) => {
        const td = document.createElement('td');
        td.textContent = fmt ? fmt(d) : d[k];
        if (num) td.className = 'num';
        if ((k === 'Profit' || k === 'margin') && d.Profit < 0) td.className = 'num neg';
        tr1.append(td);
      });
      tbody.append(tr1);
    });
    table.replaceChildren(thead, tbody);
  }
  function sortValue(row, k, fmt, num) {
    const raw = row[k];
    if (raw === null || raw === undefined) return null;
    if (num) return raw;
    return fmt ? fmt(row) : raw;
  }
  function renderDataTable() {
    const spec = COLS.find(([k]) => k === sortState.key) || [];
    const rows = filtered().slice().sort((a, b) => {
      const x = sortValue(a, sortState.key, spec[2], spec[3]);
      const y = sortValue(b, sortState.key, spec[2], spec[3]);
      if (x === null && y === null) return 0;
      if (x === null) return sortState.dir;
      if (y === null) return -sortState.dir;
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * sortState.dir;
      return String(x).localeCompare(String(y), 'vi', { numeric: true }) * sortState.dir;
    });
    renderTable(document.getElementById('dataTable'), rows, true);
  }

  // =====================================================================
  // Điều khiển bộ lọc
  // =====================================================================
  const sel = id => document.getElementById(id);
  function fillSelect(el, items, labelFn, withAll) {
    el.replaceChildren();
    if (withAll) { const o = document.createElement('option'); o.value = 'all'; o.textContent = 'Tất cả'; el.append(o); }
    items.forEach((v, i) => { const o = document.createElement('option'); o.value = v; o.textContent = labelFn ? labelFn(v, i) : v; el.append(o); });
  }
  function initControls() {
    const mIdx = MONTH_VI.map((_, i) => String(i));
    fillSelect(sel('fMonthFrom'), mIdx, (v, i) => 'Tháng ' + (i + 1));
    fillSelect(sel('fMonthTo'), mIdx, (v, i) => 'Tháng ' + (i + 1));
    fillSelect(sel('fStore'), STORES, v => STORE_VI[v], true);
    fillSelect(sel('fCategory'), CATS, null, true);
    fillSelect(sel('fCustomer'), CUSTS, v => CUST_VI[v], true);
    fillSelect(sel('fPayment'), PAYS, v => PAY_VI[v], true);
    fillSelect(sel('fWeekday'), DAYS, (v, i) => DAY_VI[i], true);
    fillSelect(sel('fDiscount'), DISCOUNTS.map(String), v => v + '%', true);
    fillSelect(sel('fProduct'), PRODUCTS, null, true);
    const f = state.filters;
    sel('fMonthFrom').addEventListener('change', e => { f.mFrom = +e.target.value; if (f.mFrom > f.mTo) f.mTo = f.mFrom; syncControls(); updateAll(); });
    sel('fMonthTo').addEventListener('change', e => { f.mTo = +e.target.value; if (f.mTo < f.mFrom) f.mFrom = f.mTo; syncControls(); updateAll(); });
    [['fStore', 'store'], ['fCustomer', 'customer'], ['fPayment', 'payment'], ['fWeekday', 'weekday'], ['fProduct', 'product']].forEach(([id, k]) =>
      sel(id).addEventListener('change', e => { f[k] = e.target.value; syncControls(); updateAll(); }));
    sel('fCategory').addEventListener('change', e => { f.category = e.target.value; syncControls(); updateAll(); });
    sel('fDiscount').addEventListener('change', e => {
      f.discount = e.target.value === 'all' ? 'all' : +e.target.value;
      syncControls(); updateAll();
    });
    sel('fReset').addEventListener('click', () => {
      Object.assign(f, {
        mFrom: 0, mTo: 11, store: 'all', category: 'all', customer: 'all', payment: 'all',
        weekday: 'all', discount: 'all', product: 'all',
      });
      state.parallelPreset = null;
      PAR_AXES.forEach(a => { axisIntervals[a.id] = []; });
      syncControls(); updateAll();
    });
    document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => parallelPreset(b.dataset.preset)));
  }
  function syncControls() {
    const f = state.filters;
    sel('fMonthFrom').value = String(f.mFrom); sel('fMonthTo').value = String(f.mTo);
    sel('fStore').value = f.store; sel('fCategory').value = f.category;
    sel('fCustomer').value = f.customer; sel('fPayment').value = f.payment;
    sel('fWeekday').value = f.weekday;
    sel('fDiscount').value = f.discount === 'all' ? 'all' : String(f.discount);
    if (f.product !== 'all' && f.category !== 'all' && PRODUCT_CAT[f.product] !== f.category) f.product = 'all';
    fillSelect(sel('fProduct'), f.category === 'all' ? PRODUCTS : PRODUCTS.filter(p => PRODUCT_CAT[p] === f.category), null, true);
    sel('fProduct').value = f.product;
    sel('fMonthFrom').classList.toggle('active', f.mFrom !== 0);
    sel('fMonthTo').classList.toggle('active', f.mTo !== 11);
    [['fStore', 'store'], ['fCategory', 'category'], ['fCustomer', 'customer'], ['fPayment', 'payment'], ['fWeekday', 'weekday'], ['fProduct', 'product']]
      .forEach(([id, k]) => sel(id).classList.toggle('active', f[k] !== 'all'));
    sel('fDiscount').classList.toggle('active', f.discount !== 'all');
  }

  // =====================================================================
  // Đoạn nhận định: cả năm dùng bài viết; khi lọc thì tính lại từ cùng hàm agg
  // =====================================================================
  const insightGroups = [...document.querySelectorAll('.explain')].map(el => {
    const paras = [...el.querySelectorAll(':scope > div > p')];
    return { paras, original: paras.map(p => p.innerHTML) };
  });
  function sliceParagraphs(rows) {
    const total = agg(rows);
    const empty = 'Không có giao dịch nào trong bộ lọc hiện tại.';
    if (!total.n) return Array.from({ length: 8 }, () => [empty, empty, empty]);
    const share = (part, whole) => whole ? pct(part / whole * 100) : '–';

    const gCat = group(rows, 'Product_Category');
    const cats = CATS.map(name => ({ name, ...agg(gCat.get(name) || []) })).filter(x => x.n);
    const byRev = [...cats].sort((a, b) => b.rev - a.rev);
    const byProfit = [...cats].sort((a, b) => b.profit - a.profit);
    const byMargin = [...cats].sort((a, b) => a.margin - b.margin);
    const gProd = group(rows, 'Product');
    const prods = [...gProd.entries()].map(([name, rs]) => ({ name, cat: rs[0].Product_Category, ...agg(rs) }))
      .sort((a, b) => a.margin - b.margin);
    const topR = byRev[0], topP = byProfit[0], lowM = byMargin[0];
    let p1a = cats.length < 2
      ? `${strong(topR.name)} là nhóm hàng duy nhất trong bộ lọc: doanh thu ${strong(tr(topR.rev))}, lợi nhuận ${strong(tr(topR.profit))}, biên ${strong(pct(topR.margin))}, n=${topR.n}.`
      : `${strong(topR.name)} dẫn doanh thu trong bộ lọc (${strong(tr(topR.rev))}, ${strong(share(topR.rev, total.rev))}) với biên ${strong(pct(topR.margin))}.`;
    if (cats.length > 1 && topP && topP.name !== topR.name) p1a += ` ${strong(topP.name)} lại có lợi nhuận cao nhất (${strong(tr(topP.profit))}, biên ${strong(pct(topP.margin))}).`;
    let p1b = prods.length ? `Biên thấp nhất là ${strong(prods[0].name)} (${strong(pct(prods[0].margin))}, ${esc(prods[0].cat)}). Biên cao nhất là ${strong(prods[prods.length - 1].name)} (${strong(pct(prods[prods.length - 1].margin))}).` : '';
    const elecProds = prods.filter(p => p.cat === 'Electronics');
    const otherProds = prods.filter(p => p.cat !== 'Electronics');
    if (elecProds.length && otherProds.length && Math.max(...elecProds.map(p => p.margin)) <= Math.min(...otherProds.map(p => p.margin))) {
      p1b += ` Cả ${elecProds.length} sản phẩm Electronics đều nằm dưới các sản phẩm còn lại.`;
    }
    const elec = cats.find(c => c.name === 'Electronics'), fash = cats.find(c => c.name === 'Fashion');
    let p1c = `Nhóm biên thấp nhất trong lát cắt này là ${strong(lowM.name)} (${strong(pct(lowM.margin))}, n=${lowM.n}). Khuyến nghị cả năm vẫn ở mục Kết luận.`;
    if (elec && fash && elec.margin < fash.margin) {
      p1c = `Mẫu hình cả năm vẫn hiện ra: Electronics biên ${strong(pct(elec.margin))} thấp hơn Fashion ${strong(pct(fash.margin))}. Nên xếp nhóm hàng theo lợi nhuận, không chỉ theo doanh thu.`;
    }

    const gStore = group(rows, 'Store');
    const stores = STORES.map(s => {
      const rs = gStore.get(s) || [];
      const a = agg(rs);
      return { s, ...a, elecShare: a.rev ? sum(rs.filter(d => d.Product_Category === 'Electronics'), 'Revenue') / a.rev * 100 : NaN };
    }).filter(x => x.n);
    const topStore = [...stores].sort((a, b) => b.rev - a.rev)[0];
    const lowStore = [...stores].sort((a, b) => a.margin - b.margin)[0];
    const highStore = [...stores].sort((a, b) => b.margin - a.margin)[0];
    let p2a = empty;
    if (topStore && stores.length < 2) {
      p2a = `${strong(STORE_VI[topStore.s])} có doanh thu ${strong(tr(topStore.rev))} và biên ${strong(pct(topStore.margin))} (n=${topStore.n}).`;
    } else if (topStore && topStore.s === lowStore.s) {
      p2a = `${strong(STORE_VI[topStore.s])} dẫn doanh thu (${strong(tr(topStore.rev))}, n=${topStore.n}) và cũng là chi nhánh biên thấp nhất (${strong(pct(topStore.margin))}).`;
      if (highStore && highStore.s !== topStore.s) p2a += ` Biên cao nhất là ${strong(STORE_VI[highStore.s])} (${strong(pct(highStore.margin))}, n=${highStore.n}).`;
    } else if (topStore) {
      p2a = `${strong(STORE_VI[topStore.s])} dẫn doanh thu (${strong(tr(topStore.rev))}) với biên ${strong(pct(topStore.margin))}. Biên thấp nhất là ${strong(STORE_VI[lowStore.s])} (${strong(pct(lowStore.margin))}).`;
    }
    const mixOpen = state.filters.category === 'all' && state.filters.product === 'all';
    let p2b = '';
    if (topStore && mixOpen) {
      p2b = `${strong(STORE_VI[topStore.s])} có ${strong(pct(topStore.elecShare))} doanh thu từ Electronics.`;
      const within = CATS.map(cat => ({ cat, ...agg((gStore.get(topStore.s) || []).filter(d => d.Product_Category === cat)) })).filter(x => x.n);
      if (within.length) {
        const thin = within.filter(x => x.n < 5).map(x => `${x.cat} n=${x.n}`);
        p2b += ` Biên từng nhóm hàng tại đây chạy từ ${strong(pct(Math.min(...within.map(x => x.margin))))} đến ${strong(pct(Math.max(...within.map(x => x.margin))))}.`;
        if (thin.length) p2b += ` Ô ít đơn: ${esc(thin.join(', '))}.`;
      }
    } else if (topStore && lowStore && highStore) {
      const scope = state.filters.category !== 'all' ? state.filters.category : state.filters.product;
      p2b = `Lát cắt đang khoá ${strong(scope)}, nên phần trăm Electronics không còn là cơ cấu chi nhánh. Biên trong lát cắt chạy từ ${strong(pct(lowStore.margin))} (${esc(STORE_VI[lowStore.s])}, n=${lowStore.n}) đến ${strong(pct(highStore.margin))} (${esc(STORE_VI[highStore.s])}, n=${highStore.n}).`;
    }
    const p2c = 'Nếu biên cả chi nhánh thấp trong khi biên từng nhóm không thấp bất thường, đó là hiệu ứng cơ cấu. Kết luận cả năm không đổi.';

    const gDisc = group(rows, 'Discount');
    const discStats = DISCOUNTS.map(d => ({ d, ...agg(gDisc.get(d) || []) })).filter(x => x.n);
    const losses = rows.filter(d => d.Profit < 0);
    const prDisc = pearson(rows, d => d.Discount, d => d.margin);
    const costRatio = d => (d.Quantity && d.Unit_Price) ? d.Cost / (d.Quantity * d.Unit_Price) : null;
    const prCost = pearson(rows, d => d.Discount, costRatio);
    const p3a = discStats.length ? 'Biên theo mức giảm giá: ' + discStats.map(x => `${x.d}% → ${pct(x.margin)} (n=${x.n})`).join('; ') + '.' : empty;
    let p3b = `Có ${strong(String(losses.length))} giao dịch lỗ`;
    if (losses.length) {
      const cats = [...new Set(losses.map(d => d.Product_Category))];
      p3b += `, mức giảm thấp nhất trong nhóm lỗ là ${strong(Math.min(...losses.map(d => d.Discount)) + '%')}, thuộc ${esc(cats.join(', '))}`;
    }
    p3b += '.';
    if (isFinite(prDisc.r)) p3b += ` Tương quan giảm giá và biên: ${strong('r = ' + nf2.format(prDisc.r))} (n=${prDisc.n}).`;
    if (isFinite(prCost.r)) p3b += ` Giá vốn không đi theo giảm giá (r = ${strong(nf2.format(prCost.r))} với tỷ lệ giá vốn trên giá niêm yết), nên phần lớn mối liên hệ với biên đến từ công thức doanh thu.`;
    p3b += ` Giảm giá TB ${strong(pct(total.disc))} là trung bình cộng từng giao dịch, không nhân theo doanh thu.`;
    const rated0 = mean(rows.filter(d => d.Discount === 0), 'Customer_Rating');
    const rated20 = mean(rows.filter(d => d.Discount >= 20), 'Customer_Rating');
    let p3c = `Điểm TB khi không giảm giá: ${isFinite(rated0) ? strong(nf2.format(rated0)) : '–'}; khi giảm từ 20%: ${isFinite(rated20) ? strong(nf2.format(rated20)) : '–'}.`;
    if (losses.length && losses.every(d => d.Discount >= 25)) p3c += ' Mọi giao dịch lỗ trong lát cắt này đều giảm từ 25% trở lên.';
    p3c += ' Trần giảm giá 15–20% ở mục Kết luận nhằm vào mẫu hình cả năm.';

    const gMonth = group(rows, 'mi');
    const months = [];
    for (let m = 0; m < 12; m++) {
      const a = agg(gMonth.get(m) || []);
      if (a.n) months.push({ m, ...a });
    }
    const hiRevM = [...months].sort((a, b) => b.rev - a.rev)[0];
    const loMarM = [...months].sort((a, b) => a.margin - b.margin)[0];
    const hiDiscM = [...months].sort((a, b) => b.disc - a.disc)[0];
    let p4a = empty;
    if (hiRevM && months.length < 2) {
      p4a = `${strong(MONTH_VI[hiRevM.m])} là tháng duy nhất trong bộ lọc: doanh thu ${strong(tr(hiRevM.rev))}, biên ${strong(pct(hiRevM.margin))}, giảm giá TB ${strong(pct(hiRevM.disc))}, n=${hiRevM.n}.`;
    } else if (hiRevM) {
      p4a = `Doanh thu cao nhất là ${strong(MONTH_VI[hiRevM.m])} (${strong(tr(hiRevM.rev))}, biên ${strong(pct(hiRevM.margin))}, n=${hiRevM.n}). Biên thấp nhất là ${strong(MONTH_VI[loMarM.m])} (${strong(pct(loMarM.margin))}). Giảm giá TB cao nhất là ${strong(MONTH_VI[hiDiscM.m])} (${strong(pct(hiDiscM.disc))}).`;
    }
    let p4b = '';
    if (loMarM && hiDiscM && loMarM.m !== hiDiscM.m) p4b = 'Tháng biên thấp nhất và tháng giảm giá mạnh nhất không trùng nhau. Biên mỏng có thể đến từ cơ cấu hàng, không chỉ từ giảm giá.';
    else if (loMarM && hiDiscM) p4b = 'Trong lát cắt này, tháng biên thấp nhất cũng là tháng giảm giá TB cao nhất.';
    const q4rows = rows.filter(d => d.mi >= 9);
    if (q4rows.length) {
      const q4 = agg(q4rows);
      p4b += ` Phần quý 4 còn trong bộ lọc: ${strong(tr(q4.rev))}, biên ${strong(pct(q4.margin))}, n=${q4.n}.`;
    }
    const qStats = [[0, 2], [3, 5], [6, 8], [9, 11]].map((pair, i) => {
      const complete = [0, 1, 2].every(k => rows.some(d => d.mi === pair[0] + k));
      if (!complete) return null;
      return { i, ...agg(rows.filter(d => d.mi >= pair[0] && d.mi <= pair[1])) };
    }).filter(Boolean);
    if (qStats.length >= 2) {
      const ordered = [...qStats].sort((a, b) => a.margin - b.margin);
      const gap = ordered[1].margin - ordered[0].margin;
      p4b += ` Biên quý thấp nhất trong lát cắt là quý ${ordered[0].i + 1} (${pct(ordered[0].margin)}, n=${ordered[0].n}), thấp hơn quý ${ordered[1].i + 1} ${strong(nf1.format(gap) + ' điểm')}.`;
    }
    const p4c = (state.filters.mFrom <= 10 && state.filters.mTo >= 11)
      ? 'Vùng tô cam là tháng 11–12, không phải cả quý 4. Trục vẫn đủ 12 tháng; tháng ngoài khoảng lọc được làm mờ.'
      : 'Vùng tô tháng 11–12 đang ẩn vì khoảng tháng không gồm cả hai tháng đó. Trục vẫn đủ 12 tháng; tháng ngoài khoảng lọc được làm mờ.';

    const both = rows.filter(d => d.Delivery_Days != null && d.Customer_Rating != null);
    const dayRates = [1, 2, 3, 4].map(k => {
      const v = both.filter(d => d.Delivery_Days === k);
      return { k, n: v.length, rating: v.length ? sum(v, 'Customer_Rating') / v.length : NaN };
    });
    let p5a = 'Điểm trung bình theo số ngày giao (đơn có đủ cả hai trường): ' + dayRates.map(d => d.n ? `${d.k} ngày ${nf2.format(d.rating)} (n=${d.n})` : `${d.k} ngày không có đơn`).join('; ') + '.';
    const prDel = pearson(both, d => d.Delivery_Days, d => d.Customer_Rating);
    if (isFinite(prDel.r) && both.length) {
      const xs = both.map(d => d.Delivery_Days), ys = both.map(d => d.Customer_Rating);
      const n = xs.length, mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
      const den = xs.reduce((s, v) => s + (v - mx) ** 2, 0);
      const slope = den ? xs.reduce((s, v, i) => s + (v - mx) * (ys[i] - my), 0) / den : NaN;
      p5a += ` Tương quan ${strong('r = ' + nf2.format(prDel.r))}` + (isFinite(slope) ? `, độ dốc hồi quy khoảng ${strong(nf2.format(slope))} điểm mỗi ngày thêm` : '') + '. Đây là tương quan, chưa chứng minh nhân quả.';
    }
    const storeDel = STORES.map(s => {
      const known = rows.filter(d => d.Store === s && d.Delivery_Days != null);
      const slow = known.filter(d => d.Delivery_Days >= 3).length;
      return { s, n: known.length, slow: known.length ? slow / known.length * 100 : NaN, rating: mean(rows.filter(d => d.Store === s), 'Customer_Rating') };
    }).filter(x => x.n);
    const slowestStore = [...storeDel].sort((a, b) => b.slow - a.slow)[0];
    let p5b = slowestStore ? `${strong(STORE_VI[slowestStore.s])} có tỷ lệ giao 3–4 ngày cao nhất trong lát cắt (${strong(pct(slowestStore.slow))}, n=${slowestStore.n} đơn đã biết ngày giao), điểm TB ${isFinite(slowestStore.rating) ? strong(nf2.format(slowestStore.rating)) : '–'}.` : '';
    p5b += ' Đường từng chi nhánh bỏ các ô dưới 3 giao dịch để một đơn lẻ không tạo độ dốc giả.';
    const p5c = 'Ưu tiên rút thời gian giao ở chi nhánh đang chậm trong đúng lát cắt này. Khuyến nghị cả năm vẫn nhắm Thủ Đức và Quận 7.';

    const gPay = group(rows, 'Payment_Method');
    const pays = PAYS.map(p => ({ p, ...agg(gPay.get(p) || []) })).filter(x => x.n).sort((a, b) => b.n - a.n);
    const p6a = pays.length ? pays.map(p => `${PAY_VI[p.p]} ${p.n}/${total.n} (${share(p.n, total.n)} giao dịch, ${share(p.rev, total.rev)} doanh thu)`).join('; ') + '.' : empty;
    const gCust = group(rows, 'Customer_Type');
    const custPay = CUSTS.map(t => {
      const rs = gCust.get(t) || [];
      if (!rs.length) return null;
      const ew = rs.filter(d => d.Payment_Method === 'E-wallet').length;
      return `${CUST_VI[t]}: ví điện tử ${pct(ew / rs.length * 100)} (n=${rs.length})`;
    }).filter(Boolean);
    const p6b = custPay.length ? custPay.join('; ') + '.' : empty;
    const topPay = pays[0];
    let p6c = topPay ? `Phương thức đông nhất trong lát cắt này là ${strong(PAY_VI[topPay.p])} (${strong(share(topPay.n, total.n))} giao dịch).` : '';
    p6c += ' Ưu đãi ví điện tử ở mục Kết luận dựa trên cả năm.';

    const gDay = group(rows, 'Day_of_Week');
    const dayStats = DAYS.map((d, i) => ({ d, i, label: DAY_VI[i], ...agg(gDay.get(d) || []) }));
    const present = dayStats.filter(x => x.n);
    const best = [...present].sort((a, b) => b.rev - a.rev)[0];
    const worst = [...present].sort((a, b) => a.rev - b.rev)[0];
    const wd = dayStats.filter(x => x.i < 5 && x.n), we = dayStats.filter(x => x.i >= 5 && x.n);
    let p7a = empty;
    if (best && (present.length < 2 || best.d === worst.d)) {
      p7a = `${strong(best.label)} là ngày duy nhất trong bộ lọc: doanh thu ${strong(tr(best.rev))}, n=${best.n}.`;
    } else if (best) {
      p7a = `${strong(best.label)} có doanh thu cao nhất (${strong(tr(best.rev))}, n=${best.n}). ${strong(worst.label)} thấp nhất (${strong(tr(worst.rev))}, n=${worst.n}).`;
    }
    if (wd.length && we.length) {
      const wdAvg = wd.reduce((s, x) => s + x.rev, 0) / wd.length;
      const weAvg = we.reduce((s, x) => s + x.rev, 0) / we.length;
      const gap = weAvg ? (wdAvg - weAvg) / weAvg * 100 : NaN;
      p7a += ` Trung bình tổng của một thứ trong tuần là ${strong(tr(wdAvg))}, của một ngày cuối tuần là ${strong(tr(weAvg))}` +
        (isFinite(gap) ? `: ngày thường cao hơn cuối tuần ${strong(pct(gap))}` : '') +
        '. Mỗi số là tổng các giao dịch của thứ đó trong bộ lọc, không phải một ngày lịch.';
    }
    const custDay = CUSTS.map(t => {
      const rs = gCust.get(t) || [];
      if (!rs.length) return null;
      const wdr = rs.filter(d => DAYS.indexOf(d.Day_of_Week) < 5);
      const wer = rs.filter(d => DAYS.indexOf(d.Day_of_Week) >= 5);
      const wdNames = new Set(wdr.map(d => d.Day_of_Week)).size;
      const weNames = new Set(wer.map(d => d.Day_of_Week)).size;
      const wdAvg = wdNames ? sum(wdr, 'Revenue') / wdNames : 0;
      const weAvg = weNames ? sum(wer, 'Revenue') / weNames : null;
      return `${CUST_VI[t]} (n=${rs.length}, ${share(sum(rs, 'Revenue'), total.rev)} doanh thu): tổng mỗi thứ ngày thường ${tr(wdAvg)} / mỗi ngày cuối tuần ${weAvg == null ? '–' : tr(weAvg)}`;
    }).filter(Boolean);
    const p7b = custDay.length ? custDay.join('. ') + '.' : empty;
    const p7c = 'Nên bố trí đông vào những ngày đang bán chạy trong lát cắt này. Kết luận cả năm: trung bình tổng năm của một thứ trong tuần cao hơn một ngày cuối tuần 30,5%, đỉnh Thứ 3, đáy Chủ nhật.';

    const topTx = [...rows].sort((a, b) => b.Profit - a.Profit)[0];
    let p8a = `Có ${strong(String(losses.length))} giao dịch lỗ trong ${strong(nf0.format(total.n))} giao dịch đang lọc.`;
    if (topTx) {
      const storeProfit = sum(rows.filter(d => d.Store === topTx.Store), 'Profit');
      const txShare = storeProfit ? topTx.Profit / storeProfit * 100 : NaN;
      p8a += ` Đơn lãi lớn nhất là ${strong(topTx.Transaction_ID)} (${esc(topTx.Product)}, ${esc(STORE_VI[topTx.Store])}, ${strong(tr(topTx.Profit))}` + (isFinite(txShare) ? `, ${strong(pct(txShare))} lợi nhuận của chi nhánh trong lát cắt` : '') + ').';
    }
    const lossStores = STORES.map(s => ({ s, n: rows.filter(d => d.Store === s && d.Profit < 0).length })).filter(x => x.n);
    let p8b = lossStores.length ? 'Giao dịch lỗ theo chi nhánh: ' + lossStores.map(x => `${STORE_VI[x.s]} ${x.n}`).join(', ') + '.' : 'Không có giao dịch lỗ trong lát cắt này.';
    p8b += ` Có ${rows.filter(d => d.Quantity >= 6).length} đơn số lượng từ 6 trở lên.`;
    const p8c = 'Với mẫu nhỏ, một đơn lớn đổi được thứ hạng chi nhánh. Nên xem trung vị và duyệt riêng đơn giảm giá từ 25%.';

    return [[p1a, p1b, p1c], [p2a, p2b, p2c], [p3a, p3b, p3c], [p4a, p4b, p4c], [p5a, p5b, p5c], [p6a, p6b, p6c], [p7a, p7b, p7c], [p8a, p8b, p8c]];
  }
  function renderInsights() {
    if (!insightGroups.length) return;
    if (isFullData()) {
      insightGroups.forEach(({ paras, original }) => paras.forEach((p, i) => { p.innerHTML = original[i]; }));
      return;
    }
    const copy = sliceParagraphs(filtered());
    insightGroups.forEach(({ paras }, i) => paras.forEach((p, j) => { if (copy[i]) p.innerHTML = copy[i][j] || ''; }));
  }

  // =====================================================================
  // Vẽ lại toàn bộ
  // =====================================================================
  function updateAll() {
    renderKpis();
    renderMap();
    renderStoreBars();
    renderCategoryBars();
    renderProducts();
    renderMix();
    renderDiscount();
    renderMonthly();
    renderDelivery();
    renderPayment();
    renderWeekday();
    renderParallel();
    syncPresetButtons();
    renderDataTable();
    renderInsights();
  }

  function rebuildForTheme() {
    Object.keys(charts).forEach(k => { charts[k].dispose(); delete charts[k]; });
    updateAll();
  }
  function initTheme() {
    const root = document.documentElement;
    sel('themeToggle').addEventListener('click', () => {
      const next = isDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      root.dataset.themeSource = 'user';
      try { localStorage.setItem('dv-theme', next); } catch (e) { /* bỏ qua */ }
      rebuildForTheme();
    });
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (root.dataset.themeSource !== 'system') return;
        root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        rebuildForTheme();
      });
    }
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      Object.values(charts).forEach(c => c.resize());
      if (map) map.invalidateSize();
    }, 120);
  });

  initTheme();
  initControls();
  syncControls();
  updateAll();
})();
