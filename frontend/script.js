let trybLogowania = true;
let zalogowanyUzytkownik = "";

async function startGry() {
    document.getElementById('komunikat').innerText = "";
    document.getElementById('krupier-punkty').innerText = "";

    const res = await fetch(`http://127.0.0.1:8000/start/${zalogowanyUzytkownik}`, { method: 'POST' });
    const dane = await res.json();

    document.getElementById('krupier-karta').textContent = dane.krupier;
    document.getElementById('moje-karty').textContent = dane.gracz.join(', ');
    document.getElementById('moje-punkty').textContent = dane.punkty;

    // Przełączamy przyciski
    document.getElementById('btn-start').style.display = 'none';
    document.getElementById('btn-hit').style.display = 'inline-block';
    document.getElementById('btn-stand').style.display = 'inline-block';
}

async function hit() {
    const res = await fetch(`http://127.0.0.1:8000/hit/${zalogowanyUzytkownik}`, { method: 'POST' });
    const dane = await res.json();

    document.getElementById('moje-karty').textContent = dane.gracz.join(', ');
    document.getElementById('moje-punkty').textContent = dane.punkty;

    if (dane.status === "przegrana") {
        zakonczRunde("Przegrana! Masz ponad 21 punktów.");
    }
}

async function stand() {
    const res = await fetch(`http://127.0.0.1:8000/stand/${zalogowanyUzytkownik}`, { method: 'POST' });
    const dane = await res.json();

    document.getElementById('krupier-karta').textContent = dane.krupier_reka.join(', ');
    document.getElementById('krupier-punkty').innerText = "Punkty: " + dane.krupier_punkty;
    zakonczRunde(dane.wynik);
}

function zakonczRunde(msg) {
    document.getElementById('komunikat').innerText = msg;
    document.getElementById('btn-start').style.display = 'inline-block';
    document.getElementById('btn-hit').style.display = 'none';
    document.getElementById('btn-stand').style.display = 'none';
}

function przelaczTryb() {
    trybLogowania = !trybLogowania; 
    
    const title = document.getElementById('auth-title');
    const btn = document.getElementById('auth-main-btn');
    const switchText = document.getElementById('auth-switch-text');
    const link = document.getElementById('auth-link');

    if (trybLogowania) {
        title.innerText = "Logowanie";
        btn.innerText = "Zaloguj się";
        switchText.innerText = "Nie masz konta?";
        link.innerText = "Zarejestruj się";
    } else {
        title.innerText = "Tworzenie konta";
        btn.innerText = "Stwórz konto";
        switchText.innerText = "Masz już konto?";
        link.innerText = "Zaloguj się";
    }
}

async function wykonajAkcje() {
    const sciezka = trybLogowania ? 'login' : 'register';
    const user = document.getElementById('user-login').value;
    const pass = document.getElementById('user-pass').value;

    if (!user || !pass) {
        alert("Wypełnij wszystkie pola!");
        return;
    }

    try {
        const res = await fetch(`http://127.0.0.1:8000/${sciezka}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });

        const dane = await res.json();

        if (dane.error) {
            alert(dane.error);
        } else {
            alert(dane.msg);
            if (!trybLogowania && sciezka === 'register') {
                przelaczTryb();
            } 
            else if (trybLogowania && sciezka === 'login') {
                zalogowanyUzytkownik = dane.username;
                // Przełączanie paneli
                document.getElementById('auth-panel').style.display = 'none';
                document.getElementById('game-panel').style.display = 'block';
                document.getElementById('powitanie').innerText = "Witaj, " + dane.username;
                document.getElementById('saldo').innerText = dane.balance;
            }
        }
    } catch (e) {
        alert("Błąd połączenia z serwerem!");
    }
}