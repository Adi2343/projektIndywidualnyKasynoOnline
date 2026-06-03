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

    const res = await fetch(`http://127.0.0.1:8000/start/${loggedInUser}`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bet: betValue })
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

function showAuth() {
    document.getElementById('landing-page').style.display = 'none';
    document.getElementById('game-panel').style.display = 'none';
    document.getElementById('games-page').style.display = 'none';
    document.getElementById('subpage-panel').style.display = 'none';
    document.getElementById('auth-panel').style.display = 'flex';
}

function showLanding() {
    document.getElementById('auth-panel').style.display = 'none';
    document.getElementById('game-panel').style.display = 'none';
    document.getElementById('games-page').style.display = 'none';
    document.getElementById('subpage-panel').style.display = 'none';
    document.getElementById('landing-page').style.display = 'block';
}

function showSubpage(event) {
    if(event) event.preventDefault();
    document.getElementById('landing-page').style.display = 'none';
    document.getElementById('auth-panel').style.display = 'none';
    document.getElementById('game-panel').style.display = 'none';
    document.getElementById('games-page').style.display = 'none';
    document.getElementById('subpage-panel').style.display = 'block';
}

function playNow() {
    if (loggedInUser) {
        document.getElementById('landing-page').style.display = 'none';
        document.getElementById('auth-panel').style.display = 'none';
        document.getElementById('subpage-panel').style.display = 'none';
        document.getElementById('game-panel').style.display = 'none';
        document.getElementById('games-page').style.display = 'block';
    } else {
        showAuth();
    }
}

function openBlackjack() {
    if (loggedInUser) {
        document.getElementById('landing-page').style.display = 'none';
        document.getElementById('auth-panel').style.display = 'none';
        document.getElementById('subpage-panel').style.display = 'none';
        document.getElementById('games-page').style.display = 'none';
        document.getElementById('game-panel').style.display = 'block';
    } else {
        showAuth();
    }
}

function logout() {
    loggedInUser = "";
    document.getElementById('user-info').style.display = 'none';
    document.getElementById('auth-buttons').style.display = 'flex';
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

                if (data.game_state) {
                    document.getElementById('landing-page').style.display = 'none';
                    document.getElementById('games-page').style.display = 'none';
                    document.getElementById('game-panel').style.display = 'block';
                    const betContainer = document.getElementById('bet-container');
                    if (betContainer) betContainer.style.display = 'none';
                    updateView(data.game_state);
                }
            } else {
                localStorage.removeItem("loggedInUser");
            }
        } catch (e) {
            console.error("Could not restore session", e);
        }
    }
}