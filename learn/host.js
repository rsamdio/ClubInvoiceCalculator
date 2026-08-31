(function () {
    const CODE_LEN = 6;
    const DEFAULT_TITLE = 'Rotaract Club Invoice Basics';
    const TITLE_MAX = 80;
    const IDLE_MS = 2 * 60 * 1000;
    const HIDE_NAMES_KEY = 'rsamdio-host-hide-names';
    const STAGE_LABELS = [
        'Setup',
        'Invoice year',
        'Months',
        'USD rates',
        'Local currency',
        'Roster',
        'Member dues',
        'Tax & total'
    ];
    const PASS_GROUPS = [
        ['invoice', 'Invoice year'],
        ['months', 'Months'],
        ['usd-rates', 'USD rates'],
        ['inr', 'Local currency'],
        ['roster', 'Roster'],
        ['member-dues', 'Member dues'],
        ['final', 'Tax & total']
    ];

    const ui = {
        signedOut: document.getElementById('host-signed-out'),
        checking: document.getElementById('host-checking'),
        denied: document.getElementById('host-denied'),
        console: document.getElementById('host-console'),
        userLabel: document.getElementById('host-user-label'),
        signIn: document.getElementById('btn-host-signin'),
        signOut: document.getElementById('btn-host-signout'),
        newSession: document.getElementById('btn-new-session'),
        listStep: document.getElementById('host-list-step'),
        sessionStep: document.getElementById('host-session-step'),
        stepList: document.getElementById('host-step-list'),
        stepSession: document.getElementById('host-step-session'),
        stepSessionLabel: document.getElementById('host-step-session-label'),
        listSearch: document.getElementById('host-list-search'),
        listFilters: document.getElementById('host-list-filters'),
        roomList: document.getElementById('host-room-list'),
        active: document.getElementById('host-active'),
        sessionTitle: document.getElementById('host-session-title'),
        codeDisplay: document.getElementById('host-code-display'),
        roomStatus: document.getElementById('host-room-status'),
        roomSummary: document.getElementById('host-stats'),
        statJoined: document.getElementById('stat-joined'),
        statDone: document.getElementById('stat-done'),
        statDoneLabel: document.getElementById('stat-done-label'),
        statQuiet: document.getElementById('stat-quiet'),
        stageChips: document.getElementById('host-stage-chips'),
        search: document.getElementById('host-search'),
        copyCode: document.getElementById('btn-copy-code'),
        hideNames: document.getElementById('btn-hide-names'),
        exportCsv: document.getElementById('btn-export'),
        editSession: document.getElementById('btn-edit-session'),
        deleteSession: document.getElementById('btn-delete-session'),
        closeSession: document.getElementById('btn-close-session'),
        closedNote: document.getElementById('host-closed-note'),
        rows: document.getElementById('host-participant-rows'),
        detail: document.getElementById('host-detail'),
        detailTitle: document.getElementById('host-detail-title'),
        detailBody: document.getElementById('host-detail-body'),
        closeDetail: document.getElementById('btn-close-detail')
    };

    let currentUser = null;
    let canHost = false;
    let rooms = {};
    let activeCode = null;
    let participants = {};
    let participantsUnsub = null;
    let roomsUnsub = null;
    let searchQuery = '';
    let stageFilter = 'all';
    let hideNames = false;
    let tickTimer = null;
    let hostView = 'list';
    let listFilter = 'all';
    let listQuery = '';

    try {
        hideNames = sessionStorage.getItem(HIDE_NAMES_KEY) === '1';
    } catch (err) {
        hideNames = false;
    }

    function waitForHostFirebase() {
        return new Promise((resolve, reject) => {
            if (window.hostFirebase) {
                resolve(window.hostFirebase);
                return;
            }
            let tries = 0;
            const timer = setInterval(() => {
                tries += 1;
                if (window.hostFirebase) {
                    clearInterval(timer);
                    resolve(window.hostFirebase);
                } else if (tries > 80) {
                    clearInterval(timer);
                    reject(new Error('firebase-unavailable'));
                }
            }, 50);
        });
    }

    function showScreen(name) {
        ui.signedOut.hidden = name !== 'signedOut';
        ui.checking.hidden = name !== 'checking';
        ui.denied.hidden = name !== 'denied';
        ui.console.hidden = name !== 'console';
    }

    function escapeText(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function generateCode() {
        let out = '';
        for (let i = 0; i < CODE_LEN; i += 1) {
            out += String(Math.floor(Math.random() * 10));
        }
        return out;
    }

    function clubTypeLabel(base) {
        if (base === 'community') return 'Community';
        if (base === 'university') return 'University';
        return '-';
    }

    function stageLabel(n) {
        const idx = Number(n);
        return STAGE_LABELS[idx] ? (idx + 1) + '. ' + STAGE_LABELS[idx] : '-';
    }

    function roomTitle(meta) {
        const title = meta && meta.title ? String(meta.title).trim() : '';
        return title || DEFAULT_TITLE;
    }

    function formatWhen(ts) {
        if (!ts) return '-';
        try {
            return new Date(ts).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (err) {
            return '-';
        }
    }

    function formatRelative(ts) {
        if (!ts) return '-';
        const diff = Date.now() - Number(ts);
        if (diff < 45000) return 'just now';
        if (diff < 90000) return '1 min ago';
        if (diff < 3600000) return Math.floor(diff / 60000) + ' min ago';
        if (diff < 86400000) {
            const hrs = Math.floor(diff / 3600000);
            return hrs === 1 ? '1 hr ago' : hrs + ' hr ago';
        }
        return formatWhen(ts);
    }

    function isoUtc(ts) {
        if (!ts) return '';
        try {
            return new Date(ts).toISOString();
        } catch (err) {
            return '';
        }
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
                    '<span id="learn-dialog-field-label">Session name</span>' +
                    '<input id="learn-dialog-input" type="text" maxlength="80">' +
                    '<span id="learn-dialog-hint" class="learn-dialog-hint"></span>' +
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
            const hint = overlay.querySelector('#learn-dialog-hint');
            const cancelBtn = overlay.querySelector('#learn-dialog-cancel');
            const confirmBtn = overlay.querySelector('#learn-dialog-confirm');
            titleEl.textContent = opts.title || 'Notice';
            msgEl.textContent = opts.message || '';
            confirmBtn.textContent = opts.confirmLabel || 'OK';
            cancelBtn.textContent = opts.cancelLabel || 'Cancel';
            cancelBtn.hidden = !opts.cancelLabel && !opts.input;
            if (opts.danger) {
                confirmBtn.style.background = '#dc2626';
                confirmBtn.style.borderColor = '#dc2626';
            } else {
                confirmBtn.style.background = '';
                confirmBtn.style.borderColor = '';
            }
            if (opts.input) {
                field.hidden = false;
                fieldLabel.textContent = opts.inputLabel || 'Session name';
                input.value = opts.inputValue || '';
                input.maxLength = opts.inputMax || TITLE_MAX;
                if (hint) hint.textContent = opts.inputHint || '';
            } else {
                field.hidden = true;
                input.value = '';
                if (hint) hint.textContent = '';
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
                    finish((raw || opts.inputValue || DEFAULT_TITLE).slice(0, opts.inputMax || TITLE_MAX));
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

    function participantList() {
        return Object.keys(participants || {}).map((uid) => {
            const row = participants[uid] || {};
            return {
                uid: uid,
                profile: row.profile || {},
                progress: row.progress || {}
            };
        });
    }

    function isFinished(row) {
        return !!(row.progress && (row.progress.completedAt || (row.progress.groupsPassed || {}).final));
    }

    function completionPct(finished, joined) {
        if (!joined) return 0;
        return Math.round((finished / joined) * 100);
    }

    function countsFromMap(map) {
        const list = Object.keys(map || {}).map((uid) => {
            const row = (map || {})[uid] || {};
            return { progress: row.progress || {} };
        });
        const joined = list.length;
        const finished = list.filter(isFinished).length;
        return { joined: joined, finished: finished, pct: completionPct(finished, joined) };
    }

    function isIdle(row) {
        const ts = row.progress && row.progress.updatedAt;
        return ts && (Date.now() - Number(ts) > IDLE_MS) && !isFinished(row);
    }

    function matchesSearch(row, q) {
        if (!q) return true;
        const p = row.profile || {};
        const hay = [p.name, p.email, p.clubName, p.district].join(' ').toLowerCase();
        return hay.indexOf(q) !== -1;
    }

    function filteredList() {
        const q = searchQuery;
        return participantList().filter((row) => {
            if (!matchesSearch(row, q)) return false;
            if (stageFilter === 'all') return true;
            return Number(row.progress.stage) === Number(stageFilter);
        }).sort((a, b) => {
            const ta = Number(b.progress.updatedAt) || 0;
            const tb = Number(a.progress.updatedAt) || 0;
            if (ta !== tb) return ta - tb;
            return String(a.profile.name || '').localeCompare(String(b.profile.name || ''));
        });
    }

    function stopParticipantsWatch() {
        if (participantsUnsub) {
            participantsUnsub();
            participantsUnsub = null;
        }
        participants = {};
    }

    function setClosedUi(closed) {
        if (ui.closeSession) ui.closeSession.hidden = !!closed;
        if (ui.closedNote) ui.closedNote.hidden = !closed;
    }

    function updateHideNamesButton() {
        if (ui.hideNames) ui.hideNames.textContent = hideNames ? 'Show names' : 'Hide names';
        if (ui.active) ui.active.classList.toggle('is-hide-names', hideNames);
    }

    function clearHash() {
        if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    }

    function showHostStep(name) {
        hostView = name === 'session' ? 'session' : 'list';
        if (ui.listStep) ui.listStep.hidden = hostView !== 'list';
        if (ui.sessionStep) ui.sessionStep.hidden = hostView !== 'session';
        if (ui.stepList) ui.stepList.classList.toggle('is-on', hostView === 'list');
        if (ui.stepSession) {
            const hasSession = Boolean(activeCode);
            ui.stepSession.disabled = !hasSession;
            ui.stepSession.classList.toggle('is-on', hostView === 'session');
            if (ui.stepSessionLabel) {
                const meta = activeCode ? rooms[activeCode] : null;
                ui.stepSessionLabel.textContent = hasSession ? roomTitle(meta) : 'This session';
            }
        }
    }

    function goToSessionList() {
        stopParticipantsWatch();
        showHostStep('list');
        clearHash();
        renderRoomList();
    }

    function updateListFilters(total, openCount, closedCount) {
        if (!ui.listFilters) return;
        const labels = {
            all: 'All · ' + total,
            open: 'Open · ' + openCount,
            closed: 'Closed · ' + closedCount
        };
        ui.listFilters.querySelectorAll('[data-filter]').forEach((btn) => {
            const key = btn.getAttribute('data-filter');
            btn.classList.toggle('is-on', key === listFilter);
            if (labels[key]) btn.textContent = labels[key];
        });
    }

    function renderRoomList() {
        const allCodes = Object.keys(rooms || {}).sort((a, b) => {
            const ma = rooms[a] || {};
            const mb = rooms[b] || {};
            const oa = ma.status === 'closed' ? 1 : 0;
            const ob = mb.status === 'closed' ? 1 : 0;
            if (oa !== ob) return oa - ob;
            return (Number(mb.createdAt) || 0) - (Number(ma.createdAt) || 0);
        });
        const openCount = allCodes.filter((code) => (rooms[code] || {}).status !== 'closed').length;
        const closedCount = allCodes.length - openCount;
        updateListFilters(allCodes.length, openCount, closedCount);

        const q = listQuery;
        const codes = allCodes.filter((code) => {
            const meta = rooms[code] || {};
            const isClosed = meta.status === 'closed';
            if (listFilter === 'open' && isClosed) return false;
            if (listFilter === 'closed' && !isClosed) return false;
            if (!q) return true;
            const hay = (roomTitle(meta) + ' ' + code).toLowerCase();
            return hay.indexOf(q) !== -1;
        });

        if (!allCodes.length) {
            ui.roomList.innerHTML = '<p class="ws-hint-static">No sessions yet. Create one to get a code for the room.</p>';
            return;
        }
        if (!codes.length) {
            ui.roomList.innerHTML = '<p class="ws-hint-static">No sessions match this search or filter.</p>';
            return;
        }
        ui.roomList.innerHTML = codes.map((code) => {
            const meta = rooms[code] || {};
            const status = meta.status === 'closed' ? 'Closed' : 'Open';
            const created = formatWhen(meta.createdAt);
            const closed = meta.status === 'closed' && meta.closedAt
                ? 'Closed ' + formatWhen(meta.closedAt)
                : '';
            let resultLine = '';
            if (meta.status === 'closed' && meta.joinedCount != null) {
                const joined = Number(meta.joinedCount) || 0;
                const finished = Number(meta.completedCount) || 0;
                resultLine = joined + ' joined · ' + finished + ' finished (' + completionPct(finished, joined) + '%)';
            }
            return '<button type="button" class="host-room-card' + (code === activeCode ? ' is-current' : '') + '" data-code="' + escapeText(code) + '">' +
                '<span class="host-room-card-body">' +
                '<span class="host-room-card-title">' + escapeText(roomTitle(meta)) + '</span>' +
                '<span class="host-room-card-code">' + escapeText(code) + '</span>' +
                '<span class="host-room-card-meta">' + escapeText(status) +
                (created && created !== '-' ? ' · Created ' + created : '') +
                (closed ? ' · ' + closed : '') +
                '</span>' +
                (resultLine ? '<span class="host-room-card-result">' + escapeText(resultLine) + '</span>' : '') +
                '</span>' +
                '<span class="host-room-card-open">' + (meta.status === 'closed' ? 'View' : 'Open') + '</span>' +
                '</button>';
        }).join('');
        ui.roomList.querySelectorAll('[data-code]').forEach((btn) => {
            btn.addEventListener('click', () => openRoom(btn.getAttribute('data-code')));
        });
        if (ui.stepSession) {
            const hasActive = Boolean(activeCode && rooms[activeCode]);
            ui.stepSession.disabled = !hasActive;
            if (ui.stepSessionLabel) {
                ui.stepSessionLabel.textContent = hasActive ? roomTitle(rooms[activeCode]) : 'This session';
            }
        }
    }

    function renderStageChips(all) {
        if (!ui.stageChips) return;
        const short = ['Setup', 'Year', 'Months', 'USD', 'Local', 'Roster', 'Dues', 'Total'];
        const counts = STAGE_LABELS.map(() => 0);
        all.forEach((row) => {
            const idx = Number(row.progress.stage);
            if (idx >= 0 && idx < counts.length) counts[idx] += 1;
        });
        const tabs = ['<button type="button" class="host-stage-tab' + (stageFilter === 'all' ? ' is-on' : '') + '" data-stage="all">' +
            '<span class="host-stage-tab-count">' + all.length + '</span>' +
            '<span class="host-stage-tab-label">Everyone</span></button>'];
        STAGE_LABELS.forEach((label, idx) => {
            const on = String(stageFilter) === String(idx) ? ' is-on' : '';
            tabs.push('<button type="button" class="host-stage-tab' + on + '" data-stage="' + idx + '" title="' + escapeText(label) + '">' +
                '<span class="host-stage-tab-count">' + counts[idx] + '</span>' +
                '<span class="host-stage-tab-label">' + escapeText((idx + 1) + ' ' + (short[idx] || label)) + '</span></button>');
        });
        ui.stageChips.innerHTML = tabs.join('');
        ui.stageChips.querySelectorAll('[data-stage]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const raw = btn.getAttribute('data-stage');
                stageFilter = raw === 'all' ? 'all' : Number(raw);
                renderParticipants();
            });
        });
    }

    function renderSummary(all) {
        const meta = rooms[activeCode] || {};
        if (ui.sessionTitle) ui.sessionTitle.textContent = roomTitle(meta);
        const finished = all.filter(isFinished).length;
        const idle = all.filter(isIdle).length;
        const pct = completionPct(finished, all.length);
        if (!all.length) {
            ui.roomStatus.textContent = meta.status === 'closed'
                ? 'This session is closed.'
                : 'Waiting for people to join…';
            if (ui.roomSummary) ui.roomSummary.hidden = true;
            return;
        }
        ui.roomStatus.textContent = all.length === 1 ? '1 person in the room.' : all.length + ' people in the room.';
        if (ui.statJoined) ui.statJoined.textContent = String(all.length);
        if (ui.statDone) ui.statDone.textContent = String(finished);
        if (ui.statDoneLabel) ui.statDoneLabel.textContent = 'Finished (' + pct + '%)';
        if (ui.statQuiet) ui.statQuiet.textContent = String(idle);
        if (ui.roomSummary) ui.roomSummary.hidden = false;
    }

    function renderParticipants() {
        const all = participantList();
        renderStageChips(all);
        renderSummary(all);
        const list = filteredList();

        if (!all.length) {
            ui.rows.innerHTML = '<tr><td colspan="6">No one has joined yet.</td></tr>';
            return;
        }
        if (!list.length) {
            ui.rows.innerHTML = '<tr><td colspan="6">No one matches this search or filter.</td></tr>';
            return;
        }

        ui.rows.innerHTML = list.map((row) => {
            const name = hideNames ? 'Participant' : (row.profile.name || '-');
            const club = hideNames ? '-' : (row.profile.clubName || '-');
            const district = hideNames ? '-' : (row.profile.district || '-');
            return '<tr data-uid="' + escapeText(row.uid) + '">' +
                '<td>' + escapeText(name) + '</td>' +
                '<td>' + escapeText(club) + '</td>' +
                '<td>' + escapeText(district) + '</td>' +
                '<td>' + escapeText(stageLabel(row.progress.stage)) + '</td>' +
                '<td>' + escapeText(formatRelative(row.progress.updatedAt)) + '</td>' +
                '<td>' + escapeText(row.progress.completedAt ? formatWhen(row.progress.completedAt) : '-') + '</td>' +
                '</tr>';
        }).join('');

        ui.rows.querySelectorAll('tr[data-uid]').forEach((tr) => {
            tr.addEventListener('click', () => showDetail(tr.getAttribute('data-uid')));
        });
    }

    function showDetail(uid) {
        const row = participants[uid];
        if (!row) return;
        const profile = row.profile || {};
        const progress = row.progress || {};
        const passed = progress.groupsPassed || {};
        ui.detailTitle.textContent = hideNames ? 'Participant' : (profile.name || 'Participant');
        const bits = hideNames
            ? [['Stage', stageLabel(progress.stage)]]
            : [
                ['Email', profile.email],
                ['Role', profile.role],
                ['District', profile.district],
                ['Club', profile.clubName],
                ['Club type', clubTypeLabel(profile.clubBase)],
                ['Stage', stageLabel(progress.stage)],
                ['Joined', formatWhen(progress.joinedAt)],
                ['Last active', formatRelative(progress.updatedAt)],
                ['Finished', progress.completedAt ? formatWhen(progress.completedAt) : '-']
            ];
        PASS_GROUPS.forEach((pair) => {
            bits.push([pair[1], passed[pair[0]] ? 'Passed' : 'Not yet']);
        });
        ui.detailBody.innerHTML = bits.map((pair) => {
            return '<div class="host-detail-row"><div class="host-detail-key">' + escapeText(pair[0]) +
                '</div><div class="host-detail-val">' + escapeText(pair[1] == null || pair[1] === '' ? '-' : pair[1]) + '</div></div>';
        }).join('');
        ui.detail.hidden = false;
    }

    async function openRoom(code) {
        if (!code || !rooms[code]) return;
        const fb = await waitForHostFirebase();
        activeCode = code;
        if (ui.active) ui.active.hidden = false;
        ui.codeDisplay.textContent = code;
        const meta = rooms[code] || {};
        if (ui.sessionTitle) ui.sessionTitle.textContent = roomTitle(meta);
        setClosedUi(meta.status === 'closed');
        ui.roomStatus.textContent = meta.status === 'closed' ? 'This session is closed.' : 'Waiting for people to join…';
        if (ui.search) ui.search.value = searchQuery;
        updateHideNamesButton();
        showHostStep('session');
        clearHash();
        renderRoomList();
        stopParticipantsWatch();
        const partRef = fb.ref(fb.rtdb, 'rooms/' + code + '/participants');
        participantsUnsub = fb.onValue(partRef, (snap) => {
            participants = snap.val() || {};
            renderParticipants();
        }, () => {
            participants = {};
            renderParticipants();
        });
    }

    async function loadHostRooms() {
        const fb = await waitForHostFirebase();
        if (roomsUnsub) {
            roomsUnsub();
            roomsUnsub = null;
        }
        const indexRef = fb.ref(fb.rtdb, 'hostRooms/' + currentUser.uid);
        roomsUnsub = fb.onValue(indexRef, async (snap) => {
            const index = snap.val() || {};
            const next = {};
            const codes = Object.keys(index);
            await Promise.all(codes.map(async (code) => {
                try {
                    const metaSnap = await fb.get(fb.ref(fb.rtdb, 'rooms/' + code + '/meta'));
                    if (metaSnap.exists()) next[code] = metaSnap.val();
                    else next[code] = { status: 'unknown' };
                } catch (err) {
                    next[code] = { status: 'unknown' };
                }
                const meta = next[code] || {};
                if (meta.status === 'closed' && meta.joinedCount == null) {
                    try {
                        const partSnap = await fb.get(fb.ref(fb.rtdb, 'rooms/' + code + '/participants'));
                        const counts = countsFromMap(partSnap.val() || {});
                        meta.joinedCount = counts.joined;
                        meta.completedCount = counts.finished;
                    } catch (err) {
                        /* list still works without the snapshot */
                    }
                }
            }));
            rooms = next;
            renderRoomList();
            const wanted = hostView === 'session' ? activeCode : '';
            if (wanted && rooms[wanted]) {
                if (hostView !== 'session' || wanted !== activeCode || !participantsUnsub) {
                    openRoom(wanted);
                } else {
                    setClosedUi(rooms[wanted].status === 'closed');
                    if (ui.sessionTitle) ui.sessionTitle.textContent = roomTitle(rooms[wanted]);
                    showHostStep('session');
                }
            } else {
                if (activeCode && !rooms[activeCode]) {
                    activeCode = null;
                }
                showHostStep('list');
            }
        });
    }

    function setActionStatus(message) {
        const el = document.getElementById('host-action-status');
        if (el) el.textContent = message || '';
    }

    function withTimeout(promise, ms) {
        return Promise.race([
            promise,
            new Promise((_, reject) => {
                setTimeout(() => reject(new Error('timeout')), ms);
            })
        ]);
    }

    function waitForRtdb(fb, ms) {
        return new Promise((resolve, reject) => {
            const connectedRef = fb.ref(fb.rtdb, '.info/connected');
            let settled = false;
            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                fb.off(connectedRef);
                reject(new Error('timeout'));
            }, ms);
            fb.onValue(connectedRef, (snap) => {
                if (settled || snap.val() !== true) return;
                settled = true;
                clearTimeout(timer);
                fb.off(connectedRef);
                resolve();
            }, () => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                reject(new Error('timeout'));
            });
        });
    }

    async function ensureLiveHostFlag(fb) {
        try {
            await withTimeout(fb.set(fb.ref(fb.rtdb, 'admins/' + currentUser.uid), true), 6000);
        } catch (err) {
            if (String(err && err.message) === 'timeout') throw err;
        }
    }

    async function createSession() {
        const title = await showLearnDialog({
            title: 'New session',
            message: 'Name this session so you can find it later.',
            input: true,
            inputLabel: 'Session name',
            inputValue: DEFAULT_TITLE,
            inputHint: 'Shown in your list as typed. Suggested: ' + DEFAULT_TITLE,
            inputMax: TITLE_MAX,
            confirmLabel: 'Create',
            cancelLabel: 'Cancel'
        });
        if (title === false) return;
        const sessionTitle = String(title || DEFAULT_TITLE).trim().slice(0, TITLE_MAX) || DEFAULT_TITLE;

        const fb = await waitForHostFirebase();
        ui.newSession.disabled = true;
        ui.newSession.textContent = 'Creating…';
        setActionStatus('Connecting to live sessions…');
        try {
            await waitForRtdb(fb, 6000);
            setActionStatus('Creating your session…');
            await ensureLiveHostFlag(fb);
            let code = '';
            let created = false;
            for (let attempt = 0; attempt < 8 && !created; attempt += 1) {
                code = generateCode();
                const metaRef = fb.ref(fb.rtdb, 'rooms/' + code + '/meta');
                const existing = await withTimeout(fb.get(metaRef), 6000);
                if (existing.exists()) continue;
                await withTimeout(fb.set(metaRef, {
                    title: sessionTitle,
                    status: 'open',
                    createdBy: currentUser.uid,
                    createdAt: Date.now(),
                    closedAt: null
                }), 6000);
                await withTimeout(fb.set(fb.ref(fb.rtdb, 'hostRooms/' + currentUser.uid + '/' + code), true), 6000);
                created = true;
            }
            if (!created) {
                setActionStatus('Could not create a unique session code. Try again.');
                return;
            }
            rooms[code] = {
                title: sessionTitle,
                status: 'open',
                createdBy: currentUser.uid,
                createdAt: Date.now(),
                closedAt: null
            };
            setActionStatus('');
            renderRoomList();
            openRoom(code);
        } catch (err) {
            const code = err && err.code ? String(err.code) : '';
            if (code.indexOf('permission') !== -1) {
                setActionStatus('Could not create the session. Live-session permission is not set for this account yet.');
            } else if (String(err && err.message) === 'timeout') {
                setActionStatus('Could not reach live sessions. Hard-refresh this page and try again.');
            } else {
                setActionStatus('Could not create the session. Check your connection and try again.');
            }
        } finally {
            ui.newSession.disabled = false;
            ui.newSession.textContent = 'New session';
        }
    }

    async function closeSession() {
        if (!activeCode) return;
        if (rooms[activeCode] && rooms[activeCode].status === 'closed') {
            setClosedUi(true);
            return;
        }
        const ok = await showLearnDialog({
            title: 'Close this session?',
            message: 'People will not be able to join or change answers. Other sessions stay open.',
            confirmLabel: 'Close session',
            cancelLabel: 'Keep open',
            danger: true
        });
        if (!ok) return;
        const fb = await waitForHostFirebase();
        const snap = countsFromMap(participants);
        try {
            await fb.update(fb.ref(fb.rtdb, 'rooms/' + activeCode + '/meta'), {
                status: 'closed',
                closedAt: Date.now(),
                joinedCount: snap.joined,
                completedCount: snap.finished
            });
            if (rooms[activeCode]) {
                rooms[activeCode].status = 'closed';
                rooms[activeCode].closedAt = Date.now();
                rooms[activeCode].joinedCount = snap.joined;
                rooms[activeCode].completedCount = snap.finished;
            }
            setClosedUi(true);
            ui.roomStatus.textContent = 'This session is closed.';
            renderRoomList();
        } catch (err) {
            await showLearnDialog({
                title: 'Could not close',
                message: 'Could not close this session. Try again.',
                confirmLabel: 'OK'
            });
        }
    }

    async function editSession() {
        if (!activeCode || !rooms[activeCode]) return;
        const currentTitle = roomTitle(rooms[activeCode]);
        const newTitle = await showLearnDialog({
            title: 'Edit session name',
            message: 'Change the name of this session.',
            input: true,
            inputLabel: 'Session name',
            inputValue: currentTitle,
            inputHint: 'Shown in your list as typed.',
            inputMax: TITLE_MAX,
            confirmLabel: 'Save',
            cancelLabel: 'Cancel'
        });
        if (newTitle === false) return;
        const titleToSave = String(newTitle || DEFAULT_TITLE).trim().slice(0, TITLE_MAX) || DEFAULT_TITLE;
        if (titleToSave === currentTitle) return;

        const fb = await waitForHostFirebase();
        try {
            await fb.update(fb.ref(fb.rtdb, 'rooms/' + activeCode + '/meta'), {
                title: titleToSave
            });
            if (rooms[activeCode]) {
                rooms[activeCode].title = titleToSave;
            }
            if (ui.sessionTitle) ui.sessionTitle.textContent = titleToSave;
            if (ui.stepSessionLabel) ui.stepSessionLabel.textContent = titleToSave;
            renderRoomList();
            setActionStatus('Session name updated.');
        } catch (err) {
            await showLearnDialog({
                title: 'Could not save',
                message: 'Could not update session name. Try again.',
                confirmLabel: 'OK'
            });
        }
    }

    async function deleteSession() {
        if (!activeCode) return;
        const firstConfirm = await showLearnDialog({
            title: 'Delete this session?',
            message: 'Are you sure you want to delete this session? This action cannot be undone.',
            confirmLabel: 'Delete session',
            cancelLabel: 'Cancel',
            danger: true
        });
        if (!firstConfirm) return;
        
        const secondConfirm = await showLearnDialog({
            title: 'Final confirmation',
            message: 'All data for this session will be removed from your view. Proceed?',
            confirmLabel: 'Yes, delete permanently',
            cancelLabel: 'Cancel',
            danger: true
        });
        if (!secondConfirm) return;

        const fb = await waitForHostFirebase();
        try {
            const codeToDelete = activeCode;
            await fb.set(fb.ref(fb.rtdb, 'hostRooms/' + currentUser.uid + '/' + codeToDelete), null);
            await fb.set(fb.ref(fb.rtdb, 'rooms/' + codeToDelete + '/meta'), null);
            
            delete rooms[codeToDelete];
            if (activeCode === codeToDelete) {
                activeCode = null;
            }
            setActionStatus('Session deleted.');
            goToSessionList();
        } catch (err) {
            await showLearnDialog({
                title: 'Could not delete',
                message: 'Could not delete this session. Try again.',
                confirmLabel: 'OK'
            });
        }
    }

    async function copyCode() {
        if (!activeCode) return;
        try {
            await navigator.clipboard.writeText(activeCode);
            setActionStatus('Copied ' + activeCode + '.');
        } catch (err) {
            setActionStatus('Code: ' + activeCode);
        }
    }

    function toggleHideNames() {
        hideNames = !hideNames;
        try {
            sessionStorage.setItem(HIDE_NAMES_KEY, hideNames ? '1' : '0');
        } catch (err) {
            /* ignore */
        }
        updateHideNamesButton();
        renderParticipants();
    }

    function csvEscape(value) {
        const text = String(value == null ? '' : value);
        if (/[",\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
        return text;
    }

    function exportCsv() {
        const meta = rooms[activeCode] || {};
        const rows = filteredList();
        const headers = [
            'sessionTitle', 'sessionCode', 'sessionStatus', 'exportedAt',
            'name', 'email', 'role', 'district', 'clubName', 'clubBase',
            'stage', 'stageLabel', 'joinedAt', 'lastUpdatedAt', 'completedAt',
            'completedLastStage', 'passedGroups'
        ];
        const exportedAt = new Date().toISOString();
        const lines = [headers.join(',')];
        rows.forEach((row) => {
            const passed = row.progress.groupsPassed || {};
            const groups = PASS_GROUPS.filter((pair) => passed[pair[0]]).map((pair) => pair[0]).join(';');
            lines.push([
                roomTitle(meta),
                activeCode || '',
                meta.status || '',
                exportedAt,
                row.profile.name || '',
                row.profile.email || '',
                row.profile.role || '',
                row.profile.district || '',
                row.profile.clubName || '',
                row.profile.clubBase || '',
                row.progress.stage == null ? '' : row.progress.stage,
                stageLabel(row.progress.stage),
                isoUtc(row.progress.joinedAt),
                isoUtc(row.progress.updatedAt),
                isoUtc(row.progress.completedAt),
                isFinished(row) ? 'Y' : 'N',
                groups
            ].map(csvEscape).join(','));
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const stamp = exportedAt.slice(0, 10);
        a.href = url;
        a.download = 'session-' + (activeCode || 'export') + '-' + stamp + '.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    async function upsertUserProfile(user) {
        let email = user.email;
        let displayName = user.displayName;
        let photoURL = user.photoURL;

        if (!email || !displayName) {
            if (user.providerData && user.providerData.length > 0) {
                for (const provider of user.providerData) {
                    if (!email && provider.email) email = provider.email;
                    if (!displayName && provider.displayName) displayName = provider.displayName;
                    if (!photoURL && provider.photoURL) photoURL = provider.photoURL;
                }
            }
        }

        const fb = await waitForHostFirebase();
        await fb.setDoc(fb.doc(fb.firestore, 'users', user.uid), {
            email: String(email || '').toLowerCase().trim(),
            displayName: displayName || '',
            photoURL: photoURL || null,
            uid: user.uid,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    }

    async function checkHostAccess(user) {
        showScreen('checking');
        const fb = await waitForHostFirebase();
        try {
            await upsertUserProfile(user);
        } catch (err) {
            /* still try the gate */
        }
        let isAdmin = false;
        let isHost = false;
        try {
            const adminSnap = await fb.getDoc(fb.doc(fb.firestore, 'admins', user.uid));
            isAdmin = adminSnap.exists();
        } catch (err) {
            isAdmin = false;
        }
        try {
            const hostSnap = await fb.getDoc(fb.doc(fb.firestore, 'workshopHosts', user.uid));
            isHost = hostSnap.exists();
        } catch (err) {
            isHost = false;
        }
        canHost = isAdmin || isHost;
        if (!canHost) {
            showScreen('denied');
            return;
        }
        showScreen('console');
        clearHash();
        loadHostRooms();
    }

    function bindUi() {
        ui.signIn.addEventListener('click', async () => {
            const fb = await waitForHostFirebase();
            try {
                await fb.signInWithPopup(fb.auth, fb.provider);
            } catch (err) {
                await showLearnDialog({
                    title: 'Sign-in did not finish',
                    message: 'Sign-in was cancelled or failed. Try again.',
                    confirmLabel: 'OK'
                });
            }
        });
        ui.signOut.addEventListener('click', async () => {
            const fb = await waitForHostFirebase();
            stopParticipantsWatch();
            if (roomsUnsub) {
                roomsUnsub();
                roomsUnsub = null;
            }
            await fb.signOut(fb.auth);
        });
        ui.newSession.addEventListener('click', createSession);
        if (ui.stepList) ui.stepList.addEventListener('click', goToSessionList);
        if (ui.stepSession) {
            ui.stepSession.addEventListener('click', () => {
                if (activeCode) openRoom(activeCode);
            });
        }
        if (ui.listFilters) {
            ui.listFilters.addEventListener('click', (event) => {
                const btn = event.target.closest('[data-filter]');
                if (!btn) return;
                listFilter = btn.getAttribute('data-filter') || 'all';
                renderRoomList();
            });
        }
        if (ui.listSearch) {
            ui.listSearch.addEventListener('input', () => {
                listQuery = String(ui.listSearch.value || '').trim().toLowerCase();
                renderRoomList();
            });
        }
        ui.closeSession.addEventListener('click', closeSession);
        if (ui.editSession) ui.editSession.addEventListener('click', editSession);
        if (ui.deleteSession) ui.deleteSession.addEventListener('click', deleteSession);
        if (ui.copyCode) ui.copyCode.addEventListener('click', copyCode);
        if (ui.hideNames) ui.hideNames.addEventListener('click', toggleHideNames);
        if (ui.exportCsv) ui.exportCsv.addEventListener('click', exportCsv);
        if (ui.search) {
            ui.search.addEventListener('input', () => {
                searchQuery = String(ui.search.value || '').trim().toLowerCase();
                renderParticipants();
            });
        }
        ui.closeDetail.addEventListener('click', () => {
            ui.detail.hidden = true;
        });
        ui.detail.addEventListener('click', (e) => {
            if (e.target === ui.detail) ui.detail.hidden = true;
        });
    }

    async function start() {
        bindUi();
        updateHideNamesButton();
        tickTimer = setInterval(() => {
            if (activeCode && Object.keys(participants).length) renderParticipants();
        }, 30000);
        const fb = await waitForHostFirebase();
        fb.onAuthStateChanged(fb.auth, (user) => {
            currentUser = user && !user.isAnonymous ? user : null;
            if (!currentUser) {
                canHost = false;
                activeCode = null;
                rooms = {};
                hostView = 'list';
                stopParticipantsWatch();
                showHostStep('list');
                clearHash();
                ui.userLabel.textContent = '';
                ui.signOut.hidden = true;
                showScreen('signedOut');
                return;
            }
            ui.userLabel.textContent = user.email || user.displayName || '';
            ui.signOut.hidden = false;
            checkHostAccess(user);
        });
    }

    start();
})();
