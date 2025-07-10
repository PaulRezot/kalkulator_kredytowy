/* global Chart */
document.addEventListener('DOMContentLoaded', () => {

  const form  = document.getElementById('loanForm');
  const resEl = document.getElementById('results');
  const navEl = document.getElementById('scheduleNav');
  const ctx   = document.getElementById('loanChart').getContext('2d');
  const overpayCol = document.getElementById('overpayCol');
  const toggleOverpay = document.getElementById('toggleOverpay');

  let loanChart = null;                      // referencja do aktualnego wykresu

  form.addEventListener('submit', e => {
    e.preventDefault();

    /* ===== dane wejściowe ===== */
    const P     = +document.getElementById('amount').value;
    const rY    = +document.getElementById('interest').value;
    const years = +document.getElementById('years').value;
    const type  = document.getElementById('rateType').value;

    const n = years * 12;
    const r = rY / 100 / 12;

    /* ===== przygotuj daty rat ===== */
    const firstDate = (()=>{           // 1-szy dzień następnego miesiąca
      const d=new Date();
      d.setDate(1);
      d.setMonth(d.getMonth()+1);
      return d;
    })();

    /* ===== obliczenia miesięczne ===== */
    const rows          = [];          // [nr, rata, kapitał, odsetki, saldo, dateObj]
    const saldoArr      = [];
    const odsetkiCumArr = [];

    let headerHTML = '', summaryHTML = '';

    if (type === 'fixed') {            // RATY STAŁE
      const R = P * r * Math.pow(1 + r, n) /
                (Math.pow(1 + r, n) - 1);

      let saldo = P, odsetkiCum = 0;

      for (let i = 0; i < n; i++) {
        const dateObj = new Date(firstDate.getFullYear(),
                                 firstDate.getMonth() + i, 1);

        const odsetki = saldo * r;
        const kapitał = R - odsetki;
        saldo         = Math.max(0, saldo - kapitał);
        odsetkiCum   += odsetki;

        rows.push([i+1, R, kapitał, odsetki, saldo, dateObj]);
        saldoArr.push(saldo);
        odsetkiCumArr.push(odsetkiCum);
      }

      /* --- podsumowanie stałych --- */
      const totalInterest = odsetkiCumArr.at(-1);
      const totalToPay    = P + totalInterest;
      const interestPct   = totalInterest / P * 100;
      const payoffDate    = rows.at(-1)[5].toLocaleDateString(
                              'pl-PL',{month:'long',year:'numeric'});
      const crossIdx      = rows.findIndex(r=>r[2]>r[3]);

      headerHTML  = `<h2>Rata stała: ${R.toFixed(2)} zł</h2>`;
      summaryHTML = `
        <h3>Podsumowanie kredytu</h3>
        <ul>
          <li><strong>Kwota kredytu:</strong> ${P.toLocaleString('pl-PL')} zł</li>
          <li><strong>Łączna kwota do spłaty:</strong> ${totalToPay.toLocaleString('pl-PL')} zł</li>
          <li><strong>Łączne odsetki:</strong> ${totalInterest.toLocaleString('pl-PL')} zł (${interestPct.toFixed(1)} %)</li>
          <li><strong>Liczba rat:</strong> ${n}</li>
          <li><strong>Ostatnia rata:</strong> ${payoffDate}</li>
          <li>W racie nr ${crossIdx+1} (rok ${Math.floor(crossIdx/12)+1}) część kapitałowa przewyższa odsetkową.</li>
        </ul>`;
    }
    else {                              // RATY MALEJĄCE
      const kapStały = P / n;

      let saldo = P, odsetkiCum = 0;

      for (let i = 0; i < n; i++) {
        const dateObj = new Date(firstDate.getFullYear(),
                                 firstDate.getMonth() + i, 1);

        const odsetki = saldo * r;
        const R       = kapStały + odsetki;
        saldo         = Math.max(0, saldo - kapStały);
        odsetkiCum   += odsetki;

        rows.push([i+1, R, kapStały, odsetki, saldo, dateObj]);
        saldoArr.push(saldo);
        odsetkiCumArr.push(odsetkiCum);
      }

      /* --- podsumowanie malejących --- */
      const totalInterest = odsetkiCumArr.at(-1);
      const totalToPay    = P + totalInterest;
      const interestPct   = totalInterest / P * 100;
      const payoffDate    = rows.at(-1)[5].toLocaleDateString(
                              'pl-PL',{month:'long',year:'numeric'});
      const firstPayment  = rows[0][1];
      const lastPayment   = rows.at(-1)[1];
      const avgPayment    = rows.reduce((s,r)=>s+r[1],0)/n;

      headerHTML  = `<h2>Raty malejące – kapitał: ${kapStały.toFixed(2)} zł</h2>`;
      summaryHTML = `
        <h3>Podsumowanie kredytu</h3>
        <ul>
          <li><strong>Kwota kredytu:</strong> ${P.toLocaleString('pl-PL')} zł</li>
          <li><strong>Łączna kwota do spłaty:</strong> ${totalToPay.toLocaleString('pl-PL')} zł</li>
          <li><strong>Łączne odsetki:</strong> ${totalInterest.toLocaleString('pl-PL')} zł (${interestPct.toFixed(1)} %)</li>
          <li><strong>Liczba rat:</strong> ${n}</li>
          <li><strong>Ostatnia rata:</strong> ${payoffDate}</li>
          <li><strong>Pierwsza rata:</strong> ${firstPayment.toFixed(2)} zł,&nbsp;
              <strong>ostatnia:</strong> ${lastPayment.toFixed(2)} zł,&nbsp;
              <strong>średnia:</strong> ${avgPayment.toFixed(2)} zł</li>
        </ul>`;
    }

    /* ===== nagłówek + podsumowanie + placeholder tabeli ===== */
    resEl.innerHTML = headerHTML + summaryHTML + `<div id="scheduleTable"></div>`;

    /* ===== paginacja: 12 rat = 1 rok ===== */
    const pageSize   = 12;
    const totalPages = Math.ceil(rows.length / pageSize);
    let   page       = 0;

    navEl.innerHTML = `
      <div class="nav">
        <button id="prevBtn">‹</button>
        <span id="pageInfo"></span>
        <button id="nextBtn">›</button>
      </div>`;
    const prevBtn  = document.getElementById('prevBtn');
    const nextBtn  = document.getElementById('nextBtn');
    const pageInfo = document.getElementById('pageInfo');
    const tblEl    = document.getElementById('scheduleTable');

    const renderPage = () => {
      const start = page * pageSize;
      const end   = Math.min(start + pageSize, rows.length);

      let html = `<div class="table-wrap"><table><thead><tr>
                    <th>Nr</th><th>Data</th><th>Rata</th><th>Kapitał</th>
                    <th>Odsetki</th><th>Saldo</th>
                  </tr></thead><tbody>`;
      for (let i = start; i < end; i++) {
        const [nr,rata,kap,ods,sal,dateObj] = rows[i];
        const dataTxt = `${String(dateObj.getMonth()+1).padStart(2,'0')}.${dateObj.getFullYear()}`;
        html += `<tr>
                   <td>${nr}</td>
                   <td>${dataTxt}</td>
                   <td>${rata.toFixed(2)}</td>
                   <td>${kap.toFixed(2)}</td>
                   <td>${ods.toFixed(2)}</td>
                   <td>${sal.toFixed(2)}</td>
                 </tr>`;
      }
      html += '</tbody></table></div>';
      tblEl.innerHTML = html;

      pageInfo.textContent = `Rok: ${page + 1} / ${totalPages}`;
      prevBtn.disabled = page === 0;
      nextBtn.disabled = page === totalPages - 1;
    };
    prevBtn.onclick = () => { if (page>0){page--;renderPage();}};
    nextBtn.onclick = () => { if (page<totalPages-1){page++;renderPage();}};
    renderPage();

    /* ===== wykres roczny (stacked bar) ===== */
    if (loanChart) loanChart.destroy();

    // agregacja po roku kalendarzowym
    const byYear = new Map();   // {rok => {kap,ods}}
    rows.forEach(([ , , kap, ods, , dateObj])=>{
      const y = dateObj.getFullYear();
      if (!byYear.has(y)) byYear.set(y,{kap:0,ods:0});
      const o = byYear.get(y);
      o.kap += kap; o.ods += ods;
    });
    const labels = [...byYear.keys()].sort((a,b)=>a-b);
    const kapBar = labels.map(y=>byYear.get(y).kap);
    const odsBar = labels.map(y=>byYear.get(y).ods);

    loanChart = new Chart(ctx,{
      type:'bar',
      data:{
        labels,
        datasets:[
          {label:'Kapitał', data:kapBar, backgroundColor:'#9ba8c4',    stack:'S'},
          {label:'Odsetki', data:odsBar, backgroundColor:'#0043a8', stack:'S'}
        ]
      },
      options:{
        interaction:{mode:'index',intersect:false},
        plugins:{legend:{position:'bottom'}},
        scales:{
          x:{stacked:true,ticks:{maxRotation:40,minRotation:40}},
          y:{
            stacked:true,
            min: 0,
            ticks:{
              stepSize: 5000,
              callback:v=>v.toLocaleString('pl-PL')
            }
          }
        }
      }
    });

    // --- obsługa sekcji nadpłat ---
    const overpayForm = document.getElementById('overpayForm');
    const overpayAmount = document.getElementById('overpayAmount');
    const overpayType = document.getElementById('overpayType');
    const overpayMode = document.getElementById('overpayMode');
    const extraPaymentsList = document.getElementById('extraPaymentsList');
    const extraAmount = document.getElementById('extraAmount');
    const extraDate = document.getElementById('extraDate');
    const extraDateSelect = document.getElementById('extraDateSelect');
    const addExtraBtn = document.getElementById('addExtraBtn');
    const overpaySummary = document.getElementById('overpaySummary');
    const overpaySchedule = document.getElementById('overpaySchedule');

    let extraPayments = [];

    function renderExtraPayments() {
      extraPaymentsList.innerHTML = '';
      extraPayments.forEach((p, idx) => {
        const row = document.createElement('div');
        row.className = 'extra-payment-row';
        const [y, m] = p.date.split('-');
        row.innerHTML = `
          <span>${p.amount.toLocaleString('pl-PL', {minimumFractionDigits: 2, maximumFractionDigits: 2})} zł | ${m}.${y}</span>
          <button type="button" class="small-btn" data-del="${idx}">Usuń</button>
        `;
        extraPaymentsList.appendChild(row);
      });
    }

    const extraMonthSelect = document.getElementById('extraMonthSelect');
    const extraYearSelect = document.getElementById('extraYearSelect');
    // Funkcja do generowania listy miesięcy i lat
    function updateExtraMonthYearOptions() {
      if (!extraMonthSelect || !extraYearSelect) return;
      // Lata
      const years = +document.getElementById('years').value;
      const n = years * 12;
      const firstDate = (()=>{ const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()+1); return d; })();
      const firstYear = firstDate.getFullYear();
      const firstMonth = firstDate.getMonth() + 1;
      const lastDate = new Date(firstDate.getFullYear(), firstDate.getMonth() + n - 1, 1);
      const lastYear = lastDate.getFullYear();
      const lastMonth = lastDate.getMonth() + 1;
      // Ustaw lata
      extraYearSelect.innerHTML = '';
      for (let y = firstYear; y <= lastYear; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        extraYearSelect.appendChild(opt);
      }
      // Ustaw miesiące zależnie od wybranego roku
      function renderMonthsForYear(selectedYear) {
        extraMonthSelect.innerHTML = '';
        const months = [
          '01', '02', '03', '04', '05', '06',
          '07', '08', '09', '10', '11', '12'
        ];
        const monthNames = [
          'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
          'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'
        ];
        let start = 0, end = 12;
        if (+selectedYear === firstYear) start = firstMonth - 1;
        if (+selectedYear === lastYear) end = lastMonth;
        // Zbierz już wybrane miesiące w tym roku
        const taken = new Set(extraPayments.filter(p=>p.date.startsWith(selectedYear+'-')).map(p=>p.date.slice(5,7)));
        for (let i = start; i < end; i++) {
          const opt = document.createElement('option');
          opt.value = months[i];
          opt.textContent = monthNames[i];
          if (taken.has(months[i])) opt.disabled = true;
          extraMonthSelect.appendChild(opt);
        }
      }
      // Po zmianie roku lub lat kredytu, odśwież miesiące
      const selectedYear = extraYearSelect.value || firstYear;
      renderMonthsForYear(selectedYear);
      extraYearSelect.onchange = () => renderMonthsForYear(extraYearSelect.value);
    }
    // Aktualizuj listy przy zmianie lat kredytu lub wpłat
    document.getElementById('years').addEventListener('input', ()=>{ updateExtraMonthYearOptions(); });
    function afterExtraPaymentsChange() { renderExtraPayments(); updateExtraMonthYearOptions(); }
    // --- modyfikacja obsługi dodawania ---
    addExtraBtn && addExtraBtn.addEventListener('click', () => {
      const amount = +extraAmount.value;
      const month = extraMonthSelect.value;
      const year = extraYearSelect.value;
      if (!amount || !month || !year) return;
      // Sprawdź, czy data nie wykracza poza harmonogram
      const years = +document.getElementById('years').value;
      const n = years * 12;
      const firstDate = (()=>{ const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()+1); return d; })();
      const d = new Date(+year, +month-1, 1);
      if (d < firstDate) return;
      const lastDate = new Date(firstDate.getFullYear(), firstDate.getMonth() + n - 1, 1);
      if (d > lastDate) return;
      // Sprawdź, czy nie ma już wpłaty w tym miesiącu/roku
      const val = `${year}-${month}`;
      if (extraPayments.some(p=>p.date===val)) return;
      extraPayments.push({ amount, date: val });
      afterExtraPaymentsChange();
      extraAmount.value = '';
      extraMonthSelect.selectedIndex = 0;
      extraYearSelect.selectedIndex = 0;
    });
    // --- modyfikacja obsługi edycji/usuwania ---
    extraPaymentsList && extraPaymentsList.addEventListener('click', e => {
      if (e.target.tagName === 'BUTTON') {
        const idx = +(e.target.dataset.del ?? e.target.dataset.del);
        if (e.target.dataset.del !== undefined) {
          // Usuwanie
          extraPayments.splice(idx, 1);
          afterExtraPaymentsChange();
        }
      }
    });
    // --- inicjalizacja listy miesięcy i lat ---
    updateExtraMonthYearOptions();

    // --- logika nadpłat i harmonogramu ---
    overpayForm && overpayForm.addEventListener('submit', e => {
      e.preventDefault();
      // Pobierz dane z lewej kolumny
      const P     = +document.getElementById('amount').value;
      const rY    = +document.getElementById('interest').value;
      const years = +document.getElementById('years').value;
      const type  = document.getElementById('rateType').value;
      const n = years * 12;
      const r = rY / 100 / 12;
      // Dane nadpłat
      const overpayVal = +overpayAmount.value;
      const overpayT = overpayType.value;
      const overpayM = overpayMode.value;
      // Skopiuj i posortuj dodatkowe wpłaty
      const extra = [...extraPayments]
        .map(p => ({...p, month: (new Date(p.date+'-01').getFullYear() - (new Date().getFullYear()))*12 + (new Date(p.date+'-01').getMonth() - (new Date().getMonth()+1)) }))
        .filter(p => p.month >= 0 && p.month < n)
        .sort((a,b) => a.month - b.month);
      // Harmonogram z nadpłatami
      let rows = [];
      let saldo = P, odsetkiCum = 0, month = 0, raty = 0, totalOverpay = 0;
      let finished = false;
      let nextExtra = extra.shift();
      let R = 0;
      let kapStały = P / n;
      let origR = 0;
      if (type === 'fixed') {
        origR = P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
        R = origR;
      }
      let maxRaty = n;
      if (type === 'decreasing' && overpayM === 'shorten') {
        maxRaty = n + 100; // pozwól skrócić okres, pętla kończy się na saldo=0
      }
      while (!finished && saldo > 0 && raty < maxRaty) {
        // Nadpłata miesięczna lub jednorazowa
        let nadplata = 0;
        if (overpayT === 'monthly' && overpayVal > 0) nadplata = overpayVal;
        if (overpayT === 'once' && overpayVal > 0 && raty === 0) nadplata = overpayVal;
        // Dodatkowa wpłata w tym miesiącu
        if (nextExtra && nextExtra.month === raty) {
          nadplata += +nextExtra.amount;
          nextExtra = extra.shift();
        }
        // Odsetki
        const odsetki = saldo * r;
        // Kapitał
        let kap = 0;
        if (type === 'fixed') {
          if (overpayM === 'lower') {
            kap = R - odsetki + nadplata;
          } else {
            kap = R - odsetki + nadplata;
          }
        } else {
          kap = kapStały + nadplata;
        }
        // Spłata
        if (kap > saldo) kap = saldo;
        saldo = Math.max(0, saldo - kap);
        odsetkiCum += odsetki;
        totalOverpay += nadplata;
        // Jeśli obniżamy ratę, przelicz R po każdej racie, ale nie doliczaj nadpłaty do raty
        if (type === 'fixed' && overpayM === 'lower' && saldo > 0) {
          const mLeft = n - (raty+1);
          R = saldo * r * Math.pow(1 + r, mLeft) / (Math.pow(1 + r, mLeft) - 1);
        }
        rows.push([
          raty+1,
          type === 'fixed' && overpayM === 'lower' ? R : (type === 'fixed' ? R+nadplata : kap+odsetki),
          kap,
          odsetki,
          saldo,
          new Date((new Date().getFullYear()), (new Date().getMonth()+1)+raty, 1),
          nadplata
        ]);
        raty++;
        if (saldo <= 0.01) finished = true;
      }
      // --- podsumowanie ---
      const payoffDate = rows.at(-1)[5].toLocaleDateString('pl-PL',{month:'long',year:'numeric'});
      const totalInterest = rows.reduce((s,r)=>s+r[3],0);
      const origRows = [];
      let saldoO = P, odsetkiO = 0;
      if (type === 'fixed') {
        for (let i = 0; i < n; i++) {
          const odsetki = saldoO * r;
          const kap = origR - odsetki;
          saldoO = Math.max(0, saldoO - kap);
          odsetkiO += odsetki;
          origRows.push([i+1, origR, kap, odsetki, saldoO]);
        }
      } else {
        for (let i = 0; i < n; i++) {
          const odsetki = saldoO * r;
          const kap = kapStały;
          saldoO = Math.max(0, saldoO - kap);
          odsetkiO += odsetki;
          origRows.push([i+1, kap+odsetki, kap, odsetki, saldoO]);
        }
      }
      const origInterest = odsetkiO;
      const savedInterest = origInterest - totalInterest;
      const savedPct = savedInterest / origInterest * 100;
      const skracanie = (overpayM === 'shorten' && (type === 'fixed' || type === 'decreasing'));
      const ileRat = rows.length;
      const ileMcy = ileRat % 12;
      const ileLat = Math.floor(ileRat / 12);
      const ileZaoszczedzono = n - ileRat;
      // --- wyświetl podsumowanie ---
      overpaySummary.innerHTML = `
        <h3>Podsumowanie z nadpłatami</h3>
        <ul>
          <li><strong>Nowy koniec spłaty:</strong> ${payoffDate}</li>
          <li><strong>Pozostało rat:</strong> ${rows.length}</li>
          <li><strong>Zaoszczędzone odsetki:</strong> ${savedInterest.toLocaleString('pl-PL', {minimumFractionDigits: 2, maximumFractionDigits: 2})} zł (${savedPct.toFixed(2)}%)</li>
          <li><strong>Suma nadpłat:</strong> ${totalOverpay.toLocaleString('pl-PL', {minimumFractionDigits: 2, maximumFractionDigits: 2})} zł</li>
          ${skracanie ? `<li><strong>Okres skrócony o:</strong> ${ileZaoszczedzono} rat (${ileLat} lat, ${ileMcy} mies.)</li>` : ''}
        </ul>
      `;
      // --- wyświetl harmonogram z paginacją ---
      const pageSize = 12;
      let page = 0;
      const totalPages = Math.ceil(rows.length / pageSize);
      function renderOverpayPage() {
        const start = page * pageSize;
        const end = Math.min(start + pageSize, rows.length);
        let html = `<div class=\"table-wrap\"><table><thead><tr>
          <th>Nr</th><th>Data</th><th>Rata</th><th>Kapitał</th><th>Odsetki</th><th>Saldo</th><th>Nadpłata</th>
        </tr></thead><tbody>`;
        for (let i = start; i < end; i++) {
          const [nr, rata, kap, ods, sal, dateObj, nadp] = rows[i];
          const dataTxt = `${String(dateObj.getMonth()+1).padStart(2,'0')}.${dateObj.getFullYear()}`;
          html += `<tr>
            <td>${nr}</td>
            <td>${dataTxt}</td>
            <td>${rata.toFixed(2)}</td>
            <td>${kap.toFixed(2)}</td>
            <td>${ods.toFixed(2)}</td>
            <td>${sal.toFixed(2)}</td>
            <td>${nadp ? nadp.toLocaleString('pl-PL') : ''}</td>
          </tr>`;
        }
        html += '</tbody></table></div>';
        html += `<div class=\"nav\">
          <button id=\"overpayPrevBtn\">‹</button>
          <span id=\"overpayPageInfo\"></span>
          <button id=\"overpayNextBtn\">›</button>
        </div>`;
        overpaySchedule.innerHTML = html;
        document.getElementById('overpayPageInfo').textContent = `Rok: ${page + 1} / ${totalPages}`;
        document.getElementById('overpayPrevBtn').disabled = page === 0;
        document.getElementById('overpayNextBtn').disabled = page === totalPages - 1;
        document.getElementById('overpayPrevBtn').onclick = () => { if (page > 0) { page--; renderOverpayPage(); } };
        document.getElementById('overpayNextBtn').onclick = () => { if (page < totalPages - 1) { page++; renderOverpayPage(); } };
      }
      renderOverpayPage();

      // --- wykres roczny (stacked bar) dla nadpłat ---
      const overpayChartEl = document.getElementById('overpayChart');
      let overpayChart = null;
      if (overpayChart) overpayChart.destroy();
      // agregacja po roku kalendarzowym
      const byYear = new Map();   // {rok => {kap,ods}}
      rows.forEach(([ , , kap, ods, , dateObj])=>{
        const y = dateObj.getFullYear();
        if (!byYear.has(y)) byYear.set(y,{kap:0,ods:0});
        const o = byYear.get(y);
        o.kap += kap; o.ods += ods;
      });
      const labels = [...byYear.keys()].sort((a,b)=>a-b);
      const kapBar = labels.map(y=>byYear.get(y).kap);
      const odsBar = labels.map(y=>byYear.get(y).ods);
      overpayChart = new Chart(overpayChartEl.getContext('2d'),{
        type:'bar',
        data:{
          labels,
          datasets:[
            {label:'Kapitał', data:kapBar, backgroundColor:'#9ba8c4', stack:'S'},
            {label:'Odsetki', data:odsBar, backgroundColor:'#0043a8', stack:'S'}
          ]
        },
        options:{
          interaction:{mode:'index',intersect:false},
          plugins:{legend:{position:'bottom'}},
          scales:{
            x:{stacked:true,ticks:{maxRotation:40,minRotation:40}},
            y:{stacked:true,min:0,ticks:{stepSize:5000,callback:v=>v.toLocaleString('pl-PL')}}
          }
        }
      });
    });
  });

  // ===== KALKULATOR REFINANSOWANIA =====
  const refinancingForm = document.getElementById('refinancingForm');
  const refinancingResults = document.getElementById('refinancingResults');
  const refinancingComparison = document.getElementById('refinancingComparison');
  const refinancingChartEl = document.getElementById('refinancingChart');
  let refinancingChart = null;

  // Obsługa sekcji zmiennego oprocentowania
  const currentRateType = document.getElementById('currentRateType');
  const variableRateSection = document.getElementById('variableRateSection');
  const currentInterest = document.getElementById('currentInterest');
  const currentMargin = document.getElementById('currentMargin');
  const currentWibor = document.getElementById('currentWibor');

  currentRateType.addEventListener('change', () => {
    if (currentRateType.value === 'variable') {
      variableRateSection.style.display = 'block';
      currentInterest.disabled = true;
      currentInterest.value = (+currentMargin.value + +currentWibor.value).toFixed(2);
    } else {
      variableRateSection.style.display = 'none';
      currentInterest.disabled = false;
    }
  });

  currentMargin.addEventListener('input', () => {
    if (currentRateType.value === 'variable') {
      currentInterest.value = (+currentMargin.value + +currentWibor.value).toFixed(2);
    }
  });

  currentWibor.addEventListener('input', () => {
    if (currentRateType.value === 'variable') {
      currentInterest.value = (+currentMargin.value + +currentWibor.value).toFixed(2);
    }
  });

  // Funkcja do obliczania harmonogramu kredytu
  function calculateLoanSchedule(amount, years, interestRate, type) {
    const n = years * 12;
    const r = interestRate / 100 / 12;
    const rows = [];
    let saldo = amount;
    let odsetkiCum = 0;

    if (type === 'fixed') {
      const R = amount * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
      
      for (let i = 0; i < n; i++) {
        const odsetki = saldo * r;
        const kapitał = R - odsetki;
        saldo = Math.max(0, saldo - kapitał);
        odsetkiCum += odsetki;
        
        rows.push([i+1, R, kapitał, odsetki, saldo]);
      }
    } else {
      const kapStały = amount / n;
      
      for (let i = 0; i < n; i++) {
        const odsetki = saldo * r;
        const R = kapStały + odsetki;
        saldo = Math.max(0, saldo - kapStały);
        odsetkiCum += odsetki;
        
        rows.push([i+1, R, kapStały, odsetki, saldo]);
      }
    }

    return {
      rows,
      totalInterest: odsetkiCum,
      totalToPay: amount + odsetkiCum,
      avgPayment: rows.reduce((sum, row) => sum + row[1], 0) / rows.length
    };
  }

  // Funkcja do obliczania nowego harmonogramu po refinansowaniu
  function calculateRefinancingSchedule(currentAmount, currentYears, newInterestRate, newType, refinancingMode) {
    const n = currentYears * 12;
    const r = newInterestRate / 100 / 12;
    const rows = [];
    let saldo = currentAmount;
    let odsetkiCum = 0;

    if (refinancingMode === 'lower') {
      // Obniż ratę, okres bez zmian
      if (newType === 'fixed') {
        const R = currentAmount * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
        
        for (let i = 0; i < n; i++) {
          const odsetki = saldo * r;
          const kapitał = R - odsetki;
          saldo = Math.max(0, saldo - kapitał);
          odsetkiCum += odsetki;
          
          rows.push([i+1, R, kapitał, odsetki, saldo]);
        }
      } else {
        const kapStały = currentAmount / n;
        
        for (let i = 0; i < n; i++) {
          const odsetki = saldo * r;
          const R = kapStały + odsetki;
          saldo = Math.max(0, saldo - kapStały);
          odsetkiCum += odsetki;
          
          rows.push([i+1, R, kapStały, odsetki, saldo]);
        }
      }
    } else {
      // Skróć okres, rata bez zmian
      // Najpierw oblicz średnią ratę z obecnego kredytu
      const currentSchedule = calculateLoanSchedule(currentAmount, currentYears, 
        +currentInterest.value, currentRateType.value);
      const avgCurrentPayment = currentSchedule.avgPayment;
      
      // Oblicz nowy okres przy tej samej racie
      let newN = 0;
      if (newType === 'fixed') {
        // Dla rat stałych - oblicz okres przy tej samej racie
        const monthlyRate = r;
        const payment = avgCurrentPayment;
        const principal = currentAmount;
        
        // Użyj wzoru na okres kredytu
        newN = Math.log(payment / (payment - principal * monthlyRate)) / Math.log(1 + monthlyRate);
        newN = Math.ceil(newN);
      } else {
        // Dla rat malejących - oblicz okres przy tej samej części kapitałowej
        const kapStały = currentAmount / currentYears / 12;
        newN = Math.ceil(currentAmount / kapStały);
      }
      
      // Oblicz harmonogram z nowym okresem
      if (newType === 'fixed') {
        const R = avgCurrentPayment;
        
        for (let i = 0; i < newN; i++) {
          const odsetki = saldo * r;
          const kapitał = R - odsetki;
          saldo = Math.max(0, saldo - kapitał);
          odsetkiCum += odsetki;
          
          rows.push([i+1, R, kapitał, odsetki, saldo]);
          
          if (saldo <= 0.01) break;
        }
      } else {
        const kapStały = currentAmount / newN;
        
        for (let i = 0; i < newN; i++) {
          const odsetki = saldo * r;
          const R = kapStały + odsetki;
          saldo = Math.max(0, saldo - kapStały);
          odsetkiCum += odsetki;
          
          rows.push([i+1, R, kapStały, odsetki, saldo]);
          
          if (saldo <= 0.01) break;
        }
      }
    }

    return {
      rows,
      totalInterest: odsetkiCum,
      totalToPay: currentAmount + odsetkiCum,
      avgPayment: rows.reduce((sum, row) => sum + row[1], 0) / rows.length,
      newPeriod: rows.length
    };
  }

  refinancingForm.addEventListener('submit', e => {
    e.preventDefault();

    // Pobierz dane obecnego kredytu
    const currentAmount = +refinancingForm.querySelector('#currentAmount').value;
    const currentYears = +refinancingForm.querySelector('#currentYears').value;
    const currentRateType2 = refinancingForm.querySelector('#currentRateType2').value;
    const currentInterestRate = +refinancingForm.querySelector('#currentInterest').value;
    const newInterestRate = +refinancingForm.querySelector('#newInterest').value;
    const newType = refinancingForm.querySelector('#newRateType').value;
    const refinancingMode = refinancingForm.querySelector('#refinancingMode').value;

    // Oblicz obecny harmonogram
    const currentSchedule = calculateLoanSchedule(currentAmount, currentYears, currentInterestRate, currentRateType2);
    
    // Oblicz nowy harmonogram
    const newSchedule = calculateRefinancingSchedule(currentAmount, currentYears, newInterestRate, newType, refinancingMode);

    // Oblicz korzyści
    const interestSavings = currentSchedule.totalInterest - newSchedule.totalInterest;
    const interestSavingsPct = (interestSavings / currentSchedule.totalInterest) * 100;
    const paymentSavings = currentSchedule.avgPayment - newSchedule.avgPayment;
    const periodSavings = refinancingMode === 'shorten' ? currentYears * 12 - newSchedule.newPeriod : 0;

    // Wyświetl wyniki
    refinancingResults.innerHTML = `
      <h3>Korzyści z refinansowania</h3>
      <ul>
        <li><strong>Zaoszczędzone odsetki:</strong> ${interestSavings.toLocaleString('pl-PL', {minimumFractionDigits: 2, maximumFractionDigits: 2})} zł (${interestSavingsPct.toFixed(2)}%)</li>
        <li><strong>Obniżenie średniej raty:</strong> ${paymentSavings.toFixed(2)} zł</li>
        ${refinancingMode === 'shorten' ? `<li><strong>Skrócenie okresu o:</strong> ${periodSavings} rat (${Math.floor(periodSavings/12)} lat, ${periodSavings%12} mies.)</li>` : ''}
        <li><strong>Nowa średnia rata:</strong> ${newSchedule.avgPayment.toFixed(2)} zł</li>
        <li><strong>Nowy okres spłaty:</strong> ${Math.floor(newSchedule.newPeriod/12)} lat, ${newSchedule.newPeriod%12} miesięcy</li>
      </ul>
    `;

    // Tabela porównawcza
    refinancingComparison.innerHTML = `
      <div class="comparison-table">
        <table>
          <thead>
            <tr>
              <th>Parametr</th>
              <th>Obecny kredyt</th>
              <th>Po refinansowaniu</th>
              <th>Korzyść</th>
            </tr>
          </thead>
          <tbody>
            <tr class="current">
              <td>Oprocentowanie</td>
              <td>${currentInterestRate.toFixed(2)}%</td>
              <td>${newInterestRate.toFixed(2)}%</td>
              <td class="savings">-${(currentInterestRate - newInterestRate).toFixed(2)} pkt. proc.</td>
            </tr>
            <tr class="new">
              <td>Średnia rata</td>
              <td>${currentSchedule.avgPayment.toFixed(2)} zł</td>
              <td>${newSchedule.avgPayment.toFixed(2)} zł</td>
              <td class="savings">-${paymentSavings.toFixed(2)} zł</td>
            </tr>
            <tr class="current">
              <td>Łączne odsetki</td>
              <td>${currentSchedule.totalInterest.toLocaleString('pl-PL', {minimumFractionDigits: 2, maximumFractionDigits: 2})} zł</td>
              <td>${newSchedule.totalInterest.toLocaleString('pl-PL', {minimumFractionDigits: 2, maximumFractionDigits: 2})} zł</td>
              <td class="savings">-${interestSavings.toLocaleString('pl-PL', {minimumFractionDigits: 2, maximumFractionDigits: 2})} zł</td>
            </tr>
            <tr class="new">
              <td>Okres spłaty</td>
              <td>${currentYears} lat</td>
              <td>${Math.floor(newSchedule.newPeriod/12)} lat, ${newSchedule.newPeriod%12} mies.</td>
              <td class="savings">${refinancingMode === 'shorten' ? `-${Math.floor(periodSavings/12)} lat, -${periodSavings%12} mies.` : 'Bez zmian'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    // Wykres porównawczy
    if (refinancingChart) refinancingChart.destroy();

    const labels = ['Odsetki', 'Kapitał'];
    const currentData = [currentSchedule.totalInterest, currentAmount];
    const newData = [newSchedule.totalInterest, currentAmount];

    refinancingChart = new Chart(refinancingChartEl.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Obecny kredyt',
            data: currentData,
            backgroundColor: '#ff6b6b',
            stack: 'current'
          },
          {
            label: 'Po refinansowaniu',
            data: newData,
            backgroundColor: '#4ecdc4',
            stack: 'new'
          }
        ]
      },
      options: {
        responsive: true,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'bottom'
          },
          title: {
            display: true,
            text: 'Porównanie kosztów kredytu'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return value.toLocaleString('pl-PL') + ' zł';
              }
            }
          }
        }
      }
    });
  });
});