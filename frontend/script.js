let loggedInUser = "";

function renderCardHTML(cardStr) {
    if (!cardStr) return "";
    let suit = cardStr.slice(-1);
    let rank = cardStr.slice(0, -1);
    let colorClass = (suit === '♥' || suit === '♦') ? 'red' : 'black';
    return `<div class="card-visual ${colorClass}">
        <div class="card-rank-top">${rank}${suit}</div>
        <div class="card-suit-center">${suit}</div>
        <div class="card-rank-bottom">${rank}${suit}</div>
    </div>`;
}

function updateView(data) {
    if (data.balance !== undefined) {
        const balanceEl = document.getElementById('balance');
        if (balanceEl) balanceEl.innerText = data.balance;
        
        const balanceDisplay = document.getElementById('balance-display');
        if (balanceDisplay) balanceDisplay.innerText = data.balance;
        
        const gameBalance = document.getElementById('game-balance');
        if (gameBalance) gameBalance.innerText = data.balance;
        
        const rouletteBalance = document.getElementById('roulette-balance');
        if (rouletteBalance) rouletteBalance.innerText = data.balance;
    }
    
    if (data.bonus_balance !== undefined) {
        const bonusBalanceDisplay = document.getElementById('bonus-balance-display');
        if (bonusBalanceDisplay) bonusBalanceDisplay.innerText = data.bonus_balance;
        
        const gameBonusBalance = document.getElementById('game-bonus-balance');
        if (gameBonusBalance) gameBonusBalance.innerText = data.bonus_balance;
        
        const rouletteBonusBalance = document.getElementById('roulette-bonus-balance');
        if (rouletteBonusBalance) rouletteBonusBalance.innerText = data.bonus_balance;
    }
    
    // Update active bet display
    if (data.bets && data.bets.length > 0) {
        document.getElementById('current-bet-display').innerText = data.bets.reduce((a, b) => a + b, 0);
    } else {
        const betInput = document.getElementById('bet-amount');
        if (betInput) document.getElementById('current-bet-display').innerText = betInput.value;
    }

    if (data.finished) {
        document.getElementById('dealer-cards').innerHTML = data.dealer_hand.map(renderCardHTML).join('');
        document.getElementById('dealer-points').innerText = data.dealer_points;
        
        let msg = "";
        for (let i = 0; i < data.results.length; i++) {
            msg += `Hand ${i+1}: ${data.results[i]}<br>`;
        }
        
        renderHands(data.player, data.points, -1, data.status || data.hand_status);
        endRound(msg);
        return;
    }

    document.getElementById('dealer-cards').innerHTML = renderCardHTML(data.dealer);
    document.getElementById('dealer-points').innerText = "11+";
    document.getElementById('game-message').innerHTML = "";
    
    renderHands(data.player, data.points, data.active_hand, data.status);

    document.getElementById('btn-start').style.display = 'none';
    document.getElementById('btn-hit').style.display = 'flex';
    document.getElementById('btn-stand').style.display = 'flex';
    
    const active = data.active_hand;
    const hand = data.player[active];
    
    if (hand.length === 2) {
        document.getElementById('btn-double').style.display = 'flex';
        document.getElementById('btn-split').style.display = 'flex';
    } else {
        document.getElementById('btn-double').style.display = 'none';
        document.getElementById('btn-split').style.display = 'none';
    }
}

function renderHands(hands, points, active, statuses) {
    const container = document.getElementById('my-hands');
    container.innerHTML = "";
    
    if (!hands) return;
    
    for (let i = 0; i < hands.length; i++) {
        const div = document.createElement('div');
        div.className = "player-hand-wrapper";
        if (i === active) {
            div.classList.add("active-hand");
        }
        
        const cardsHTML = hands[i].map(renderCardHTML).join('');
        let addition = "";
        if (statuses && statuses[i]) {
            if (statuses[i] === "lost") addition = " <span style='color:#ff4d4d;'>(Lost)</span>";
            if (statuses[i] === "stand") addition = " <span style='color:#aaa;'>(Stand)</span>";
        }
        
        div.innerHTML = `<div class="hand-label">PLAYER ${i+1}: <span class="points-val">${points[i]}</span>${addition}</div><div class="cards-container">${cardsHTML}</div>`;
        container.appendChild(div);
    }
}

async function startGame() {
    const betInput = document.getElementById('bet-amount');
    let betValue = 10;
    if (betInput) betValue = parseInt(betInput.value) || 10;
    
    let fundSource = "real";
    const sourceRadios = document.getElementsByName('fund-source');
    for (let radio of sourceRadios) {
        if (radio.checked) {
            fundSource = radio.value;
            break;
        }
    }

    const res = await fetch(`/start/${loggedInUser}`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bet: betValue, fund_source: fundSource })
    });
    const data = await res.json();
    
    if (res.status === 400 || res.status === 404) {
        alert(data.detail);
        return;
    }
    
    const betContainer = document.getElementById('bet-container');
    if (betContainer) betContainer.style.display = 'none';
    
    updateView(data);
}

async function hit() {
    const res = await fetch(`/hit/${loggedInUser}`, { method: 'POST' });
    const data = await res.json();
    updateView(data);
}

async function stand() {
    const res = await fetch(`/stand/${loggedInUser}`, { method: 'POST' });
    const data = await res.json();
    updateView(data);
}

async function doubleAction() {
    try {
        const res = await fetch(`/double/${loggedInUser}`, { method: 'POST' });
        const data = await res.json();
        if (res.status === 400) alert(data.detail);
        else updateView(data);
    } catch(e) { console.error(e); }
}

async function splitAction() {
    try {
        const res = await fetch(`/split/${loggedInUser}`, { method: 'POST' });
        const data = await res.json();
        if (res.status === 400) alert(data.detail);
        else updateView(data);
    } catch(e) { console.error(e); }
}

function endRound(msg) {
    document.getElementById('game-message').innerHTML = msg;
    document.getElementById('btn-start').style.display = 'block';
    document.getElementById('btn-hit').style.display = 'none';
    document.getElementById('btn-stand').style.display = 'none';
    document.getElementById('btn-double').style.display = 'none';
    document.getElementById('btn-split').style.display = 'none';
    
    const betContainer = document.getElementById('bet-container');
    if (betContainer) betContainer.style.display = 'flex';
}

function addBet(amount) {
    const betInput = document.getElementById('bet-amount');
    if (betInput) {
        let current = parseInt(betInput.value) || 0;
        betInput.value = current + amount;
        document.getElementById('current-bet-display').innerText = betInput.value;
    }
}

function clearBet() {
    const betInput = document.getElementById('bet-amount');
    if (betInput) {
        betInput.value = 0;
        document.getElementById('current-bet-display').innerText = 0;
    }
}

function hideAllPanels() {
    document.getElementById('landing-page').style.display = 'none';
    document.getElementById('game-panel').style.display = 'none';
    document.getElementById('games-page').style.display = 'none';
    document.getElementById('auth-panel').style.display = 'none';
    document.getElementById('about-page').style.display = 'none';
    document.getElementById('support-page').style.display = 'none';
    document.getElementById('terms-page').style.display = 'none';
    document.getElementById('roulette-panel').style.display = 'none';
    
    const subpagePanel = document.getElementById('subpage-panel');
    if(subpagePanel) subpagePanel.style.display = 'none';
    
    const accPanel = document.getElementById('account-panel');
    if (accPanel) accPanel.style.display = 'none';
}

function showAuth() {
    hideAllPanels();
    document.getElementById('auth-panel').style.display = 'flex';
}

function showLanding() {
    hideAllPanels();
    document.getElementById('landing-page').style.display = 'block';
}

function showPage(pageId) {
    hideAllPanels();
    document.getElementById(pageId + '-page').style.display = 'block';
}

function playNow() {
    if (loggedInUser) {
        hideAllPanels();
        document.getElementById('games-page').style.display = 'block';
    } else {
        showAuth();
    }
}

function openBlackjack() {
    if (loggedInUser) {
        hideAllPanels();
        document.getElementById('game-panel').style.display = 'block';
    } else {
        showAuth();
    }
}

function openRoulette() {
    if (loggedInUser) {
        hideAllPanels();
        document.getElementById('roulette-panel').style.display = 'block';
        updateRouletteBalanceUI();
    } else {
        showAuth();
    }
}

function updateRouletteBalanceUI() {
    document.getElementById('roulette-balance').innerText = document.getElementById('acc-real-balance') ? document.getElementById('acc-real-balance').innerText : '0';
    document.getElementById('roulette-bonus-balance').innerText = document.getElementById('acc-bonus-balance') ? document.getElementById('acc-bonus-balance').innerText : '0';
}

function logout() {
    loggedInUser = "";
    document.getElementById('user-info').style.display = 'none';
    document.getElementById('auth-buttons').style.display = 'flex';
    const accPanel = document.getElementById('account-panel');
    if (accPanel) accPanel.style.display = 'none';
    showLanding();
}

async function executeRegistration() {
    const firstName = document.getElementById('reg-firstname').value;
    const lastName = document.getElementById('reg-lastname').value;
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;
    const passConfirm = document.getElementById('reg-pass-confirm').value;
    const terms = document.getElementById('reg-terms').checked;

    if (!firstName || !lastName || !email || !pass || !passConfirm) {
        alert("Please fill in all fields!");
        return;
    }
    
    if (pass !== passConfirm) {
        alert("Passwords do not match!");
        return;
    }
    
    if (!terms) {
        alert("You must accept the terms and conditions!");
        return;
    }

    try {
        const res = await fetch(`/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ first_name: firstName, last_name: lastName, email: email, password: pass })
        });

        const data = await res.json();

        if (data.error) {
            alert(data.error);
        } else {
            alert(data.msg);
            document.getElementById('reg-firstname').value = "";
            document.getElementById('reg-lastname').value = "";
            document.getElementById('reg-email').value = "";
            document.getElementById('reg-pass').value = "";
            document.getElementById('reg-pass-confirm').value = "";
        }
    } catch (e) {
        alert("Server connection error!");
    }
}

async function executeLogin() {
    const email = document.getElementById('log-email').value;
    const pass = document.getElementById('log-pass').value;

    if (!email || !pass) {
        alert("Please fill in all fields!");
        return;
    }

    try {
        const res = await fetch(`/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: pass })
        });

        const data = await res.json();

        if (data.error) {
            alert(data.error);
        } else {
            alert(data.msg);
            loggedInUser = data.email;
            localStorage.setItem("loggedInUser", data.email);
            
            document.getElementById('auth-buttons').style.display = 'none';
            document.getElementById('user-info').style.display = 'flex';
            document.getElementById('balance-display').innerText = data.balance;
            
            document.getElementById('auth-panel').style.display = 'none';
            document.getElementById('landing-page').style.display = 'block';
            
            const welcomeMsg = document.getElementById('welcome-msg');
            if (welcomeMsg) welcomeMsg.innerText = "Welcome, " + data.first_name;
            
            const balanceEl = document.getElementById('balance');
            if (balanceEl) balanceEl.innerText = data.balance;
            
            const gameBalance = document.getElementById('game-balance');
            if (gameBalance) gameBalance.innerText = data.balance;
            
            if (data.bonus_balance !== undefined) {
                const bonusBalanceDisplay = document.getElementById('bonus-balance-display');
                if (bonusBalanceDisplay) bonusBalanceDisplay.innerText = data.bonus_balance;
                
                const gameBonusBalance = document.getElementById('game-bonus-balance');
                if (gameBonusBalance) gameBonusBalance.innerText = data.bonus_balance;
            }
        }
    } catch (e) {
        console.error(e);
        alert("Server connection error!");
    }
}

function toggleDropdown() {
    document.getElementById("dropdown-menu").classList.toggle("show-dropdown");
}

function logout() {
    loggedInUser = "";
    localStorage.removeItem("loggedInUser");
    document.getElementById('auth-buttons').style.display = 'flex';
    document.getElementById('user-info').style.display = 'none';
    showLanding();
}

window.onclick = function(event) {
    if (!event.target.matches('.btn-account') && !event.target.closest('.btn-account')) {
        var dropdowns = document.getElementsByClassName("dropdown-content");
        for (var i = 0; i < dropdowns.length; i++) {
            var openDropdown = dropdowns[i];
            if (openDropdown.classList.contains('show-dropdown')) {
                openDropdown.classList.remove('show-dropdown');
            }
        }
    }
}

window.onload = async function() {
    const savedUser = localStorage.getItem("loggedInUser");
    if (savedUser) {
        try {
            const res = await fetch(`/state/${savedUser}`);
            if (res.ok) {
                const data = await res.json();
                loggedInUser = data.email;
                
                document.getElementById('auth-buttons').style.display = 'none';
                document.getElementById('user-info').style.display = 'flex';
                
                const welcomeMsg = document.getElementById('welcome-msg');
                if (welcomeMsg) welcomeMsg.innerText = "Welcome, " + data.first_name;
                
                const balanceEl = document.getElementById('balance');
                if (balanceEl) balanceEl.innerText = data.balance;
                
                const balanceDisplay = document.getElementById('balance-display');
                if (balanceDisplay) balanceDisplay.innerText = data.balance;
                
                const gameBalance = document.getElementById('game-balance');
                if (gameBalance) gameBalance.innerText = data.balance;
                
                if (data.bonus_balance !== undefined) {
                    const bonusBalanceDisplay = document.getElementById('bonus-balance-display');
                    if (bonusBalanceDisplay) bonusBalanceDisplay.innerText = data.bonus_balance;
                    
                    const gameBonusBalance = document.getElementById('game-bonus-balance');
                    if (gameBonusBalance) gameBonusBalance.innerText = data.bonus_balance;
                }

                if (data.game_state) {
                    document.getElementById('landing-page').style.display = 'none';
                    document.getElementById('games-page').style.display = 'none';
                    document.getElementById('game-panel').style.display = 'block';
                    const betContainer = document.getElementById('bet-container');
                    if (betContainer) betContainer.style.display = 'none';
                    updateView(data.game_state);
                } else if (localStorage.getItem('showAccountAfterReload') === 'true') {
                    localStorage.removeItem('showAccountAfterReload');
                    showAccountPanel();
                }
            } else {
                localStorage.removeItem("loggedInUser");
            }
        } catch (e) {
            console.error("Could not restore session", e);
        }
    }
    
    initRouletteBoard();
    initRouletteWheel();
}

/* -------------------------------------
   ACCOUNT PANEL LOGIC
   ------------------------------------- */

function showAccountPanel() {
    if (!loggedInUser) {
        showAuth();
        return;
    }
    hideAllPanels();
    document.getElementById('account-panel').style.display = 'flex';
    
    loadAccountData();
}

function switchAccTab(tabId) {
    const tabs = document.querySelectorAll('.acc-tab-content');
    tabs.forEach(t => t.style.display = 'none');
    document.getElementById(`acc-tab-${tabId}`).style.display = 'block';
    
    const btns = document.querySelectorAll('.acc-tab-btn');
    btns.forEach(b => b.classList.remove('active'));
    if(event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
}

async function loadAccountData() {
    try {
        const stateRes = await fetch(`/state/${loggedInUser}`);
        const stateData = await stateRes.json();
        
        document.getElementById('acc-real-balance').innerText = stateData.balance;
        document.getElementById('acc-bonus-balance').innerText = stateData.bonus_balance;
        document.getElementById('withdraw-available').innerText = stateData.balance;
        
        // Update Challenges
        const wagerTargets = [100, 300, 1000];
        const wagerRewards = [25, 50, 150];
        const wLvl = stateData.chal_wager_claimed;
        const btnWager = document.getElementById('btn-claim-wager');
        
        if (wLvl >= wagerTargets.length) {
            document.getElementById('chal-wager-title').innerText = "High Roller (MAX)";
            document.getElementById('chal-wager-desc').innerText = `You have completed all High Roller challenges!`;
            document.getElementById('chal-wager-bar').style.width = `100%`;
            document.getElementById('chal-wager-text').innerText = `Completed`;
            document.getElementById('chal-wager-reward').innerText = `Reward: All Claimed`;
            btnWager.innerText = "MAX LEVEL";
            btnWager.classList.add("claimed");
            btnWager.disabled = true;
        } else {
            const wTarget = wagerTargets[wLvl];
            const wReward = wagerRewards[wLvl];
            const wProg = Math.min(stateData.total_wagered, wTarget);
            document.getElementById('chal-wager-title').innerText = `High Roller Lvl ${wLvl + 1}`;
            document.getElementById('chal-wager-desc').innerText = `Wager a total of $${wTarget} real money.`;
            document.getElementById('chal-wager-bar').style.width = `${(wProg / wTarget) * 100}%`;
            document.getElementById('chal-wager-text').innerText = `$${wProg} / $${wTarget}`;
            document.getElementById('chal-wager-reward').innerText = `Reward: $${wReward} Bonus`;
            btnWager.innerText = "CLAIM";
            btnWager.classList.remove("claimed");
            btnWager.disabled = wProg < wTarget;
        }

        const handsTargets = [10, 30, 100];
        const handsRewards = [20, 40, 100];
        const hLvl = stateData.chal_hands_claimed;
        const btnHands = document.getElementById('btn-claim-hands');
        
        if (hLvl >= handsTargets.length) {
            document.getElementById('chal-hands-title').innerText = "Blackjack Veteran (MAX)";
            document.getElementById('chal-hands-desc').innerText = `You have completed all Veteran challenges!`;
            document.getElementById('chal-hands-bar').style.width = `100%`;
            document.getElementById('chal-hands-text').innerText = `Completed`;
            document.getElementById('chal-hands-reward').innerText = `Reward: All Claimed`;
            btnHands.innerText = "MAX LEVEL";
            btnHands.classList.add("claimed");
            btnHands.disabled = true;
        } else {
            const hTarget = handsTargets[hLvl];
            const hReward = handsRewards[hLvl];
            const hProg = Math.min(stateData.hands_played, hTarget);
            document.getElementById('chal-hands-title').innerText = `BJ Veteran Lvl ${hLvl + 1}`;
            document.getElementById('chal-hands-desc').innerText = `Play ${hTarget} hands of Blackjack.`;
            document.getElementById('chal-hands-bar').style.width = `${(hProg / hTarget) * 100}%`;
            document.getElementById('chal-hands-text').innerText = `${hProg} / ${hTarget} Hands`;
            document.getElementById('chal-hands-reward').innerText = `Reward: $${hReward} Bonus`;
            btnHands.innerText = "CLAIM";
            btnHands.classList.remove("claimed");
            btnHands.disabled = hProg < hTarget;
        }

        const depTargets = [1, 3, 10];
        const depRewards = [10, 20, 50];
        const dLvl = stateData.chal_deposit_claimed;
        const btnDep = document.getElementById('btn-claim-deposit');
        
        if (dLvl >= depTargets.length) {
            document.getElementById('chal-deposit-title').innerText = "Deposit Master (MAX)";
            document.getElementById('chal-deposit-desc').innerText = `You have completed all Deposit challenges!`;
            document.getElementById('chal-deposit-bar').style.width = `100%`;
            document.getElementById('chal-deposit-text').innerText = `Completed`;
            document.getElementById('chal-deposit-reward').innerText = `Reward: All Claimed`;
            btnDep.innerText = "MAX LEVEL";
            btnDep.classList.add("claimed");
            btnDep.disabled = true;
        } else {
            const dTarget = depTargets[dLvl];
            const dReward = depRewards[dLvl];
            const dProg = Math.min(stateData.deposits_count, dTarget);
            document.getElementById('chal-deposit-title').innerText = `Deposit Master Lvl ${dLvl + 1}`;
            document.getElementById('chal-deposit-desc').innerText = `Make at least ${dTarget} deposit${dTarget > 1 ? 's' : ''}.`;
            document.getElementById('chal-deposit-bar').style.width = `${(dProg / dTarget) * 100}%`;
            document.getElementById('chal-deposit-text').innerText = `${dProg} / ${dTarget} Deposit${dTarget > 1 ? 's' : ''}`;
            document.getElementById('chal-deposit-reward').innerText = `Reward: $${dReward} Bonus`;
            btnDep.innerText = "CLAIM";
            btnDep.classList.remove("claimed");
            btnDep.disabled = dProg < dTarget;
        }
        
        const histRes = await fetch(`/history/${loggedInUser}`);
        if(histRes.ok) {
            const histData = await histRes.json();
            const tbody = document.getElementById('history-tbody');
            tbody.innerHTML = '';
            
            histData.history.forEach(tx => {
                let tr = document.createElement('tr');
                let statusClass = 'status-pending';
                if(tx.status === 'Completed') statusClass = 'status-completed';
                if(tx.status === 'Rejected') statusClass = 'status-rejected';
                
                tr.innerHTML = `
                    <td>${tx.date}</td>
                    <td>${tx.type}</td>
                    <td>${tx.method}</td>
                    <td>$${tx.amount}</td>
                    <td><span class="status-badge ${statusClass}">${tx.status}</span></td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (e) {
        console.error("Error loading account data:", e);
    }
}

async function executeDeposit() {
    const amount = parseInt(document.getElementById('deposit-amount').value);
    const method = document.getElementById('deposit-method').value;
    const promo = document.getElementById('deposit-promo').value;
    
    if(!amount || amount <= 0) {
        alert("Please enter a valid amount");
        return;
    }
    
    try {
        const res = await fetch(`/deposit/${loggedInUser}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: amount, method: method, promo_code: promo })
        });
        const data = await res.json();
        if(res.ok) {
            localStorage.setItem('showAccountAfterReload', 'true');
            alert(data.msg);
            window.location.href = window.location.pathname;
        } else {
            alert(data.detail);
        }
    } catch(e) {
        console.error("Deposit error", e);
    }
}

async function executeWithdraw() {
    const amount = parseInt(document.getElementById('withdraw-amount').value);
    
    if(!amount || amount <= 0) {
        alert("Please enter a valid amount");
        return;
    }
    
    try {
        const res = await fetch(`/withdraw/${loggedInUser}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: amount })
        });
        const data = await res.json();
        if(res.ok) {
            localStorage.setItem('showAccountAfterReload', 'true');
            alert(data.msg);
            window.location.href = window.location.pathname;
        } else {
            alert(data.detail || data.error);
        }
    } catch(e) {
        console.error("Withdraw error", e);
    }
}

async function claimChallenge(challengeId) {
    try {
        const res = await fetch(`/claim_challenge/${loggedInUser}/${challengeId}`, {
            method: 'POST'
        });
        const data = await res.json();
        if(res.ok) {
            alert(data.msg);
            localStorage.setItem('showAccountAfterReload', 'true');
            window.location.href = window.location.pathname;
        } else {
            alert(data.detail);
        }
    } catch (e) {
        console.error("Error claiming challenge:", e);
    }
}

/* -------------------------------------
   ROULETTE LOGIC
   ------------------------------------- */

const ROULETTE_NUMBERS = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED_NUMS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];

function initRouletteBoard() {
    const board = document.getElementById('roulette-board');
    if (!board) return;
    board.innerHTML = '';
    
    const boardHtml = [];
    boardHtml.push(`<div class="board-cell board-zero" onclick="selectRouletteBet('number', 0, this)">0</div>`);
    
    const rows = [
        [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
        [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
        [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]
    ];
    
    rows.forEach((row, rowIndex) => {
        row.forEach((num, colIndex) => {
            const colorClass = RED_NUMS.includes(num) ? 'board-red' : 'board-black';
            boardHtml.push(`<div class="board-cell ${colorClass}" style="grid-row: ${rowIndex + 1}; grid-column: ${colIndex + 2};" onclick="selectRouletteBet('number', ${num}, this)">${num}</div>`);
        });
    });
    
    boardHtml.push(`<div class="board-cell board-special" style="grid-row: 4; grid-column: 2 / 4;" onclick="selectRouletteBet('low', -1, this)">1-18</div>`);
    boardHtml.push(`<div class="board-cell board-special" style="grid-row: 4; grid-column: 4 / 6;" onclick="selectRouletteBet('even', -1, this)">EVEN</div>`);
    boardHtml.push(`<div class="board-cell board-special board-red" style="grid-row: 4; grid-column: 6 / 8;" onclick="selectRouletteBet('red', -1, this)">RED</div>`);
    boardHtml.push(`<div class="board-cell board-special board-black" style="grid-row: 4; grid-column: 8 / 10;" onclick="selectRouletteBet('black', -1, this)">BLACK</div>`);
    boardHtml.push(`<div class="board-cell board-special" style="grid-row: 4; grid-column: 10 / 12;" onclick="selectRouletteBet('odd', -1, this)">ODD</div>`);
    boardHtml.push(`<div class="board-cell board-special" style="grid-row: 4; grid-column: 12 / 14;" onclick="selectRouletteBet('high', -1, this)">19-36</div>`);
    
    board.innerHTML = boardHtml.join('');
}

function initRouletteWheel() {
    const strip = document.getElementById('roulette-wheel-strip');
    if (!strip) return;
    strip.innerHTML = '';
    
    for (let i = 0; i < 5; i++) {
        ROULETTE_NUMBERS.forEach(num => {
            const div = document.createElement('div');
            div.className = 'roulette-wheel-strip-item';
            if (num === 0) div.classList.add('wheel-green');
            else if (RED_NUMS.includes(num)) div.classList.add('wheel-red');
            else div.classList.add('wheel-black');
            div.innerText = num;
            strip.appendChild(div);
        });
    }
}

function selectRouletteBet(type, number, element) {
    document.getElementById('roulette-bet-type').value = type;
    document.getElementById('roulette-bet-number').value = number;
    
    document.querySelectorAll('.board-cell').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
}

function addRouletteBet(amount) {
    const betInput = document.getElementById('roulette-bet-amount');
    if (betInput) {
        let current = parseInt(betInput.value) || 0;
        betInput.value = current + amount;
        document.getElementById('roulette-current-bet-display').innerText = betInput.value;
    }
}

function clearRouletteBet() {
    const betInput = document.getElementById('roulette-bet-amount');
    if (betInput) {
        betInput.value = 0;
        document.getElementById('roulette-current-bet-display').innerText = 0;
    }
}

async function spinRoulette() {
    const betInput = document.getElementById('roulette-bet-amount');
    let betValue = parseInt(betInput.value) || 0;
    
    if (betValue <= 0) {
        alert("Please place a bet!");
        return;
    }

    const betType = document.getElementById('roulette-bet-type').value;
    if (!betType) {
        alert("Please select a bet from the board!");
        return;
    }

    let fundSource = "real";
    const sourceRadios = document.getElementsByName('roulette-fund-source');
    for (let radio of sourceRadios) {
        if (radio.checked) {
            fundSource = radio.value;
            break;
        }
    }

    let betNumber = parseInt(document.getElementById('roulette-bet-number').value);

    document.getElementById('btn-spin-roulette').disabled = true;
    document.getElementById('roulette-message').innerHTML = '';

    try {
        const res = await fetch(`/roulette/spin/${loggedInUser}`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bet_amount: betValue, fund_source: fundSource, bet_type: betType, bet_number: betNumber })
        });
        const data = await res.json();
        
        if (res.status === 400 || res.status === 404) {
            alert(data.detail);
            document.getElementById('btn-spin-roulette').disabled = false;
            return;
        }
        
        // Immediately subtract bet visually
        const intermediateBalance = fundSource === 'real' ? data.balance - data.winnings : data.balance;
        const intermediateBonus = fundSource === 'bonus' ? data.bonus_balance - data.winnings : data.bonus_balance;
        
        document.getElementById('roulette-balance').innerText = intermediateBalance;
        document.getElementById('roulette-bonus-balance').innerText = intermediateBonus;
        document.getElementById('balance-display').innerText = intermediateBalance;
        document.getElementById('bonus-balance-display').innerText = intermediateBonus;
        document.getElementById('game-balance').innerText = intermediateBalance;
        document.getElementById('game-bonus-balance').innerText = intermediateBonus;

        const strip = document.getElementById('roulette-wheel-strip');
        const wrapper = document.querySelector('.roulette-wheel-wrapper');
        const itemWidth = 60;
        
        strip.style.transition = 'none';
        strip.style.transform = 'translateX(0px)';
        void strip.offsetWidth; // force reflow
        
        const targetIdx = (37 * 3) + ROULETTE_NUMBERS.indexOf(data.winning_number);
        const randomOffset = Math.floor(Math.random() * 40) - 20;
        const finalTranslate = -(targetIdx * itemWidth) + (wrapper.offsetWidth / 2) - (itemWidth / 2) + randomOffset;
        
        strip.style.transition = 'transform 4s cubic-bezier(0.1, 0.9, 0.2, 1)';
        strip.style.transform = `translateX(${finalTranslate}px)`;

        setTimeout(() => {
            if (data.win) {
                document.getElementById('roulette-message').innerHTML = `YOU WON $${data.winnings}!`;
            } else {
                document.getElementById('roulette-message').innerHTML = `YOU LOST!`;
            }
            
            // Final balance update
            document.getElementById('roulette-balance').innerText = data.balance;
            document.getElementById('roulette-bonus-balance').innerText = data.bonus_balance;
            document.getElementById('balance-display').innerText = data.balance;
            document.getElementById('bonus-balance-display').innerText = data.bonus_balance;
            document.getElementById('game-balance').innerText = data.balance;
            document.getElementById('game-bonus-balance').innerText = data.bonus_balance;
            
            document.getElementById('btn-spin-roulette').disabled = false;
        }, 4500);

    } catch (e) {
        console.error(e);
        document.getElementById('btn-spin-roulette').disabled = false;
        alert("Server error during spin!");
    }
}