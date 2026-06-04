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
    }
    
    if (data.bonus_balance !== undefined) {
        const bonusBalanceDisplay = document.getElementById('bonus-balance-display');
        if (bonusBalanceDisplay) bonusBalanceDisplay.innerText = data.bonus_balance;
        
        const gameBonusBalance = document.getElementById('game-bonus-balance');
        if (gameBonusBalance) gameBonusBalance.innerText = data.bonus_balance;
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

    const res = await fetch(`http://127.0.0.1:8000/start/${loggedInUser}`, { 
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
    const res = await fetch(`http://127.0.0.1:8000/hit/${loggedInUser}`, { method: 'POST' });
    const data = await res.json();
    updateView(data);
}

async function stand() {
    const res = await fetch(`http://127.0.0.1:8000/stand/${loggedInUser}`, { method: 'POST' });
    const data = await res.json();
    updateView(data);
}

async function doubleAction() {
    try {
        const res = await fetch(`http://127.0.0.1:8000/double/${loggedInUser}`, { method: 'POST' });
        const data = await res.json();
        if (res.status === 400) alert(data.detail);
        else updateView(data);
    } catch(e) { console.error(e); }
}

async function splitAction() {
    try {
        const res = await fetch(`http://127.0.0.1:8000/split/${loggedInUser}`, { method: 'POST' });
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
        const res = await fetch(`http://127.0.0.1:8000/register`, {
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
        const res = await fetch(`http://127.0.0.1:8000/login`, {
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
            const res = await fetch(`http://127.0.0.1:8000/state/${savedUser}`);
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
        const stateRes = await fetch(`http://127.0.0.1:8000/state/${loggedInUser}`);
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
        
        const histRes = await fetch(`http://127.0.0.1:8000/history/${loggedInUser}`);
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
        const res = await fetch(`http://127.0.0.1:8000/deposit/${loggedInUser}`, {
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
        const res = await fetch(`http://127.0.0.1:8000/withdraw/${loggedInUser}`, {
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
        const res = await fetch(`http://127.0.0.1:8000/claim_challenge/${loggedInUser}/${challengeId}`, {
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