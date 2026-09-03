(function () {
    const RATE = 96;
    const TAX = 18;
    const ANNUAL = { university: 5, community: 8 };
    const CODE_LEN = 6;
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const STORAGE_KEY = 'rsamdio-learn-worksheet-v1';
    const LIVE_SESSION_KEY = 'rsamdio-learn-live-v1';

    const STAGES = [
        { id: 0, label: 'Setup' },
        { id: 1, label: 'Invoice year' },
        { id: 2, label: 'Months' },
        { id: 3, label: 'USD rates' },
        { id: 4, label: 'Local currency' },
        { id: 5, label: 'Roster' },
        { id: 6, label: 'Member dues' },
        { id: 7, label: 'Tax & total' }
    ];

    const state = {
        view: 'landing',
        mode: null,
        roomCode: null,
        roomOpen: true,
        uid: null,
        stage: 0,
        maxReached: 0,
        clubBase: null,
        groupsPassed: {},
        joinedAt: null,
        completedAt: null
    };

    let persistTimer = null;
    let persistReady = false;
    let liveWriteTimer = null;

    const HINTS = {
        'invoice-2026-start-month': 'A January invoice starts at the beginning of the year. Which month is that?',
        'invoice-2026-start-year': 'A January 2026 invoice covers which calendar year?',
        'invoice-2026-end-month': 'A January invoice covers the full calendar year. Which month does that year end?',
        'invoice-2026-end-year': 'Does this invoice cover only 2026, or does it extend into another year?',
        'invoice-2027-start-month': 'A January invoice starts at the beginning of that year. Which month is that?',
        'invoice-2027-start-year': 'A January 2027 invoice covers which calendar year?',
        'invoice-2027-end-month': 'A January invoice covers the full calendar year. Which month does that year end?',
        'invoice-2027-end-year': 'Does this invoice cover only 2027, or does it extend into another year?',
        'months-july': 'They joined on 1 July, so July counts. How many months remain in 2026, including July?',
        'months-aug': 'They joined after the 1st. Start counting from the next month through December.',
        'months-oct': 'They joined after 1 October. What is the first month that counts?',
        'annual-usd': 'Annual dues are $5 per member for University-based clubs and $8 per member for Community-based clubs. Use the club type you selected in Setup.',
        'month-usd': 'Divide the annual dues by 12, then round to two decimal places. Enter exactly two decimals, not the unrounded result.',
        'annual-inr': 'Multiply the rounded annual USD amount by 96, then round the result to two decimal places.',
        'month-inr': 'Multiply the rounded monthly USD amount from the previous stage by 96. Do not use an unrounded calculation such as 5/12 or 8/12.',
        'm1-active': 'Were they an active member on 1 January 2027?',
        'm1-months': 'They joined on 10 February 2026, after the 1st. What is the first countable month? Then count the applicable months through December 2026.',
        'm2-active': 'Are they an active member on the invoice date?',
        'm2-months': 'They joined on 1 July, so July counts. How many countable months are there through December?',
        'm3-active': 'A late-December join is still on the roster on 1 January. Are they an active member on the invoice date?',
        'm3-months': 'They joined on 30 December, after the 1st. Is there a subsequent month within 2026 to count?',
        'm4-active': 'They joined in 2024 and have never left. Are they an active member on 1 January 2027?',
        'm4-months': 'Pro Rata Dues on a January 2027 invoice are based on 2026 months. Did this person join in 2026?',
        'm5-active': 'Compare the leave date with 1 January 2027 to determine whether the member was active on the invoice date.',
        'm5-months': 'The member left on 1 July 2026. Count the applicable months from their effective start through July 2026.',
        'total-active': 'Count only the members you marked “Yes”.',
        'total-months': 'Add the five month values together.',
        'a1': 'If the member is active on 1 January 2027, enter the annual local-currency amount. If not, enter 0.',
        'a2': 'Same rule as Member 1. Are they active on 1 Jan 2027?',
        'a3': 'Same rule. Active on 1 Jan 2027 gets the annual dues amount.',
        'a4': 'Same rule. They joined long before 2026. Are they active on 1 Jan 2027?',
        'a5': 'If they left before 1 January 2027, do they get annual dues on this invoice?',
        'p1': 'Multiply the rounded monthly local-currency amount by the member’s unbilled 2026 months. Keep two decimals.',
        'p2': 'Multiply the rounded monthly local-currency amount by the member’s unbilled 2026 months. Keep two decimals.',
        'p3': 'Multiply the rounded monthly local-currency amount by their unbilled 2026 months. How many months did they have?',
        'p4': 'Multiply the rounded monthly local-currency amount by their unbilled 2026 months. How many months did they have?',
        'p5': 'They can still have Pro Rata Dues for unbilled 2026 months even if they are not active on 1 January 2027. Monthly amount × their unbilled months.',
        'qty-members': 'This should match the total number of active members.',
        'unit-annual': 'Unit price is the annual dues per member in local currency.',
        'tot-annual': 'Active members × annual dues per member in local currency.',
        'qty-months': 'This should match the total Pro Rata Dues months.',
        'unit-prorata': 'Unit price is the monthly Pro Rata Dues amount in local currency.',
        'tot-prorata': 'Total months × monthly Pro Rata Dues amount in local currency.',
        'qty-tax-m': 'Tax on Annual Dues uses the same member quantity.',
        'unit-tax-a': 'For this sample, tax is 18% of the Annual Dues unit price. Round to two decimal places.',
        'tot-tax-a': 'For this sample, tax is 18% of the Annual Dues total. Round to two decimal places.',
        'qty-tax-mo': 'Tax on Pro Rata Dues uses the same month quantity.',
        'unit-tax-p': 'For this sample, tax is 18% of the monthly local-currency unit price. Round to two decimal places, as the raw 18% calculation may have extra digits.',
        'tot-tax-p': 'For this sample, tax is 18% of the Pro Rata Dues total. Round to two decimal places.',
        'grand': 'Add the four already-rounded amounts: Rotaract Dues, Pro Rata Dues, and both local-tax lines.',
        'prev-bal': 'Previous balance carries over from earlier invoices. Unpaid dues increase the amount owed. Credits or overpayments reduce the bill. This sample has no previous balance, so enter 0.',
        'club-bal': 'January–December charges plus previous balance.'
    };

    const GROUP_REFLECT = {
        invoice: {
            ok: 'You got the invoice year right. A January invoice covers the full calendar year, January through December.',
            off: 'A January invoice covers one full calendar year. Check the highlighted dropdowns: start month, start year, end month, and end year.'
        },
        months: {
            ok: 'You got the month counts right. They match the 1st-of-month rule.',
            off: 'Check who joined on the 1st and who joined after the 1st. Count only the remaining months in 2026.'
        },
        'usd-rates': {
            ok: 'You got the USD rates right, rounded to two decimal places. Carry these exact figures to the next stage.',
            off: 'Stay with the club type you selected. Use the annual dues first, then divide by 12 and round to two decimal places. Enter exactly two decimals. Extra digits or different rounding will not pass.'
        },
        inr: {
            ok: 'You got the local-currency conversion right. Your amounts correctly reflect the $1 = 96 exchange rate using your rounded USD figures.',
            off: 'Multiply the rounded USD figures by 96. Do not use the unrounded 5/12 or 8/12 calculations. Round the result to two decimal places.'
        },
        roster: {
            ok: 'You got the roster right. The active flags and month totals are correct for this sample club.',
            off: 'Review each member once more. Were they still active on 1 January 2027? Then recount their applicable 2026 months. Pay special attention to Members 3 and 5, as they are the most common sources of errors.'
        },
        'member-dues': {
            ok: 'You got the per-member amounts right. Now carry these amounts into the invoice table.',
            off: 'Annual dues are all or nothing based on active status on 1 January 2027. Pro Rata Dues = monthly local-currency amount × unbilled 2026 months from the previous invoice. Keep two decimals for every amount.'
        },
        final: {
            ok: 'You built the invoice correctly. You can now confidently explain this table to a club.',
            off: 'Use the same lines as the invoice: Members for Rotaract Dues, Months for Pro Rata Dues, then 18% local tax on each. Add the four totals. Previous balance carries over from earlier invoices: unpaid balances add to the amount owed, while credits reduce it. This sample has a previous balance of 0, so the club balance matches the January–December charges.'
        }
    };

    function money(n) {
        return Math.round(Number(n) * 100) / 100;
    }

    function toCents(n) {
        return Math.round(Number(n) * 100);
    }

    function isTwoDecimalAmount(n) {
        return Math.abs(Number(n) * 100 - Math.round(Number(n) * 100)) < 1e-8;
    }

    function isWholeNumber(n) {
        return Math.abs(Number(n) - Math.round(Number(n))) < 1e-8;
    }

    function expected() {
        const base = state.clubBase;
        if (!base) return null;
        const annualUsd = ANNUAL[base];
        const monthUsd = money(annualUsd / 12);
        const annualInr = money(annualUsd * RATE);
        const monthInr = money(monthUsd * RATE);
        const months = [10, 6, 0, 0, 4];
        const active = [true, true, true, true, false];
        const annuals = active.map((yes) => (yes ? annualInr : 0));
        const proratas = months.map((m) => money(monthInr * m));
        const activeCount = active.filter(Boolean).length;
        const monthSum = months.reduce((a, b) => a + b, 0);
        const totAnnual = money(activeCount * annualInr);
        const totProrata = money(monthSum * monthInr);
        const unitTaxA = money((annualInr * TAX) / 100);
        const unitTaxP = money((monthInr * TAX) / 100);
        const totTaxA = money((totAnnual * TAX) / 100);
        const totTaxP = money((totProrata * TAX) / 100);
        const grand = money(totAnnual + totProrata + totTaxA + totTaxP);

        return {
            'invoice-2026-start-month': { type: 'choice', value: '1' },
            'invoice-2026-start-year': { type: 'choice', value: '2026' },
            'invoice-2026-end-month': { type: 'choice', value: '12' },
            'invoice-2026-end-year': { type: 'choice', value: '2026' },
            'invoice-2027-start-month': { type: 'choice', value: '1' },
            'invoice-2027-start-year': { type: 'choice', value: '2027' },
            'invoice-2027-end-month': { type: 'choice', value: '12' },
            'invoice-2027-end-year': { type: 'choice', value: '2027' },
            'months-july': { type: 'number', value: 6 },
            'months-aug': { type: 'number', value: 4 },
            'months-oct': { type: 'number', value: 2 },
            'annual-usd': { type: 'money', value: annualUsd },
            'month-usd': { type: 'money', value: monthUsd },
            'annual-inr': { type: 'money', value: annualInr },
            'month-inr': { type: 'money', value: monthInr },
            'm1-active': { type: 'choice', value: 'yes' },
            'm2-active': { type: 'choice', value: 'yes' },
            'm3-active': { type: 'choice', value: 'yes' },
            'm4-active': { type: 'choice', value: 'yes' },
            'm5-active': { type: 'choice', value: 'no' },
            'm1-months': { type: 'number', value: 10 },
            'm2-months': { type: 'number', value: 6 },
            'm3-months': { type: 'number', value: 0 },
            'm4-months': { type: 'number', value: 0 },
            'm5-months': { type: 'number', value: 4 },
            'total-active': { type: 'number', value: activeCount },
            'total-months': { type: 'number', value: monthSum },
            a1: { type: 'money', value: annuals[0] },
            a2: { type: 'money', value: annuals[1] },
            a3: { type: 'money', value: annuals[2] },
            a4: { type: 'money', value: annuals[3] },
            a5: { type: 'money', value: annuals[4] },
            p1: { type: 'money', value: proratas[0] },
            p2: { type: 'money', value: proratas[1] },
            p3: { type: 'money', value: proratas[2] },
            p4: { type: 'money', value: proratas[3] },
            p5: { type: 'money', value: proratas[4] },
            'qty-members': { type: 'number', value: activeCount },
            'unit-annual': { type: 'money', value: annualInr },
            'tot-annual': { type: 'money', value: totAnnual },
            'qty-months': { type: 'number', value: monthSum },
            'unit-prorata': { type: 'money', value: monthInr },
            'tot-prorata': { type: 'money', value: totProrata },
            'qty-tax-m': { type: 'number', value: activeCount },
            'unit-tax-a': { type: 'money', value: unitTaxA },
            'tot-tax-a': { type: 'money', value: totTaxA },
            'qty-tax-mo': { type: 'number', value: monthSum },
            'unit-tax-p': { type: 'money', value: unitTaxP },
            'tot-tax-p': { type: 'money', value: totTaxP },
            grand: { type: 'money', value: grand },
            'prev-bal': { type: 'money', value: 0 },
            'club-bal': { type: 'money', value: grand }
        };
    }

    const GROUPS = {
        invoice: [
            'invoice-2026-start-month', 'invoice-2026-start-year', 'invoice-2026-end-month', 'invoice-2026-end-year',
            'invoice-2027-start-month', 'invoice-2027-start-year', 'invoice-2027-end-month', 'invoice-2027-end-year'
        ],
        months: ['months-july', 'months-aug', 'months-oct'],
        'usd-rates': ['annual-usd', 'month-usd'],
        inr: ['annual-inr', 'month-inr'],
        roster: ['m1-active', 'm1-months', 'm2-active', 'm2-months', 'm3-active', 'm3-months', 'm4-active', 'm4-months', 'm5-active', 'm5-months', 'total-active', 'total-months'],
        'member-dues': ['a1', 'a2', 'a3', 'a4', 'a5', 'p1', 'p2', 'p3', 'p4', 'p5'],
        final: ['qty-members', 'unit-annual', 'tot-annual', 'qty-months', 'unit-prorata', 'tot-prorata', 'qty-tax-m', 'unit-tax-a', 'tot-tax-a', 'qty-tax-mo', 'unit-tax-p', 'tot-tax-p', 'grand', 'prev-bal', 'club-bal']
    };

    function fieldEl(key) {
        return document.querySelector('[data-check="' + key + '"]');
    }

    function readValue(el) {
        return String(el.value || '').trim();
    }

    function normalizePhrase(s) {
        return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    }

    function escapeText(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function firstName() {
        const raw = ((document.getElementById('learner-name') || {}).value || '').trim();
        return raw.split(/\s+/)[0] || '';
    }

    function congratulate(rest) {
        const name = firstName();
        return (name ? 'Congratulations, ' + name + '. ' : 'Congratulations. ') + rest;
    }

    function congratsPrefix() {
        const name = firstName();
        return name
            ? 'Congratulations, ' + escapeText(name) + '. '
            : 'Congratulations. ';
    }

    function clubPhrase() {
        if (state.clubBase === 'community') return 'a community-based club';
        if (state.clubBase === 'university') return 'a university-based club';
        return 'your club';
    }

    function clubShortLabel() {
        if (state.clubBase === 'community') return 'Community-Based';
        if (state.clubBase === 'university') return 'Institution / University-Based';
        return 'your club base';
    }

    function normalizeCode(raw) {
        return String(raw || '').replace(/\D/g, '').slice(0, CODE_LEN);
    }

    function otpCells() {
        return Array.from(document.querySelectorAll('.ws-otp-cell'));
    }

    function readJoinCode() {
        return otpCells().map((el) => String(el.value || '').replace(/\D/g, '')).join('').slice(0, CODE_LEN);
    }

    function setJoinCode(code) {
        const digits = normalizeCode(code).split('');
        otpCells().forEach((el, i) => {
            el.value = digits[i] || '';
        });
    }

    function isValidEmail(value) {
        return EMAIL_RE.test(String(value || '').trim());
    }

    function checkOne(key, spec) {
        const el = fieldEl(key);
        if (!el) return { ok: false, empty: true };
        const raw = readValue(el);
        if (!raw) return { ok: false, empty: true };

        if (spec.type === 'phrase') {
            const n = normalizePhrase(raw);
            const ok = spec.needles.every((needle) => n.includes(needle));
            return { ok: ok, empty: false };
        }
        if (spec.type === 'choice') {
            return { ok: raw === spec.value, empty: false };
        }
        const num = Number(raw);
        if (Number.isNaN(num)) return { ok: false, empty: false };
        if (spec.type === 'money') {
            if (!isTwoDecimalAmount(num)) {
                return { ok: false, empty: false, unrounded: true };
            }
            return { ok: toCents(num) === toCents(spec.value), empty: false };
        }
        if (!isWholeNumber(num)) {
            return { ok: false, empty: false, unrounded: true };
        }
        return { ok: Math.round(num) === Math.round(spec.value), empty: false };
    }

    function markField(key, result) {
        const el = fieldEl(key);
        if (!el) return;
        el.classList.remove('is-ok', 'is-off');
        const selectWrap = el.closest('.ws-select');
        if (selectWrap) selectWrap.classList.remove('is-ok', 'is-off');
        const wrap = el.closest('.ws-field');
        const fb = wrap ? wrap.querySelector('.ws-field-feedback') : null;
        if (fb) {
            fb.hidden = true;
            fb.classList.remove('is-ok', 'is-off');
        }
        if (result.empty) return;
        if (result.ok) {
            el.classList.add('is-ok');
            if (selectWrap) selectWrap.classList.add('is-ok');
            if (fb) {
                fb.hidden = false;
                fb.className = 'ws-field-feedback is-ok';
                fb.textContent = 'Looks consistent.';
            }
        } else {
            el.classList.add('is-off');
            if (selectWrap) selectWrap.classList.add('is-off');
            if (fb) {
                fb.hidden = false;
                fb.className = 'ws-field-feedback is-off';
                fb.textContent = result.unrounded
                    ? 'Enter the exact amount to two decimal places. Extra digits will throw off every later total.'
                    : (HINTS[key] || 'Reflect on this one and try again.');
            }
        }
    }

    function checkGroup(groupId) {
        const keys = GROUPS[groupId];
        const specs = expected();
        const reflect = document.querySelector('[data-reflect="' + groupId + '"]');
        if (!specs) {
            if (reflect) {
                reflect.hidden = false;
                reflect.className = 'ws-reflect is-off';
                reflect.textContent = 'Choose a club base in Setup first. Every later number depends on it.';
            }
            return false;
        }

        let allOk = true;
        let anyEmpty = false;
        let wrongCount = 0;
        keys.forEach((key) => {
            const result = checkOne(key, specs[key]);
            markField(key, result);
            if (result.empty) anyEmpty = true;
            if (!result.ok) {
                allOk = false;
                if (!result.empty) wrongCount += 1;
            }
        });

        if (reflect) {
            reflect.hidden = false;
            if (allOk) {
                reflect.className = 'ws-reflect is-ok';
                reflect.textContent = congratulate(GROUP_REFLECT[groupId].ok);
            } else {
                reflect.className = 'ws-reflect is-off';
                if (anyEmpty) {
                    reflect.textContent = 'Fill in every dropdown and field in this stage, then check your entries again.';
                } else if (groupId === 'invoice' && wrongCount) {
                    reflect.textContent = wrongCount === 1
                        ? 'One selection is incorrect. Read the note under the highlighted dropdown and try again.'
                        : wrongCount + ' selections are incorrect. Read the notes under the highlighted dropdowns and try again.';
                } else {
                    reflect.textContent = GROUP_REFLECT[groupId].off;
                }
            }
        }

        const wasFinal = !!state.groupsPassed.final;
        state.groupsPassed[groupId] = allOk;
        if (groupId === 'final') {
            const banner = document.getElementById('complete-banner');
            if (banner) {
                banner.hidden = !allOk;
            }
            if (allOk) {
                if (!state.completedAt) state.completedAt = Date.now();
                if (!wasFinal) {
                    if (state.certificateSubmitted) showCelebration();
                    else openCertificateModal();
                }
            }
        }
        persistSoon();
        updateNav();
        return allOk;
    }

    function selectedOptionLabel(select) {
        const opt = select.options[select.selectedIndex];
        return opt ? String(opt.textContent || '').trim() : '';
    }

    function syncSelectTrigger(select) {
        const wrap = select.closest('.ws-select');
        if (!wrap) return;
        const trigger = wrap.querySelector('.ws-select-trigger');
        if (!trigger) return;
        const label = selectedOptionLabel(select) || 'Select';
        trigger.textContent = label;
        trigger.classList.toggle('is-placeholder', !select.value);
        wrap.querySelectorAll('.ws-select-option').forEach((btn) => {
            btn.classList.toggle('is-selected', btn.getAttribute('data-value') === select.value);
        });
    }

    function closeAllSelects(exceptWrap) {
        document.querySelectorAll('.ws-select.is-open').forEach((wrap) => {
            if (wrap === exceptWrap) return;
            wrap.classList.remove('is-open');
            const menu = wrap.querySelector('.ws-select-menu');
            if (menu) {
                menu.hidden = true;
                menu.style.position = '';
                menu.style.left = '';
                menu.style.top = '';
                menu.style.bottom = '';
                menu.style.width = '';
                menu.style.minWidth = '';
                menu.style.maxHeight = '';
                menu.style.right = '';
                menu.style.zIndex = '';
            }
            const trigger = wrap.querySelector('.ws-select-trigger');
            if (trigger) trigger.setAttribute('aria-expanded', 'false');
        });
    }

    function navBarHeight() {
        const nav = document.querySelector('.ws-nav-bar');
        if (!nav || nav.offsetParent === null) return 0;
        return nav.getBoundingClientRect().height || 0;
    }

    function positionSelectMenu(menu, trigger) {
        const rect = trigger.getBoundingClientRect();
        const gap = 6;
        const gutter = 8;
        const footerPad = navBarHeight() + gutter;
        const spaceBelow = window.innerHeight - rect.bottom - gap - footerPad;
        const spaceAbove = rect.top - gap - gutter;
        menu.style.maxHeight = 'none';
        const preferred = Math.min(menu.scrollHeight, 256);
        const openUp = spaceBelow < preferred && spaceAbove > spaceBelow;
        const available = Math.max(120, openUp ? spaceAbove : spaceBelow);
        const height = Math.min(preferred, available);
        const width = Math.max(rect.width, 148);
        let left = rect.left;
        if (left + width > window.innerWidth - gutter) {
            left = window.innerWidth - width - gutter;
        }

        menu.style.position = 'fixed';
        menu.style.zIndex = '50';
        menu.style.left = Math.max(gutter, left) + 'px';
        menu.style.right = 'auto';
        menu.style.width = rect.width + 'px';
        menu.style.minWidth = width + 'px';
        menu.style.maxHeight = height + 'px';
        if (openUp) {
            menu.style.top = 'auto';
            menu.style.bottom = (window.innerHeight - rect.top + gap) + 'px';
        } else {
            menu.style.bottom = 'auto';
            menu.style.top = (rect.bottom + gap) + 'px';
        }
    }

    function openSelectMenu(wrap) {
        const menu = wrap.querySelector('.ws-select-menu');
        const trigger = wrap.querySelector('.ws-select-trigger');
        const select = wrap.querySelector('select');
        if (!menu || !trigger || !select) return;
        closeAllSelects(wrap);
        wrap.classList.add('is-open');
        menu.hidden = false;
        positionSelectMenu(menu, trigger);
        trigger.setAttribute('aria-expanded', 'true');
        const current = menu.querySelector('.ws-select-option.is-selected') || menu.querySelector('.ws-select-option');
        if (current) current.focus();
    }

    function chooseSelectValue(select, value) {
        select.value = value;
        select.classList.remove('is-ok', 'is-off');
        const wrap = select.closest('.ws-select');
        if (wrap) wrap.classList.remove('is-ok', 'is-off');
        const field = select.closest('.ws-field');
        const fb = field ? field.querySelector('.ws-field-feedback') : null;
        if (fb) {
            fb.hidden = true;
            fb.textContent = '';
        }
        syncSelectTrigger(select);
        select.dispatchEvent(new Event('change', { bubbles: true }));
        closeAllSelects();
    }

    function enhanceSelects() {
        document.querySelectorAll('select[data-check]').forEach((select) => {
            if (select.closest('.ws-select')) return;
            const wrap = document.createElement('div');
            wrap.className = 'ws-select';
            select.parentNode.insertBefore(wrap, select);
            select.classList.add('ws-select-native');
            select.setAttribute('tabindex', '-1');
            wrap.appendChild(select);

            const trigger = document.createElement('button');
            trigger.type = 'button';
            trigger.className = 'ws-select-trigger';
            trigger.setAttribute('aria-haspopup', 'listbox');
            trigger.setAttribute('aria-expanded', 'false');
            wrap.appendChild(trigger);

            const menu = document.createElement('ul');
            menu.className = 'ws-select-menu';
            menu.hidden = true;
            menu.setAttribute('role', 'listbox');
            Array.from(select.options).forEach((opt) => {
                const item = document.createElement('li');
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'ws-select-option' + (opt.value ? '' : ' is-placeholder');
                btn.setAttribute('role', 'option');
                btn.setAttribute('data-value', opt.value);
                btn.textContent = opt.textContent;
                btn.addEventListener('click', () => chooseSelectValue(select, opt.value));
                item.appendChild(btn);
                menu.appendChild(item);
            });
            wrap.appendChild(menu);

            trigger.addEventListener('click', () => {
                if (wrap.classList.contains('is-open')) closeAllSelects();
                else openSelectMenu(wrap);
            });
            trigger.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openSelectMenu(wrap);
                }
            });
            menu.addEventListener('keydown', (e) => {
                const options = Array.from(menu.querySelectorAll('.ws-select-option'));
                const idx = options.indexOf(document.activeElement);
                if (e.key === 'Escape') {
                    e.preventDefault();
                    closeAllSelects();
                    trigger.focus();
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const next = options[Math.min(options.length - 1, idx + 1)] || options[0];
                    next.focus();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prev = options[Math.max(0, idx - 1)] || options[0];
                    prev.focus();
                } else if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (document.activeElement && document.activeElement.getAttribute('data-value') != null) {
                        chooseSelectValue(select, document.activeElement.getAttribute('data-value'));
                        trigger.focus();
                    }
                }
            });
            syncSelectTrigger(select);
        });

        if (!enhanceSelects.boundDoc) {
            enhanceSelects.boundDoc = true;
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.ws-select')) closeAllSelects();
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') closeAllSelects();
            });
            window.addEventListener('scroll', (e) => {
                const menu = e.target && e.target.closest ? e.target.closest('.ws-select-menu') : null;
                if (menu) return;
                closeAllSelects();
            }, true);
            window.addEventListener('resize', () => closeAllSelects());
        }
    }

    function collectFields() {
        const fields = {};
        document.querySelectorAll('[data-check]').forEach((el) => {
            fields[el.getAttribute('data-check')] = el.value;
        });
        return fields;
    }

    function applyFields(fields) {
        if (!fields) return;
        Object.keys(fields).forEach((key) => {
            const el = fieldEl(key);
            if (el && fields[key] !== undefined && fields[key] !== null) {
                el.value = fields[key];
                if (el.tagName === 'SELECT') syncSelectTrigger(el);
            }
        });
    }

    function profileFromForm() {
        const emailEl = document.getElementById('learner-email');
        return {
            name: ((document.getElementById('learner-name') || {}).value || '').trim(),
            email: String((emailEl || {}).value || '').trim().toLowerCase(),
            role: ((document.getElementById('learner-role') || {}).value || '').trim(),
            district: ((document.getElementById('learner-district') || {}).value || '').trim(),
            clubName: ((document.getElementById('club-name') || {}).value || '').trim(),
            clubBase: state.clubBase || ''
        };
    }

    function applyProfile(profile) {
        if (!profile) return;
        const map = {
            'learner-name': profile.name,
            'learner-role': profile.role,
            'learner-email': profile.email,
            'learner-district': profile.district,
            'club-name': profile.clubName
        };
        Object.keys(map).forEach((id) => {
            const el = document.getElementById(id);
            if (el && map[id]) el.value = map[id];
        });
        if (profile.clubBase) state.clubBase = profile.clubBase;
    }

    function persistNow() {
        if (state.mode !== 'self') return;
        try {
            const payload = {
                version: 1,
                savedAt: Date.now(),
                stage: state.stage,
                maxReached: state.maxReached,
                clubBase: state.clubBase,
                groupsPassed: state.groupsPassed,
                learnerName: (document.getElementById('learner-name') || {}).value || '',
                learnerEmail: (document.getElementById('learner-email') || {}).value || '',
                learnerRole: (document.getElementById('learner-role') || {}).value || '',
                learnerDistrict: (document.getElementById('learner-district') || {}).value || '',
                clubName: (document.getElementById('club-name') || {}).value || '',
                certificateSubmitted: state.certificateSubmitted || false,
                fields: collectFields()
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
            setSaveStatus('Progress saved on this device.');
        } catch (err) {
            setSaveStatus('Could not save on this device.');
        }
    }

    function persistSoon() {
        if (!persistReady) return;
        if (state.mode === 'self') {
            setSaveStatus('Saving…');
            clearTimeout(persistTimer);
            persistTimer = setTimeout(persistNow, 200);
        } else if (state.mode === 'live') {
            scheduleLiveWrite();
        }
    }

    function setSaveStatus(text) {
        const el = document.getElementById('save-status');
        if (el) el.textContent = text;
    }

    function applyClubBaseUI() {
        document.querySelectorAll('.ws-choice').forEach((b) => {
            b.classList.toggle('is-selected', b.dataset.base === state.clubBase);
        });
        const status = document.getElementById('base-status');
        if (!status) return;
        if (state.clubBase === 'community') {
            status.textContent = 'Got it. Later stages will use Community-Based rates.';
        } else if (state.clubBase === 'university') {
            status.textContent = 'Got it. Later stages will use Institution / University-Based rates.';
        } else {
            status.textContent = '';
        }
    }

    function applyPersonalization() {
        const name = firstName();
        const prefix = name ? escapeText(name) + ', ' : '';
        const club = clubPhrase();
        const label = document.getElementById('chosen-base-label');
        if (label) label.textContent = clubShortLabel();

        const setup = document.getElementById('lead-setup');
        if (setup) {
            setup.textContent = state.mode === 'live'
                ? 'Your host can see your name, email, and club. Your answers stay private.'
                : 'We’ll use your name and club type in the questions that follow.';
        }

        const invoice = document.getElementById('lead-invoice');
        if (invoice) {
            invoice.textContent = (name ? name + ', ' : '') +
                'a January invoice covers the full calendar year, January through December. You are paying for that calendar year, not for a Rotary Year (July–June).';
        }

        const months = document.getElementById('lead-months');
        if (months) {
            months.innerHTML = (prefix || '') +
                'for a <strong>January 2027</strong> invoice, Pro Rata Dues cover applicable months in <em>2026</em> after the member joined. Count from the <strong>1st of each month</strong>.';
        }

        const usd = document.getElementById('lead-usd');
        if (usd) {
            usd.innerHTML = (prefix || '') + 'for ' + escapeText(club) +
                ', enter only those rates. Round every money amount on this worksheet to two decimal places. You chose <strong id="chosen-base-label">' +
                escapeText(clubShortLabel()) + '</strong>.';
        }

        const rates = expected();
        const cheer = congratsPrefix();

        const inr = document.getElementById('lead-inr');
        if (inr) {
            if (rates) {
                inr.innerHTML = cheer +
                    'you got the USD rates right: <strong>$' + rates['annual-usd'].value.toFixed(2) +
                    '</strong> annual and <strong>$' + rates['month-usd'].value.toFixed(2) +
                    '</strong> per month. Now convert them at <strong>$1 = 96</strong> in local currency.';
            } else {
                inr.innerHTML = (prefix || '') +
                    'this worksheet uses a sample exchange rate of <strong>$1 = 96</strong> in local currency. Multiply each rounded USD amount by 96 to calculate the local currency amount. Do not pick a different rate.';
            }
        }

        const roster = document.getElementById('lead-roster');
        if (roster) {
            roster.innerHTML = (prefix || '') +
                'here are five members. Who is still <strong>active as of 1 January 2027</strong>, and how many months of <strong>2026 Pro Rata Dues</strong> apply to each?';
        }

        const dues = document.getElementById('lead-dues');
        if (dues) {
            if (rates) {
                const annual = rates['annual-inr'].value.toFixed(2);
                const monthly = rates['month-inr'].value.toFixed(2);
                dues.innerHTML = cheer +
                    'you got the local-currency rates right: <strong>' + annual +
                    '</strong> annual and <strong>' + monthly +
                    '</strong> per month. Active members are charged <strong>' + annual +
                    '</strong> for 2027. Pro Rata Dues = <strong>' + monthly +
                    '</strong> × that member\'s unbilled 2026 months.';
            } else {
                dues.innerHTML = (prefix || '') +
                    'use the rounded annual and monthly local-currency amounts from the previous stage. Active members are charged the 2027 annual amount. Pro Rata Dues = monthly amount × unbilled 2026 months (months not billed on the previous January invoice). Keep two decimals.';
            }
        }

        const hintDues = document.getElementById('hint-dues');
        if (hintDues) {
            hintDues.innerHTML = 'Each member card displays their unbilled 2026 months. Those months were not billed on the January 2026 invoice, so they appear as Pro Rata Dues here. Annual dues apply only if the member is active on 1 January 2027. Pro Rata Dues can still apply if a member left during 2026. Keep two decimal places.';
        }

        const fin = document.getElementById('lead-final');
        const hintFinal = document.getElementById('hint-final');
        if (fin) {
            if (rates) {
                const members = rates['total-active'].value;
                const monthsTotal = rates['total-months'].value;
                const annual = rates['annual-inr'].value.toFixed(2);
                const monthly = rates['month-inr'].value.toFixed(2);
                fin.innerHTML = cheer +
                    'you got the roster and rates right. You have <strong>' + members +
                    ' active members</strong> and <strong>' + monthsTotal +
                    ' months</strong> of Pro Rata Dues. Annual Dues are <strong>' + annual +
                    '</strong> and the Pro Rata unit price is <strong>' + monthly +
                    '</strong>. For this sample, the local tax rate is <strong>18%</strong>.';
            } else {
                fin.innerHTML = (prefix || '') +
                    'this uses the same layout as the club invoice. Fill in the quantity, unit price, and total for each line. For this sample, the local tax rate is 18%.';
            }
        }
        if (hintFinal && rates) {
            hintFinal.innerHTML = 'Rotaract Dues quantity is the <strong>' + rates['total-active'].value +
                ' active members</strong>. Pro Rata quantity is the <strong>' + rates['total-months'].value +
                ' unbilled 2026 months</strong>. Unit prices are the Annual Dues and monthly amounts from previous stages. Quantity × unit price = line total. For this sample, tax is 18% of each applicable dues line, not 18% of the grand total. Previous balance carries over from earlier invoices: unpaid dues add to the bill, while credits or overpayments reduce it. This sample club has no previous balance, so enter 0.';
        }
        if (hintFinal && !rates) {
            hintFinal.innerHTML = 'Use your roster totals and the local-currency rates from the previous stages. Quantity × unit price = line total. For this sample, tax is 18% of each applicable dues line, not 18% of the grand total. Previous balance carries over from earlier invoices: unpaid dues add to the bill, while credits or overpayments reduce it. This sample club has no previous balance, so enter 0.';
        }
    }

    function setView(view) {
        state.view = view;
        const landing = document.getElementById('landing');
        const joinPanel = document.getElementById('join-panel');
        if (landing) landing.hidden = view !== 'landing';
        if (joinPanel) joinPanel.hidden = view !== 'join';
        document.body.classList.toggle('is-landing', view === 'landing' || view === 'join');

        if (view !== 'worksheet') {
            document.querySelectorAll('.ws-stage[data-stage]').forEach((sec) => {
                sec.hidden = true;
            });
        }
    }

    function enterSelfPaced() {
        state.mode = 'self';
        state.roomCode = null;
        state.roomOpen = true;
        setView('worksheet');
        applyPersonalization();
        showStage(state.stage || 0);
        setSaveStatus('Progress saved on this device.');
    }

    function showJoinPanel() {
        state.mode = 'live';
        setView('join');
        setSaveStatus('');
        const first = otpCells()[0];
        if (first) first.focus();
    }

    function restoreFromCache() {
        let raw;
        try {
            raw = localStorage.getItem(STORAGE_KEY);
        } catch (err) {
            return false;
        }
        if (!raw) return false;
        let data;
        try {
            data = JSON.parse(raw);
        } catch (err) {
            return false;
        }
        if (!data || data.version !== 1) return false;

        const nameEl = document.getElementById('learner-name');
        const emailEl = document.getElementById('learner-email');
        const roleEl = document.getElementById('learner-role');
        const clubEl = document.getElementById('club-name');
        const districtEl = document.getElementById('learner-district');
        if (nameEl) nameEl.value = data.learnerName || '';
        if (emailEl) emailEl.value = data.learnerEmail || '';
        if (roleEl) roleEl.value = data.learnerRole || '';
        if (clubEl) clubEl.value = data.clubName || '';
        if (districtEl) districtEl.value = data.learnerDistrict || '';

        state.clubBase = data.clubBase || null;
        state.groupsPassed = data.groupsPassed || {};
        state.maxReached = Number(data.maxReached) || 0;
        state.certificateSubmitted = data.certificateSubmitted || false;
        applyFields(data.fields);
        applyClubBaseUI();

        const resumeStage = Math.min(Number(data.stage) || 0, STAGES.length - 1);
        state.stage = resumeStage;
        enterSelfPaced();
        setSaveStatus('Restored from this device.');
        return true;
    }

    function clearWorksheetFields() {
        state.stage = 0;
        state.maxReached = 0;
        state.clubBase = null;
        state.groupsPassed = {};
        state.joinedAt = null;
        state.completedAt = null;
        state.certificateSubmitted = false;
        hideCelebration();
        setJoinCode('');
        ['learner-name', 'learner-role', 'learner-email', 'learner-district', 'club-name'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        document.querySelectorAll('[data-check]').forEach((el) => {
            el.value = '';
            el.classList.remove('is-ok', 'is-off');
            if (el.tagName === 'SELECT') syncSelectTrigger(el);
        });
        document.querySelectorAll('.ws-select').forEach((wrap) => {
            wrap.classList.remove('is-ok', 'is-off', 'is-open');
        });
        document.querySelectorAll('.ws-field-feedback').forEach((fb) => {
            fb.hidden = true;
            fb.textContent = '';
            fb.classList.remove('is-ok', 'is-off');
        });
        document.querySelectorAll('.ws-reflect').forEach((box) => {
            box.hidden = true;
            box.textContent = '';
            box.className = 'ws-reflect';
        });
        const banner = document.getElementById('complete-banner');
        if (banner) banner.hidden = true;
        applyClubBaseUI();
    }

    function leaveLiveSession() {
        clearTimeout(liveWriteTimer);
        try {
            sessionStorage.removeItem(LIVE_SESSION_KEY);
        } catch (err) {
            /* ignore */
        }
        state.mode = null;
        state.roomCode = null;
        state.uid = null;
        state.roomOpen = true;
        state.joinedAt = null;
        state.completedAt = null;
    }

    function showLearnDialog(opts) {
        return new Promise((resolve) => {
            let overlay = document.getElementById('learn-dialog');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'learn-dialog';
                overlay.className = 'host-modal learn-dialog';
                overlay.innerHTML =
                    '<div class="host-modal-card learn-dialog-card" role="dialog" aria-modal="true">' +
                    '<h3 id="learn-dialog-title"></h3>' +
                    '<p id="learn-dialog-message" class="ws-lead"></p>' +
                    '<label id="learn-dialog-field" class="learn-dialog-field" hidden>' +
                    '<span id="learn-dialog-field-label">Name</span>' +
                    '<input id="learn-dialog-input" type="text" maxlength="80">' +
                    '</label>' +
                    '<div class="ws-inline-actions">' +
                    '<button type="button" id="learn-dialog-cancel" class="btn btn-secondary">Cancel</button>' +
                    '<button type="button" id="learn-dialog-confirm" class="btn btn-primary">OK</button>' +
                    '</div></div>';
                document.body.appendChild(overlay);
            }
            const titleEl = overlay.querySelector('#learn-dialog-title');
            const msgEl = overlay.querySelector('#learn-dialog-message');
            const field = overlay.querySelector('#learn-dialog-field');
            const fieldLabel = overlay.querySelector('#learn-dialog-field-label');
            const input = overlay.querySelector('#learn-dialog-input');
            const cancelBtn = overlay.querySelector('#learn-dialog-cancel');
            const confirmBtn = overlay.querySelector('#learn-dialog-confirm');
            titleEl.textContent = opts.title || 'Notice';
            msgEl.textContent = opts.message || '';
            confirmBtn.textContent = opts.confirmLabel || 'OK';
            cancelBtn.textContent = opts.cancelLabel || 'Cancel';
            cancelBtn.hidden = !opts.cancelLabel && !opts.input;
            confirmBtn.className = 'btn ' + (opts.danger ? 'btn-primary' : 'btn-primary');
            if (opts.input) {
                field.hidden = false;
                fieldLabel.textContent = opts.inputLabel || 'Name';
                input.value = opts.inputValue || '';
                input.maxLength = opts.inputMax || 80;
            } else {
                field.hidden = true;
                input.value = '';
            }
            overlay.hidden = false;

            function finish(value) {
                overlay.hidden = true;
                overlay.removeEventListener('click', onOverlay);
                document.removeEventListener('keydown', onKey);
                cancelBtn.removeEventListener('click', onCancel);
                confirmBtn.removeEventListener('click', onConfirm);
                resolve(value);
            }
            function onCancel() { finish(false); }
            function onConfirm() {
                if (opts.input) {
                    const raw = String(input.value || '').trim();
                    finish(raw.slice(0, opts.inputMax || 80) || (opts.inputValue || ''));
                    return;
                }
                finish(true);
            }
            function onOverlay(e) {
                if (e.target === overlay) onCancel();
            }
            function onKey(e) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    onCancel();
                } else if (e.key === 'Enter' && opts.input) {
                    e.preventDefault();
                    onConfirm();
                }
            }
            overlay.addEventListener('click', onOverlay);
            document.addEventListener('keydown', onKey);
            cancelBtn.addEventListener('click', onCancel);
            confirmBtn.addEventListener('click', onConfirm);
            setTimeout(() => {
                if (opts.input) input.focus();
                else confirmBtn.focus();
            }, 0);
        });
    }

    function hideCelebration() {
        const el = document.getElementById('ws-celebrate');
        if (el) el.hidden = true;
    }

    function hideCertificateModal() {
        const el = document.getElementById('ws-certificate-modal');
        if (el) el.hidden = true;
    }

    function openCertificateModal() {
        if (state.certificateSubmitted) {
            showCelebration();
            return;
        }
        const modal = document.getElementById('ws-certificate-modal');
        if (!modal) return;
        
        const profile = profileFromForm();
        const nameInput = document.getElementById('cert-name');
        const emailInput = document.getElementById('cert-email');
        const roleInput = document.getElementById('cert-role');
        const districtInput = document.getElementById('cert-district');
        const clubInput = document.getElementById('cert-club');

        if (nameInput) nameInput.value = profile.name;
        if (emailInput) emailInput.value = profile.email;
        if (roleInput) roleInput.value = profile.role || '';
        if (districtInput) districtInput.value = profile.district || '';
        if (clubInput) clubInput.value = profile.clubName || '';
        
        document.getElementById('ws-cert-form').hidden = false;
        document.getElementById('ws-cert-success').hidden = true;
        
        modal.hidden = false;
    }

    async function submitCertificate() {
        if (state.certificateSubmitted) return;
        
        const modalName = ((document.getElementById('cert-name') || {}).value || '').trim();
        const modalEmail = ((document.getElementById('cert-email') || {}).value || '').trim().toLowerCase();
        const modalRole = ((document.getElementById('cert-role') || {}).value || '').trim();
        const modalDistrict = ((document.getElementById('cert-district') || {}).value || '').trim();
        const modalClub = ((document.getElementById('cert-club') || {}).value || '').trim();

        if (!modalName || !isValidEmail(modalEmail)) {
            alert("Name and valid email are required.");
            return;
        }

        const nameEl = document.getElementById('learner-name');
        if (nameEl) nameEl.value = modalName;
        const emailEl = document.getElementById('learner-email');
        if (emailEl) emailEl.value = modalEmail;
        const roleEl = document.getElementById('learner-role');
        if (roleEl) roleEl.value = modalRole;
        const districtEl = document.getElementById('learner-district');
        if (districtEl) districtEl.value = modalDistrict;
        const clubEl = document.getElementById('club-name');
        if (clubEl) clubEl.value = modalClub;
        
        const btn = document.getElementById('ws-cert-submit');
        const originalText = btn.textContent;
        btn.textContent = 'Submitting...';
        btn.classList.add('ws-btn-loading');
        btn.disabled = true;
        
        try {
            let fb = await waitForLearnFirebase();
            let user = await ensureAnonymousUser(fb);
            
            const payload = {
                uid: user.uid,
                name: modalName,
                email: modalEmail,
                role: modalRole,
                district: modalDistrict,
                clubName: modalClub,
                clubBase: state.clubBase || '',
                mode: state.mode,
                roomCode: state.roomCode || null,
                completedAt: state.completedAt
            };
            
            // Call the HTTPS Callable Cloud Function instead of writing to RTDB directly
            const submitCertFunc = window.learnFirebase.httpsCallable(window.learnFirebase.functions, 'submitCertificate');
            await submitCertFunc(payload);
            
            if (state.mode === 'live' && state.roomCode) {
                await fb.update(participantPath(fb, user.uid), { certificateSubmitted: true });
            }
            
            state.certificateSubmitted = true;
            persistSoon();
            
            document.getElementById('ws-cert-form').hidden = true;
            document.getElementById('ws-cert-success').hidden = false;
            
            const certTitle = document.getElementById('ws-cert-title');
            if (certTitle) certTitle.textContent = "You're All Set!";
            const certBody = document.getElementById('ws-cert-body');
            if (certBody) certBody.textContent = "Your details have been submitted successfully. You can now claim your certificate on Rotaract Certify, or close this dialog to review the worksheet stages and refresh your memory.";
            
            const bannerBtn = document.querySelector('#complete-banner #btn-banner-cert');
            if (bannerBtn) {
                bannerBtn.textContent = 'View Certificate Status';
            }
            
        } catch (err) {
            console.error("Submit error", err);
            // Firebase Callable Functions return the error message thrown by HttpsError
            alert(err.message || "Failed to submit. Please try again.");
        } finally {
            btn.textContent = originalText;
            btn.classList.remove('ws-btn-loading');
            btn.disabled = false;
        }
    }

    function showCelebration() {
        const overlay = document.getElementById('ws-celebrate');
        if (!overlay) return;
        const title = document.getElementById('ws-celebrate-title');
        const body = document.getElementById('ws-celebrate-body');
        const name = ((document.getElementById('learner-name') || {}).value || '').trim();
        if (title) title.textContent = name ? ('Congratulations, ' + name) : 'Congratulations';
        if (body) {
            body.textContent = state.mode === 'live'
                ? 'You finished all eight stages. You can stay in the room. Your host can see that you’ve finished.'
                : 'You finished all eight stages: invoice year, months, rates, local currency, roster, member dues, tax, and totals. Next, try the live calculator with your own club.';
        }
        overlay.hidden = false;
        const closeBtn = document.getElementById('ws-celebrate-close');
        if (closeBtn) closeBtn.focus();
    }

    async function resetWorksheet() {
        const liveNote = state.mode === 'live'
            ? ' You will also leave this session (your host may still see what you already sent).'
            : '';
        const ok = await showLearnDialog({
            title: 'Start over?',
            message: 'This clears what you typed on this device.' + liveNote,
            confirmLabel: 'Start over',
            cancelLabel: 'Cancel',
            danger: true
        });
        if (!ok) return;
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (err) {
            /* ignore */
        }
        leaveLiveSession();
        clearWorksheetFields();
        setView('landing');
        setSaveStatus('Worksheet cleared');
    }

    function renderNav() {
        const ol = document.getElementById('stage-nav');
        if (!ol) return;
        ol.innerHTML = '';
        STAGES.forEach((s) => {
            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = (s.id + 1) + '. ' + s.label;
            btn.disabled = s.id > state.maxReached;
            if (s.id === state.stage) btn.classList.add('is-current');
            else if (s.id < state.stage) btn.classList.add('is-done');
            btn.addEventListener('click', () => {
                if (s.id <= state.maxReached) showStage(s.id);
            });
            li.appendChild(btn);
            ol.appendChild(li);
        });
    }

    function showStage(n) {
        state.stage = n;
        persistSoon();
        document.querySelectorAll('.ws-stage[data-stage]').forEach((sec) => {
            sec.hidden = Number(sec.dataset.stage) !== n;
        });
        applyPersonalization();
        renderNav();
        updateNav();
        closeAllSelects();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function canLeaveSetup() {
        const name = ((document.getElementById('learner-name') || {}).value || '').trim();
        const email = ((document.getElementById('learner-email') || {}).value || '').trim();
        if (!name || !state.clubBase || !isValidEmail(email)) return false;
        if (state.mode === 'live') {
            const district = ((document.getElementById('learner-district') || {}).value || '').trim();
            const club = ((document.getElementById('club-name') || {}).value || '').trim();
            return Boolean(district && club);
        }
        return true;
    }

    function updateNav() {
        const banner = document.getElementById('complete-banner');
        if (banner) {
            banner.hidden = !state.groupsPassed.final;
            const btn = banner.querySelector('#btn-banner-cert');
            if (btn) {
                btn.textContent = state.certificateSubmitted ? 'View Certificate Status' : 'Claim your certificate';
            }
        }
        const prev = document.getElementById('btn-prev');
        const next = document.getElementById('btn-next');
        const hint = document.getElementById('nav-hint');
        if (!prev || !next || !hint) return;
        prev.disabled = state.stage === 0;
        next.disabled = state.stage === STAGES.length - 1;

        if (state.stage === 0) {
            next.disabled = !canLeaveSetup();
            const name = ((document.getElementById('learner-name') || {}).value || '').trim();
            const email = ((document.getElementById('learner-email') || {}).value || '').trim();
            if (state.mode === 'live') {
                hint.textContent = canLeaveSetup()
                    ? 'Continue when you are ready.'
                    : (!state.clubBase && name && isValidEmail(email)
                        ? 'Select your club base: institution-based or community-based.'
                        : 'Enter your name, email, district, club, and club base to continue.');
            } else {
                hint.textContent = canLeaveSetup()
                    ? 'Continue when you are ready.'
                    : (!state.clubBase && name && isValidEmail(email)
                        ? 'Select your club base: institution-based or community-based.'
                        : 'Enter your name, email, and select a club base to continue.');
            }
            return;
        }

        const groupByStage = {
            1: 'invoice',
            2: 'months',
            3: 'usd-rates',
            4: 'inr',
            5: 'roster',
            6: 'member-dues',
            7: 'final'
        };
        const g = groupByStage[state.stage];
        if (state.stage < 7) {
            next.disabled = !state.groupsPassed[g];
            hint.textContent = state.groupsPassed[g]
                ? 'Looks good. Continue when you are ready.'
                : 'Check your answers for this stage before continuing.';
        } else {
            hint.textContent = state.groupsPassed.final
                ? 'You can revisit any earlier stage at any time.'
                : 'Check the final table when you are ready.';
        }
    }

    function waitForLearnFirebase() {
        return new Promise((resolve, reject) => {
            if (window.learnFirebase) {
                resolve(window.learnFirebase);
                return;
            }
            let tries = 0;
            const timer = setInterval(() => {
                tries += 1;
                if (window.learnFirebase) {
                    clearInterval(timer);
                    resolve(window.learnFirebase);
                } else if (tries > 80) {
                    clearInterval(timer);
                    reject(new Error('offline'));
                }
            }, 50);
        });
    }

    function participantPath(fb, uid) {
        return fb.ref(fb.db, 'rooms/' + state.roomCode + '/participants/' + uid);
    }

    function buildLivePayload() {
        if (!state.joinedAt) state.joinedAt = Date.now();
        if (state.groupsPassed.final && !state.completedAt) state.completedAt = Date.now();
        const progress = {
            stage: state.stage,
            maxReached: state.maxReached,
            groupsPassed: state.groupsPassed,
            updatedAt: Date.now(),
            joinedAt: state.joinedAt
        };
        if (state.completedAt) progress.completedAt = state.completedAt;
        return {
            profile: profileFromForm(),
            progress: progress,
            fields: collectFields()
        };
    }

    async function writeLiveNow() {
        if (state.mode !== 'live' || !state.roomCode || !state.uid || !state.roomOpen) return;
        let fb;
        try {
            fb = await waitForLearnFirebase();
        } catch (err) {
            return;
        }
        try {
            await fb.set(participantPath(fb, state.uid), buildLivePayload());
            setSaveStatus('You’re in session ' + state.roomCode + '. Your answers are only yours.');
        } catch (err) {
            state.roomOpen = false;
            setSaveStatus('This session has ended. You can still review what you typed.');
        }
    }

    function scheduleLiveWrite() {
        if (state.mode !== 'live' || !state.roomOpen) return;
        clearTimeout(liveWriteTimer);
        liveWriteTimer = setTimeout(writeLiveNow, 400);
    }

    async function ensureAnonymousUser(fb) {
        if (fb.auth.currentUser) return fb.auth.currentUser;
        const cred = await fb.signInAnonymously(fb.auth);
        return cred.user;
    }

    function rememberLiveSession() {
        try {
            sessionStorage.setItem(LIVE_SESSION_KEY, JSON.stringify({ roomCode: state.roomCode }));
        } catch (err) {
            /* ignore */
        }
    }

    function readLiveSession() {
        try {
            const raw = sessionStorage.getItem(LIVE_SESSION_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            const code = normalizeCode(data && data.roomCode);
            return code.length === CODE_LEN ? code : null;
        } catch (err) {
            return null;
        }
    }

    function showJoinError(message) {
        const box = document.getElementById('join-error');
        if (!box) return;
        if (!message) {
            box.hidden = true;
            box.textContent = '';
            return;
        }
        box.hidden = false;
        box.textContent = message;
    }

    async function joinLiveRoom(code) {
        const normalized = normalizeCode(code);
        if (normalized.length !== CODE_LEN) {
            showJoinError('Enter the 6-digit code from the host’s screen.');
            return false;
        }

        let fb;
        try {
            fb = await waitForLearnFirebase();
        } catch (err) {
            showJoinError('Could not reach the session. Check your connection and try again.');
            return false;
        }

        let user;
        try {
            user = await ensureAnonymousUser(fb);
        } catch (err) {
            showJoinError('Could not join the session. Ask your host to try again in a moment.');
            return false;
        }

        let metaSnap;
        try {
            metaSnap = await fb.get(fb.ref(fb.db, 'rooms/' + normalized + '/meta'));
        } catch (err) {
            showJoinError('Could not reach the session. Check your connection and try again.');
            return false;
        }

        if (!metaSnap.exists()) {
            showJoinError('We could not find that session. Check the code and try again.');
            return false;
        }

        const meta = metaSnap.val() || {};
        const isOpen = meta.status === 'open';

        state.mode = 'live';
        state.roomCode = normalized;
        state.uid = user.uid;
        state.roomOpen = isOpen;
        rememberLiveSession();

        let existing = null;
        try {
            const mine = await fb.get(participantPath(fb, user.uid));
            if (mine.exists()) existing = mine.val();
        } catch (err) {
            existing = null;
        }

        if (!isOpen && !existing) {
            showJoinError('This session has ended. Ask your host for a new code.');
            leaveLiveSession();
            return false;
        }

        if (existing) {
            applyProfile(existing.profile);
            if (existing.progress) {
                state.groupsPassed = existing.progress.groupsPassed || {};
                state.maxReached = Number(existing.progress.maxReached) || 0;
                state.stage = Math.min(Number(existing.progress.stage) || 0, STAGES.length - 1);
                state.joinedAt = Number(existing.progress.joinedAt) || Date.now();
                state.completedAt = Number(existing.progress.completedAt) || null;
            } else {
                state.joinedAt = Date.now();
                state.completedAt = null;
            }
            if (existing.profile && existing.profile.clubBase) state.clubBase = existing.profile.clubBase;
            applyFields(existing.fields);
            applyClubBaseUI();
        } else {
            state.joinedAt = Date.now();
            state.completedAt = null;
        }

        showJoinError('');
        setView('worksheet');
        applyPersonalization();
        showStage(state.stage || 0);
        setSaveStatus(isOpen
            ? 'You’re in session ' + state.roomCode + '. Your answers are only yours.'
            : 'This session has ended. You can still review what you typed.');
        if (isOpen) scheduleLiveWrite();
        return true;
    }

    function bindChoices() {
        document.querySelectorAll('.ws-choice').forEach((btn) => {
            btn.addEventListener('click', () => {
                state.clubBase = btn.dataset.base;
                document.querySelectorAll('.ws-choice').forEach((b) => b.classList.toggle('is-selected', b === btn));
                const status = document.getElementById('base-status');
                if (status) {
                status.textContent = btn.dataset.base === 'community'
                    ? 'Got it. Later stages will use Community-Based rates.'
                    : 'Got it. Later stages will use Institution / University-Based rates.';
                }
                Object.keys(state.groupsPassed).forEach((k) => {
                    if (k !== 'invoice' && k !== 'months') state.groupsPassed[k] = false;
                });
                applyPersonalization();
                persistSoon();
                updateNav();
            });
        });
    }

    function bindChecks() {
        document.querySelectorAll('.ws-check-btn').forEach((btn) => {
            btn.addEventListener('click', () => checkGroup(btn.dataset.checkGroup));
        });
    }

    function bindLanding() {
        const selfBtn = document.getElementById('btn-self-pace');
        const liveBtn = document.getElementById('btn-join-live');
        const joinGo = document.getElementById('btn-join-go');
        const joinBack = document.getElementById('btn-join-back');
        const cells = otpCells();

        if (selfBtn) selfBtn.addEventListener('click', enterSelfPaced);
        if (liveBtn) liveBtn.addEventListener('click', showJoinPanel);
        if (joinBack) {
            joinBack.addEventListener('click', () => {
                state.mode = null;
                showJoinError('');
                setView('landing');
            });
        }
        if (joinGo) {
            joinGo.addEventListener('click', () => {
                joinLiveRoom(readJoinCode());
            });
        }
        cells.forEach((cell, i) => {
            cell.addEventListener('input', () => {
                const raw = String(cell.value || '').replace(/\D/g, '');
                if (raw.length > 1) {
                    setJoinCode((readJoinCode().slice(0, i) + raw).slice(0, CODE_LEN));
                    const filled = readJoinCode().length;
                    cells[Math.min(filled, CODE_LEN - 1)].focus();
                    return;
                }
                cell.value = raw.slice(-1);
                if (cell.value && i < cells.length - 1) cells[i + 1].focus();
            });
            cell.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !cell.value && i > 0) {
                    e.preventDefault();
                    cells[i - 1].value = '';
                    cells[i - 1].focus();
                } else if (e.key === 'ArrowLeft' && i > 0) {
                    e.preventDefault();
                    cells[i - 1].focus();
                } else if (e.key === 'ArrowRight' && i < cells.length - 1) {
                    e.preventDefault();
                    cells[i + 1].focus();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    joinLiveRoom(readJoinCode());
                }
            });
            cell.addEventListener('paste', (e) => {
                const text = (e.clipboardData || window.clipboardData).getData('text');
                const digits = normalizeCode(text);
                if (!digits) return;
                e.preventDefault();
                setJoinCode(digits);
                cells[Math.min(digits.length, CODE_LEN - 1)].focus();
            });
            cell.addEventListener('focus', () => cell.select());
        });
    }

    document.getElementById('btn-prev').addEventListener('click', () => {
        if (state.stage > 0) showStage(state.stage - 1);
    });

    document.getElementById('btn-next').addEventListener('click', () => {
        if (state.stage === 0 && !canLeaveSetup()) return;
        if (state.stage < STAGES.length - 1) {
            state.maxReached = Math.max(state.maxReached, state.stage + 1);
            showStage(state.stage + 1);
        }
    });

    ['learner-name', 'learner-role', 'learner-email', 'learner-district', 'club-name'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => {
            applyPersonalization();
            persistSoon();
            updateNav();
        });
    });

    document.querySelectorAll('[data-check]').forEach((el) => {
        el.addEventListener('input', persistSoon);
        el.addEventListener('change', persistSoon);
    });

    const resetBtn = document.getElementById('btn-reset');
    if (resetBtn) resetBtn.addEventListener('click', resetWorksheet);

    const celebrate = document.getElementById('ws-celebrate');
    const celebrateClose = document.getElementById('ws-celebrate-close');
    if (celebrateClose) celebrateClose.addEventListener('click', hideCelebration);
    if (celebrate) {
        celebrate.addEventListener('click', (e) => {
            if (e.target === celebrate) hideCelebration();
        });
    }

    const certModal = document.getElementById('ws-certificate-modal');
    if (certModal) {
        certModal.addEventListener('click', (e) => {
            if (e.target === certModal) hideCertificateModal();
        });
    }
    const certCancel = document.getElementById('ws-cert-cancel');
    if (certCancel) certCancel.addEventListener('click', hideCertificateModal);
    const certSubmit = document.getElementById('ws-cert-submit');
    if (certSubmit) certSubmit.addEventListener('click', submitCertificate);
    const certCloseSuccess = document.getElementById('ws-cert-close-success');
    if (certCloseSuccess) certCloseSuccess.addEventListener('click', hideCertificateModal);

    const bannerBtn = document.querySelector('#complete-banner #btn-banner-cert');
    if (bannerBtn) {
        bannerBtn.addEventListener('click', () => {
            if (state.certificateSubmitted) {
                window.open('https://certify.rsamdio.org/clubinvoicebasics/', '_blank');
            } else {
                openCertificateModal();
            }
        });
    }

    bindLanding();
    bindChoices();
    bindChecks();
    enhanceSelects();
    persistReady = true;

    const pendingLive = readLiveSession();
    if (pendingLive) {
        joinLiveRoom(pendingLive);
    } else if (!restoreFromCache()) {
        setView('landing');
    }
})();

/* ============================================================
   WORKSHEET CALCULATOR — standalone IIFE
   Implements all audit fixes from the implementation plan.
   No globals exposed. Fully encapsulated.
   ============================================================ */
(function () {
    'use strict';

    // ── State ────────────────────────────────────────────────
    var calc = {
        displayValue: '0',    // string shown on screen
        previousValue: 0,     // number stored before operator
        currentOp: null,      // 'add'|'subtract'|'multiply'|'divide'|null
        historyText: '',      // secondary expression display
        waitingForOperand: false, // replace display on next digit
        isOpen: false         // tracks widget visibility (Bug 5)
    };

    // ── DOM refs (resolved once after DOMContentLoaded) ──────
    var elFab, elWidget, elClose, elDisplay, elHistory, elCopyBtn, elKeypad;
    var copyTimer = null;

    // ── Math helper ──────────────────────────────────────────
    // Strips floating-point noise: 0.1+0.2 => 0.3, not 0.30000000000000004
    function sanitize(n) {
        return Math.round(n * 1e10) / 1e10;
    }

    // ── Display update ───────────────────────────────────────
    function render() {
        if (!elDisplay) return;
        elDisplay.textContent = calc.displayValue;
        elDisplay.classList.toggle('is-error', calc.displayValue === 'Error');
        if (elHistory) elHistory.textContent = calc.historyText;
        // Highlight active operator on keypad
        if (elKeypad) {
            var ops = elKeypad.querySelectorAll('.ws-calc-op');
            ops.forEach(function (btn) {
                var active = calc.waitingForOperand && calc.currentOp === btn.dataset.calc;
                btn.classList.toggle('is-active', active);
            });
        }
    }

    // ── Core calculator methods ───────────────────────────────

    function inputDigit(digit) {
        if (calc.displayValue === 'Error') { clearAll(); }
        if (calc.waitingForOperand) {
            calc.displayValue = String(digit);
            calc.waitingForOperand = false;
        } else {
            // Prevent overflow: cap at 12 characters
            if (calc.displayValue.replace('-', '').replace('.', '').length >= 12) return;
            calc.displayValue = (calc.displayValue === '0')
                ? String(digit)
                : calc.displayValue + String(digit);
        }
        render();
    }

    function inputDecimal() {
        if (calc.displayValue === 'Error') { clearAll(); }
        if (calc.waitingForOperand) {
            calc.displayValue = '0.';
            calc.waitingForOperand = false;
            render();
            return;
        }
        // Bug 8 fix: guard against duplicate decimal point
        if (calc.displayValue.indexOf('.') !== -1) return;
        calc.displayValue += '.';
        render();
    }

    function evaluate() {
        // Returns result number or null if nothing to evaluate
        var prev = calc.previousValue;
        var curr = parseFloat(calc.displayValue);
        if (isNaN(curr)) return null;
        var result;
        switch (calc.currentOp) {
            case 'add':      result = sanitize(prev + curr); break;
            case 'subtract': result = sanitize(prev - curr); break;
            case 'multiply': result = sanitize(prev * curr); break;
            case 'divide':
                // Division by zero guard
                if (curr === 0) {
                    calc.displayValue = 'Error';
                    calc.historyText = '';
                    calc.previousValue = 0;
                    calc.currentOp = null;
                    calc.waitingForOperand = false;
                    render();
                    return null;
                }
                result = sanitize(prev / curr);
                break;
            default:
                return parseFloat(calc.displayValue);
        }
        return result;
    }

    function handleOperator(op) {
        if (calc.displayValue === 'Error') { clearAll(); return; }
        var curr = parseFloat(calc.displayValue);
        if (calc.currentOp && !calc.waitingForOperand) {
            // Chain: finish previous operation first
            var result = evaluate();
            if (result === null) return;
            calc.historyText = String(result) + ' ' + opSymbol(op);
            calc.displayValue = String(result);
            calc.previousValue = result;
        } else {
            calc.historyText = String(curr) + ' ' + opSymbol(op);
            calc.previousValue = curr;
        }
        calc.currentOp = op;
        calc.waitingForOperand = true;
        render();
    }

    function handleEquals() {
        if (calc.displayValue === 'Error') { clearAll(); return; }
        if (!calc.currentOp) return;
        var curr = parseFloat(calc.displayValue);
        calc.historyText = calc.historyText + ' ' + calc.displayValue + ' =';
        var result = evaluate();
        if (result === null) return;
        calc.displayValue = String(result);
        calc.previousValue = 0;
        calc.currentOp = null;
        calc.waitingForOperand = false;
        render();
    }

    function handlePercent() {
        if (calc.displayValue === 'Error') { clearAll(); return; }
        var curr = parseFloat(calc.displayValue);
        var result;
        // Bug 6 fix: mode-aware percent
        // If an operator is pending (e.g. 3072 × 18 %), compute previousValue × (curr/100)
        if (calc.currentOp !== null && calc.previousValue !== 0) {
            result = sanitize(calc.previousValue * (curr / 100));
            calc.historyText = String(calc.previousValue) + ' ' + opSymbol(calc.currentOp) + ' ' + String(curr) + '% =';
            calc.displayValue = String(result);
            calc.previousValue = 0;
            calc.currentOp = null;
            calc.waitingForOperand = false;
        } else {
            // Standalone: just divide by 100
            result = sanitize(curr / 100);
            calc.displayValue = String(result);
            calc.waitingForOperand = false;
        }
        render();
    }

    function handleNegate() {
        if (calc.displayValue === 'Error') { clearAll(); return; }
        if (calc.displayValue === '0') return;
        calc.displayValue = String(parseFloat(calc.displayValue) * -1);
        render();
    }

    function handleBackspace() {
        if (calc.displayValue === 'Error') { clearAll(); return; }
        if (calc.waitingForOperand) return;
        var next = calc.displayValue.slice(0, -1);
        calc.displayValue = (next === '' || next === '-') ? '0' : next;
        render();
    }

    function clearAll() {
        calc.displayValue = '0';
        calc.previousValue = 0;
        calc.currentOp = null;
        calc.historyText = '';
        calc.waitingForOperand = false;
        render();
    }

    // ── Copy result (Bug 7 fix: clipboard API + execCommand fallback) ──
    function copyResult() {
        var value = calc.displayValue;
        if (value === 'Error') return;

        function showCopied() {
            if (!elCopyBtn) return;
            clearTimeout(copyTimer);
            elCopyBtn.textContent = 'Copied!';
            elCopyBtn.classList.add('is-copied');
            copyTimer = setTimeout(function () {
                elCopyBtn.textContent = 'Copy';
                elCopyBtn.classList.remove('is-copied');
            }, 1500);
        }

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(value).then(showCopied).catch(function () {
                fallbackCopy(value, showCopied);
            });
        } else {
            fallbackCopy(value, showCopied);
        }
    }

    function fallbackCopy(text, callback) {
        try {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            if (callback) callback();
        } catch (e) { /* silent fail */ }
    }

    // ── Widget open/close (Bug 3 fix: class toggle, not hidden attribute) ──
    function toggle(show) {
        calc.isOpen = show;
        if (!elWidget || !elFab) return;
        elWidget.classList.toggle('ws-calc-widget--open', show);
        elFab.setAttribute('aria-expanded', show ? 'true' : 'false');

        // Bug 5 fix: use named function reference to allow proper removeEventListener
        if (show) {
            document.addEventListener('keydown', onKey);
        } else {
            document.removeEventListener('keydown', onKey);
        }
    }

    // ── Keyboard handler (named, not anonymous — Bug 5 fix) ──────────────
    function onKey(e) {
        if (!calc.isOpen) return;
        // Don't intercept when a worksheet input has focus
        var tag = document.activeElement && document.activeElement.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        var key = e.key;
        if (/^[0-9]$/.test(key)) { e.preventDefault(); inputDigit(parseInt(key, 10)); return; }
        switch (key) {
            case '.': case ',':    e.preventDefault(); inputDecimal(); break;
            case '+':              e.preventDefault(); handleOperator('add'); break;
            case '-':              e.preventDefault(); handleOperator('subtract'); break;
            case '*':              e.preventDefault(); handleOperator('multiply'); break;
            case '/':              e.preventDefault(); handleOperator('divide'); break;
            case 'Enter': case '=': e.preventDefault(); handleEquals(); break;
            case 'Backspace':      e.preventDefault(); handleBackspace(); break;
            case 'Escape':         e.preventDefault(); toggle(false); break;
            case 'Delete':         e.preventDefault(); clearAll(); break;
            case '%':              e.preventDefault(); handlePercent(); break;
        }
    }

    // ── Operator symbol helper ────────────────────────────────
    function opSymbol(op) {
        return { add: '+', subtract: '−', multiply: '×', divide: '÷' }[op] || op;
    }

    // ── Handle keypad button presses ─────────────────────────
    function handleKeypadAction(action) {
        if (/^[0-9]$/.test(action)) {
            inputDigit(parseInt(action, 10));
        } else {
            switch (action) {
                case 'decimal':   inputDecimal(); break;
                case 'add':
                case 'subtract':
                case 'multiply':
                case 'divide':    handleOperator(action); break;
                case 'equals':    handleEquals(); break;
                case 'percent':   handlePercent(); break;
                case 'negate':    handleNegate(); break;
                case 'backspace': handleBackspace(); break;
                case 'clear':     clearAll(); break;
            }
        }
    }

    // ── Initialise ───────────────────────────────────────────
    function init() {
        elFab    = document.getElementById('btn-calc-fab');
        elWidget = document.getElementById('ws-calc-widget');
        elClose  = document.getElementById('btn-calc-close');
        elDisplay = document.getElementById('calc-display');
        elHistory = document.getElementById('calc-history');
        elCopyBtn = document.getElementById('btn-calc-copy');
        elKeypad  = elWidget ? elWidget.querySelector('.ws-calc-keypad') : null;

        if (!elFab || !elWidget) return; // elements not present on this page

        // FAB click → open
        elFab.addEventListener('click', function () {
            toggle(!calc.isOpen);
        });

        // Close button → close
        if (elClose) {
            elClose.addEventListener('click', function () {
                toggle(false);
            });
        }

        // Copy button
        if (elCopyBtn) {
            elCopyBtn.addEventListener('click', copyResult);
        }

        // Keypad — single delegated listener for all keys
        if (elKeypad) {
            elKeypad.addEventListener('click', function (e) {
                var btn = e.target && e.target.closest ? e.target.closest('[data-calc]') : null;
                if (btn) handleKeypadAction(btn.dataset.calc);
            });
        }

        // Close widget on outside click
        document.addEventListener('click', function (e) {
            if (!calc.isOpen) return;
            if (elWidget.contains(e.target) || elFab.contains(e.target)) return;
            toggle(false);
        }, true);

        render();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
